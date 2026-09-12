// Фаза B — правка партнёра из админки платформы (AC4–AC7).
// Запуск: npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/phase-b-admin.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type APIRequestContext } from "playwright";

import { BASE, E2E_PARTNER_ID, HERE, OTHER_PARTNER_SLUG, STORAGE, type Check } from "./config";
import { db } from "./db";

const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

async function patchPartner(api: APIRequestContext, body: unknown) {
  const res = await api.patch(`${BASE}/api/root/partners/${E2E_PARTNER_ID}`, { data: body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML-ошибка — оставляем текст */
  }
  return { status: res.status(), json, text: text.slice(0, 200) };
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ storageState: STORAGE, viewport: { width: 1440, height: 900 } });
    const api = context.request;

    const before = await db.partner.findUniqueOrThrow({
      where: { id: E2E_PARTNER_ID },
      select: { city: true, slug: true, companyName: true, payoutType: true, payoutDetails: true },
    });
    console.log("до правки:", JSON.stringify(before));

    // --- AC4: пустое тело — 400, ничего не меняем.
    const empty = await patchPartner(api, {});
    record("AC4 пустой PATCH → 400", empty.status === 400, `${empty.status} ${empty.text}`);

    // --- AC4: меняем город, проверяем базу и аудит.
    const newCity = `Тест-город ${stamp}`;
    const cityRes = await patchPartner(api, { city: newCity });
    record("AC4 правка города → 200", cityRes.status === 200, String(cityRes.status));
    const afterCity = await db.partner.findUniqueOrThrow({
      where: { id: E2E_PARTNER_ID },
      select: { city: true, companyName: true },
    });
    record("AC4 город записан в базу", afterCity.city === newCity, afterCity.city);
    record(
      "AC4 остальные поля не тронуты",
      afterCity.companyName === before.companyName,
      afterCity.companyName,
    );

    const audit = await db.auditLog.findFirst({
      where: { action: "partner.admin_updated", entityId: E2E_PARTNER_ID },
      orderBy: { createdAt: "desc" },
      select: { details: true, userName: true, createdAt: true },
    });
    const details = (audit?.details ?? {}) as { before?: Record<string, unknown>; after?: Record<string, unknown> };
    record(
      "AC4 аудит пишет «было → стало»",
      details.before?.city === before.city && details.after?.city === newCity,
      `${String(details.before?.city)} → ${String(details.after?.city)}`,
    );

    // --- AC5: занятая ссылка — 409.
    const takenSlug = await patchPartner(api, { slug: OTHER_PARTNER_SLUG });
    record(
      "AC5 занятый slug → 409",
      takenSlug.status === 409,
      `${takenSlug.status} ${takenSlug.text}`,
    );
    const slugUnchanged = await db.partner.findUniqueOrThrow({
      where: { id: E2E_PARTNER_ID },
      select: { slug: true },
    });
    record("AC5 slug не изменился", slugUnchanged.slug === before.slug, slugUnchanged.slug);

    // --- Зарезервированная ссылка — тоже отказ (сведённый список).
    const reserved = await patchPartner(api, { slug: "blog" });
    record("AC5 зарезервированный slug «blog» → 400/409", reserved.status >= 400, `${reserved.status} ${reserved.text}`);

    // --- AC6: реквизиты для выплат.
    const payout = await patchPartner(api, {
      payoutType: "ip",
      payoutDetails: {
        fullName: `ИП Тестов ${stamp}`,
        inn: "123456789012",
        bank: "АО «Тестбанк»",
        bik: "044525225",
        account: "40802810000000012345",
      },
    });
    record("AC6 правка реквизитов → 200", payout.status === 200, `${payout.status} ${payout.text}`);
    const afterPayout = await db.partner.findUniqueOrThrow({
      where: { id: E2E_PARTNER_ID },
      select: { payoutType: true, payoutDetails: true },
    });
    const pd = (afterPayout.payoutDetails ?? {}) as Record<string, string>;
    record(
      "AC6 реквизиты записаны",
      afterPayout.payoutType === "ip" && pd.account === "40802810000000012345",
      `${afterPayout.payoutType} / ${pd.account}`,
    );

    const payoutAudit = await db.auditLog.findFirst({
      where: { action: "partner.admin_updated", entityId: E2E_PARTNER_ID },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });
    const pdetails = (payoutAudit?.details ?? {}) as { after?: Record<string, unknown> };
    const masked = String(pdetails.after?.payoutAccount ?? "");
    record(
      "AC6 счёт в аудите замаскирован",
      masked.startsWith("••••") && !masked.includes("40802810000000012345"),
      masked,
    );

    // --- Плохие реквизиты — отказ и ничего не меняется.
    const badPayout = await patchPartner(api, {
      payoutType: "ip",
      payoutDetails: { fullName: "ИП Тестов", inn: "12", bank: "Банк", bik: "1", account: "2" },
    });
    record("AC6 кривые реквизиты → 400", badPayout.status === 400, `${badPayout.status} ${badPayout.text}`);

    // --- AC7: уровень доступа клиента из админки.
    const client = await db.partnerClient.findFirst({
      where: { partnerId: E2E_PARTNER_ID, detachedAt: null },
      select: { organizationId: true, accessLevel: true },
    });
    if (!client) {
      record("AC7 уровень доступа клиента", false, "у e2e-партнёра нет активного клиента");
    } else {
      const next = client.accessLevel === "edit" ? "view" : "edit";
      const res = await api.patch(
        `${BASE}/api/root/partners/${E2E_PARTNER_ID}/clients/${client.organizationId}`,
        { data: { accessLevel: next } },
      );
      record("AC7 смена уровня из админки → 200", res.status() === 200, String(res.status()));
      const afterLevel = await db.partnerClient.findFirst({
        where: { partnerId: E2E_PARTNER_ID, organizationId: client.organizationId, detachedAt: null },
        select: { accessLevel: true },
      });
      record("AC7 уровень записан", afterLevel?.accessLevel === next, `${client.accessLevel} → ${afterLevel?.accessLevel}`);
      const levelAudit = await db.auditLog.findFirst({
        where: { action: "partner.access_level", organizationId: client.organizationId },
        orderBy: { createdAt: "desc" },
        select: { details: true },
      });
      const ld = (levelAudit?.details ?? {}) as Record<string, unknown>;
      record("AC7 аудит уровня записан", ld.to === next, JSON.stringify(ld));
    }

    // --- UI: кнопка «Изменить» открывает форму.
    const page = await context.newPage();
    await page.goto(`${BASE}/root/partners/${E2E_PARTNER_ID}`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    const editButtons = page.locator("button", { hasText: "Изменить" });
    const count = await editButtons.count();
    record("AC4 на карточке есть кнопки «Изменить»", count >= 2, `${count} шт.`);
    if (count > 0) {
      await editButtons.first().click();
      await page.waitForTimeout(500);
      const hasCompanyField = await page
        .locator('input[maxlength="120"]')
        .first()
        .isVisible()
        .catch(() => false);
      record("AC4 форма анкеты открылась", hasCompanyField);
      await page.screenshot({ path: path.join(SHOTS, "b-partner-edit-form.png"), fullPage: false });
    }

    fs.writeFileSync(path.join(HERE, "phase-b.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== Фаза B: ${checks.length - failed.length}/${checks.length} ===`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
