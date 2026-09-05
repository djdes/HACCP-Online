/* eslint-disable no-console */
// Партнёр уровня «просмотр» в кабинете клиента с точками.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "smoke");
const partner = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/creds.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/state.json"), "utf8"));
const results: Record<string, unknown> = {};

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function api(page: Page, method: "get" | "post" | "patch", url: string, data?: unknown) {
  const res = await page.request[method](`${BASE}${url}`, data === undefined ? undefined : { data });
  return { status: res.status(), json: await res.json().catch(() => null) };
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(partner.email);
    await page.locator("#password").fill(partner.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });

    results.open = (await api(page, "post", `/api/partner/clients/${state.org}/open`)).status;
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    const body = await page.evaluate(() => document.body.innerText);
    results.bannerVisible = /консультант|партн/i.test(body.slice(0, 1500));
    results.pill = (await page.locator('[data-tour="location-switcher"]').innerText().catch(() => "")).trim();
    await shot(page, "12-desktop-partner-cabinet");

    results.switchBuilding = (await api(page, "post", "/api/me/active-building", { buildingId: state.buildingB })).status;
    results.createBuilding = (await api(page, "post", "/api/settings/buildings", { name: "Партнёрская точка" })).status;
    results.toggleFlag = (await api(page, "patch", "/api/settings/buildings", { perLocationJournals: false })).status;
    results.createDocument = (await api(page, "post", "/api/journal-documents", { templateCode: "hygiene", dateFrom: "2026-10-01", dateTo: "2026-10-15" })).status;
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2000);
    results.pillAfterSwitch = (await page.locator('[data-tour="location-switcher"]').innerText().catch(() => "")).trim();
    const docs = (await api(page, "get", "/api/journal-documents?templateCode=hygiene&status=active")).json as { documents?: Array<{ title: string }> } | null;
    results.docsAtB = (docs?.documents ?? []).filter((d) => d.title.startsWith("E2E")).map((d) => d.title);
    await shot(page, "13-desktop-partner-after-switch");

    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    await shot(page, "26-mobile-partner-cabinet");
    await page.goto(`${BASE}/settings/buildings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    results.settingsAsPartnerUrl = page.url().replace(BASE, "");
    await shot(page, "27-mobile-partner-settings-buildings");
    results.exit = (await api(page, "post", "/api/partner/exit")).status;
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-partner-error.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(DIR, "e2e/partner-results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
