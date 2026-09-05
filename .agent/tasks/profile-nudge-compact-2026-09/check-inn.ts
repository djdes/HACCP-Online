/* eslint-disable no-console */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const BASE = "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/shots");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const results: Record<string, unknown> = {};
async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 758 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  try {
    // API directly (public route)
    const ok = await page.request.get(`${BASE}/api/public/inn-lookup?inn=7707083893`);
    results.apiSber = { status: ok.status(), body: await ok.json().catch(() => null) };
    const bad = await page.request.get(`${BASE}/api/public/inn-lookup?inn=1234567890`);
    results.apiChecksum = { status: bad.status(), body: await bad.json().catch(() => null) };
    const ip = await page.request.get(`${BASE}/api/public/inn-lookup?inn=500100732259`);
    results.apiIp = { status: ip.status(), body: await ip.json().catch(() => null) };

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email); await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const dialog = page.locator('[role="dialog"][aria-labelledby="complete-profile-title"]');
    await dialog.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(800);
    const inn = dialog.locator('input[placeholder="7701234567"]');
    await inn.click();
    await page.keyboard.type("7707083893", { delay: 30 });
    await dialog.locator('svg[aria-label="Найдено в ЕГРЮЛ"]').waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);
    results.afterLookup = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-labelledby="complete-profile-title"]') as HTMLElement;
      const name = (d.querySelector('input[placeholder="ООО «Ромашка»"]') as HTMLInputElement).value;
      const selects = Array.from(d.querySelectorAll("select")).map((s) => (s as HTMLSelectElement).value);
      const found = !!d.querySelector('svg[aria-label="Найдено в ЕГРЮЛ"]');
      const toast = Array.from(document.querySelectorAll("[data-sonner-toast]")).map((t) => (t as HTMLElement).innerText.trim());
      return { name, selects, found, toast };
    });
    await page.screenshot({ path: path.join(OUT, "09-inn-autofill.png") });
    // custom name must survive a second lookup
    const nameInput = dialog.locator('input[placeholder="ООО «Ромашка»"]');
    await nameInput.fill("Моё кафе");
    await inn.fill("");
    await inn.type("7728168971", { delay: 30 });
    await page.waitForTimeout(2500);
    results.customNameKept = await nameInput.inputValue();
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error-inn.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/results-inn.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
