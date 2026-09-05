/* eslint-disable no-console */
// Прод: мобильная шапка с пилюлей точки, меню точек, Mini App-панель.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://wesetup.ru";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "smoke");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const results: Record<string, unknown> = {};

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    await page.request.post(`${BASE}/api/me/notices`, { data: { key: "fill-guide:hygiene" } });
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const pill = page.locator('[data-tour="location-switcher"]:visible').first();
    results.pillText = (await pill.innerText().catch(() => "")).trim();
    results.pillWidth = await pill.evaluate((el) => Math.round(el.getBoundingClientRect().width)).catch(() => null);
    await page.screenshot({ path: path.join(OUT, "r2-12-prod-mobile-pill.png") });
    await pill.click();
    await page.locator('[role="menu"][data-state="open"]').waitFor({ state: "visible", timeout: 10_000 });
    results.manageLink = (await page.locator('[role="menu"][data-state="open"] a:has-text("Настроить точки")').count()) > 0;
    await page.screenshot({ path: path.join(OUT, "r2-13-prod-mobile-menu.png") });
    await page.keyboard.press("Escape");
    await page.goto(`${BASE}/mini/me`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    results.miniTopBar = (await page.locator("header >> text=E2E Точка").count()) > 0;
    await page.screenshot({ path: path.join(OUT, "r2-14-prod-mini-topbar.png") });
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-prod-mobile-error.png") }).catch(() => {});
  } finally {
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
