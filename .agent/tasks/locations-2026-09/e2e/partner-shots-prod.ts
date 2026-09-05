/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
const BASE = "https://wesetup.ru";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "smoke");
const partner = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/creds.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/state.json"), "utf8"));
const results: Record<string, unknown> = {};
async function shot(page: Page, name: string) { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); }
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
    results.open = (await page.request.post(`${BASE}/api/partner/clients/${state.org}/open`)).status();
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2000);
    results.pill = (await page.locator('[data-tour="location-switcher"]').innerText().catch(() => "")).trim();
    await shot(page, "12-desktop-partner-cabinet");
    await page.locator('[data-tour="location-switcher"]').click();
    await page.locator('[role="menu"][data-state="open"] [role="menuitem"]', { hasText: "E2E Точка Б" }).click();
    await page.waitForTimeout(3000);
    results.pillAfterSwitch = (await page.locator('[data-tour="location-switcher"]').innerText().catch(() => "")).trim();
    const docs = await (await page.request.get(`${BASE}/api/journal-documents?templateCode=hygiene&status=active`)).json() as { documents?: Array<{ title: string }> };
    results.docsAtB = (docs.documents ?? []).filter((d) => d.title.startsWith("E2E")).map((d) => d.title);
    await shot(page, "13-desktop-partner-after-switch");
    await page.goto(`${BASE}/settings/buildings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    await shot(page, "28-desktop-partner-settings-buildings");
    await page.locator('button[role="switch"][aria-label="Вести журналы отдельно по точкам"]').click().catch(() => {});
    await page.waitForTimeout(1500);
    results.toggleToastText = (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).join(" | ");
    await shot(page, "29-desktop-partner-toggle-denied");
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    await shot(page, "26-mobile-partner-cabinet");
    await page.locator("button:has(svg.lucide-menu)").first().click();
    await page.waitForTimeout(700);
    await shot(page, "27-mobile-partner-menu");
    results.exit = (await page.request.post(`${BASE}/api/partner/exit`)).status();
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-partner-prod-error.png") }).catch(() => {});
  } finally {
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(DIR, "e2e/partner-prod-results.json"), JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
