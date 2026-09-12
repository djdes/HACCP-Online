// Фаза D2 — перепроверка после исправления: анкета у владельца, которому
// консультант передал готовый кабинет, не должна подменять ни адрес, ни имя.
//
// Отличия от фазы D: берём свежую организацию (прошлая уже испорчена
// подстановкой) и судим по базе, а не по DOM — поля адреса в анкете нет
// вовсе, а число точек рисует степпер, поэтому DOM-ассерты там врали.
// Запуск: npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/phase-d2-prefill-recheck.ts
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

import { BASE, HERE, STORAGE, type Check } from "./config";
import { db } from "./db";

const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const PASSWORD = "E2eOwner2!2026";
/** Фактический адрес заведения — он намеренно не совпадает с юридическим. */
const VENUE_ADDRESS = "Москва, Пятницкая улица, 12, вход со двора";
/** Настоящий ИНН: у него в реестре есть и адрес, и руководитель. */
const REAL_INN = "7743013901";

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const created = JSON.parse(fs.readFileSync(path.join(HERE, "created.json"), "utf8")) as Record<string, string>;
  const orgId = created.rate4;
  const ownerEmail = `e2e-anketa2-${stamp}@example.com`;
  const ownerName = "Анна Владелец";
  const orgName = `E2E Пекарня-2 ${stamp}`;

  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const rootCtx = await browser.newContext({ storageState: STORAGE });
    const setup = await rootCtx.request.patch(`${BASE}/api/partner/clients/${orgId}`, {
      data: {
        name: orgName,
        type: "bakery",
        ownershipKind: "chain",
        inn: REAL_INN,
        address: VENUE_ADDRESS,
        locationsCount: 2,
      },
    });
    record("подготовка: консультант настроил организацию", setup.status() === 200, String(setup.status()));

    const handover = await rootCtx.request.post(`${BASE}/api/partner/clients/${orgId}/owner`, {
      data: { email: ownerEmail, name: ownerName },
    });
    record("подготовка: передана владельцу без телефона", handover.status() === 200, String(handover.status()));
    await rootCtx.close();

    await db.user.update({
      where: { email: ownerEmail },
      data: { passwordHash: bcrypt.hashSync(PASSWORD, 10), isActive: true, phone: null },
    });
    await db.inviteToken.updateMany({ where: { user: { email: ownerEmail } }, data: { usedAt: new Date() } });

    const before = await db.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { name: true, type: true, ownershipKind: true, inn: true, address: true, locationsCount: true },
    });
    console.log("до входа владельца:", JSON.stringify(before));
    record("подготовка: адрес фактический, не юридический", before.address === VENUE_ADDRESS, String(before.address));

    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "load" });
    for (let i = 0; i < 30; i += 1) {
      await page.fill("#email", ownerEmail);
      await page.fill("#password", PASSWORD);
      if ((await page.inputValue("#email")) === ownerEmail) break;
      await page.waitForTimeout(300);
    }
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    record("AC14 клиенту анкета показывается", bodyText.includes("Завершите регистрацию"));

    await page.locator("button", { hasText: "Завершить" }).first().click();
    await page.waitForTimeout(1500);
    const filled = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;
      const out: Record<string, string> = {};
      for (const label of Array.from(modal.querySelectorAll("label"))) {
        const caption = (label.querySelector("span")?.textContent || "").trim().slice(0, 40);
        const field = label.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
        if (caption && field) out[caption] = field.value;
      }
      return out;
    });
    console.log("поля анкеты:", JSON.stringify(filled, null, 2));
    await page.screenshot({ path: path.join(SHOTS, "d2-prefill-modal.png"), fullPage: false });

    const values = Object.values(filled ?? {});
    record("AC14 название подставлено", values.includes(orgName), orgName);
    record("AC14 ИНН подставлен", values.includes(REAL_INN));
    record("AC14 сфера подставлена", values.includes("bakery"));
    record("AC14 форма собственности подставлена", values.includes("chain"));
    record("AC14 имя владельца подставлено, а не из реестра", values.includes(ownerName), values.join(" | "));

    // Заполняем только телефон — ровно то, ради чего анкета и показана.
    const phoneLabel = page.locator('[role="dialog"] label', { hasText: "Телефон" }).first();
    await phoneLabel.locator("input").first().fill("+7 999 555-44-33");
    await page.waitForTimeout(500);
    await page.locator('[role="dialog"] button', { hasText: /Готово|Сохранить|Завершить/ }).last().click();
    await page.waitForTimeout(4500);

    const after = await db.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { name: true, type: true, ownershipKind: true, inn: true, address: true, locationsCount: true },
    });
    const ownerAfter = await db.user.findUniqueOrThrow({
      where: { email: ownerEmail },
      select: { name: true, phone: true },
    });
    console.log("после анкеты:", JSON.stringify(after), JSON.stringify(ownerAfter));

    record("AC14 адрес заведения не подменён юридическим", after.address === VENUE_ADDRESS, `${before.address} → ${after.address}`);
    record("AC14 владельца не переименовали", ownerAfter.name === ownerName, `${ownerName} → ${ownerAfter.name}`);
    record("AC14 телефон сохранён", Boolean(ownerAfter.phone), String(ownerAfter.phone));
    record("AC14 название пережило анкету", after.name === before.name, `${before.name} → ${after.name}`);
    record("AC14 ИНН пережил анкету", after.inn === before.inn, `${before.inn} → ${after.inn}`);
    record("AC14 сфера пережила анкету", after.type === before.type, `${before.type} → ${after.type}`);
    record("AC14 форма собственности пережила анкету", after.ownershipKind === before.ownershipKind, `${before.ownershipKind} → ${after.ownershipKind}`);
    record("AC14 точки пережили анкету", after.locationsCount === before.locationsCount, `${before.locationsCount} → ${after.locationsCount}`);

    fs.writeFileSync(path.join(HERE, "phase-d2.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== Фаза D2: ${checks.length - failed.length}/${checks.length} ===`);
    console.log("владелец:", ownerEmail, "организация:", orgId);
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
