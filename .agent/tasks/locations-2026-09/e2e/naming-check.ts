/* eslint-disable no-console */
// Шаг «Назовите точки» после анкеты — телефон 390×780.
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:3020";
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const results: Record<string, unknown> = {};

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });
    await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    const nudge = page.locator('[role="dialog"][aria-labelledby="complete-profile-title"]');
    await nudge.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(600);
    const orgInput = nudge.locator('input[placeholder="ООО «Ромашка»"]');
    if (!(await orgInput.inputValue())) await orgInput.fill("Кафе «Тестовое 1»");
    const phone = nudge.locator('input[placeholder="+7 999 123-45-67"]');
    if (!(await phone.inputValue())) {
      await phone.click();
      await page.keyboard.type("9991234567", { delay: 20 });
    }
    // «Точек» = 2: иначе анкета закроется без шага именования.
    await nudge.locator('button[aria-label="Больше"]').first().click();
    await page.waitForTimeout(200);
    results.locationsValue = (await nudge.locator('button[aria-label="Больше"]').first().locator("xpath=..").innerText().catch(() => "n/a")).replace(/\s+/g, " ");
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    await nudge.locator('button[type="submit"]').click();
    await page.locator('input[aria-label="Название точки 1"]').waitFor({ state: "visible", timeout: 30_000 });
    results.title = (await page.locator("#complete-profile-title").innerText()).trim();
    results.inputs = await page.locator('input[aria-label^="Название точки"]').count();
    results.dialog = await page.evaluate(() => {
      const d = Array.from(document.querySelectorAll('[role="dialog"]')).filter((x) => x.getBoundingClientRect().height > 0).pop();
      const r = d?.getBoundingClientRect();
      const save = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Сохранить");
      const sr = save?.getBoundingClientRect();
      return r ? { h: Math.round(r.height), vh: window.innerHeight, fits: r.top >= 0 && r.bottom <= window.innerHeight, saveVisible: sr ? sr.bottom <= window.innerHeight : null } : null;
    });
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    await page.screenshot({ path: ".agent/tasks/locations-2026-09/smoke/r3-06-naming-step.png" });
    await page.locator('input[aria-label="Адрес точки 2"]').fill("пр. Мира, 10");
    await page.locator('button:has-text("Сохранить")').click();
    await page.waitForTimeout(2500);
    results.toast = (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).join(" | ");
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: ".agent/tasks/locations-2026-09/smoke/99-naming-error.png" }).catch(() => {});
  } finally {
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
