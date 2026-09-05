/* eslint-disable no-console */
// Прод после третьего круга: proxy, сводка по точкам, бейдж «Общий», Mini App.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://wesetup.ru";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "smoke");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/state.json"), "utf8"));
const results: Record<string, unknown> = {};

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    const slash = await page.request.get(`${BASE}/journals/hygiene/`, { maxRedirects: 0 });
    results.proxyTrailingSlash = `${slash.status()} -> ${slash.headers()["location"] ?? ""}`;
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    await page.request.post(`${BASE}/api/me/notices`, { data: { key: "fill-guide:hygiene" } });
    await page.request.post(`${BASE}/api/me/active-building`, { data: { buildingId: state.buildingA } });

    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2000);
    const strip = page.locator('section[aria-label="Сводка по точкам"]');
    results.dashboardStrip = await strip.isVisible().catch(() => false);
    await shot(page, "r3-07-prod-dashboard-strip");

    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    results.sharedBadges = await page.locator("text=Общий").count();
    await shot(page, "r3-08-prod-shared-badge");

    await page.request.get(`${BASE}/api/mini/home`);
    const t0 = Date.now();
    const home = await page.request.get(`${BASE}/api/mini/home`);
    results.miniHomeSecondMs = Date.now() - t0;
    results.miniHomeStatus = home.status();

    await page.goto(`${BASE}/settings/buildings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    results.staffSection = (await page.locator("text=Сотрудники точки").count()) > 0;
    await shot(page, "r3-09-prod-point-card");

    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2000);
    await shot(page, "r3-10-prod-mobile-dashboard");
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-prod3-error.png") }).catch(() => {});
  } finally {
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(DIR, "e2e/prod-verify3-results.json"), JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
