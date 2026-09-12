// Фаза D — анкета «Завершите регистрацию» у самого клиента (AC14).
// Владелец, которому партнёр передал готовую организацию, не должен её
// стереть: форма обязана стартовать от уже известных данных.
// Запуск: npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/phase-d-prefill.ts
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

const PASSWORD = "E2eOwner!2026";

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const created = JSON.parse(fs.readFileSync(path.join(HERE, "created.json"), "utf8")) as Record<string, string>;
  const orgId = created.rate3;
  const ownerEmail = `e2e-anketa-${stamp}@example.com`;
  const orgName = `E2E Пекарня ${stamp}`;

  const browser = await chromium.launch({ channel: "chrome" });
  try {
    // ---------- Партнёр настраивает организацию и передаёт её ----------
    const rootCtx = await browser.newContext({ storageState: STORAGE });
    const setup = await rootCtx.request.patch(`${BASE}/api/partner/clients/${orgId}`, {
      data: {
        name: orgName,
        type: "bakery",
        ownershipKind: "chain",
        inn: "7743013901",
        address: "Москва, ул. Настроенная, 7",
        locationsCount: 2,
      },
    });
    record("подготовка: партнёр настроил организацию", setup.status() === 200, String(setup.status()));

    // Владельца передаём БЕЗ телефона — именно тогда анкета и всплывает.
    const handover = await rootCtx.request.post(`${BASE}/api/partner/clients/${orgId}/owner`, {
      data: { email: ownerEmail, name: "Анна Владелец" },
    });
    record("подготовка: организация передана владельцу", handover.status() === 200, String(handover.status()));
    await rootCtx.close();

    // Владелец «принял приглашение»: задал пароль. Телефон не заполнен.
    await db.user.update({
      where: { email: ownerEmail },
      data: { passwordHash: bcrypt.hashSync(PASSWORD, 10), isActive: true, phone: null },
    });
    await db.inviteToken.updateMany({ where: { user: { email: ownerEmail } }, data: { usedAt: new Date() } });

    const before = await db.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { name: true, type: true, ownershipKind: true, inn: true, address: true, locationsCount: true },
    });
    console.log("организация до входа владельца:", JSON.stringify(before));

    // ---------- Владелец входит ----------
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

    // ---------- Открываем анкету и смотрим, чем она заполнена ----------
    await page.locator("button", { hasText: "Завершить" }).first().click();
    await page.waitForTimeout(1200);
    const filled = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;
      const out: Record<string, string> = {};
      for (const label of Array.from(modal.querySelectorAll("label"))) {
        const caption = (label.querySelector("span")?.textContent || "").trim();
        const field = label.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
        if (caption && field) out[caption] = field.value;
      }
      return out;
    });
    console.log("поля анкеты:", JSON.stringify(filled, null, 2));
    await page.screenshot({ path: path.join(SHOTS, "d-prefill-modal.png"), fullPage: false });

    const values = Object.values(filled ?? {});
    record("AC14 название подставлено", values.includes(orgName), orgName);
    record("AC14 ИНН подставлен", values.includes("7743013901"));
    record("AC14 адрес подставлен", values.some((v) => v.includes("Настроенная")));
    record("AC14 сфера подставлена", values.includes("bakery"));
    record("AC14 форма собственности подставлена", values.includes("chain"));
    record("AC14 число точек подставлено", values.includes("2"));

    // ---------- Самое важное: отправка не стирает настроенное ----------
    const phoneInput = page.locator('[role="dialog"] input[type="tel"], [role="dialog"] input[inputmode="tel"]').first();
    if (await phoneInput.count()) {
      await phoneInput.fill("+7 999 555-44-33");
    } else {
      // Телефон ищем по подписи, если атрибут другой.
      await page.locator('[role="dialog"] label', { hasText: "Телефон" }).locator("input").first().fill("+7 999 555-44-33");
    }
    await page.waitForTimeout(400);
    const submit = page.locator('[role="dialog"] button', { hasText: /Готово|Сохранить|Завершить/ }).last();
    await submit.click();
    await page.waitForTimeout(4000);

    const after = await db.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { name: true, type: true, ownershipKind: true, inn: true, address: true, locationsCount: true },
    });
    console.log("организация после анкеты:", JSON.stringify(after));
    record("AC14 название пережило анкету", after.name === before.name, `${before.name} → ${after.name}`);
    record("AC14 ИНН пережил анкету", after.inn === before.inn, `${before.inn} → ${after.inn}`);
    record("AC14 адрес пережил анкету", after.address === before.address, `${before.address} → ${after.address}`);
    record("AC14 сфера пережила анкету", after.type === before.type, `${before.type} → ${after.type}`);
    record("AC14 точки пережили анкету", after.locationsCount === before.locationsCount, `${before.locationsCount} → ${after.locationsCount}`);

    fs.writeFileSync(path.join(HERE, "phase-d.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== Фаза D: ${checks.length - failed.length}/${checks.length} ===`);
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
