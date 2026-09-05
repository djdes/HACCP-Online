/* eslint-disable no-console */
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:3020";
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const log: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") log.push("console: " + m.text().slice(0, 160)); });
  page.on("response", (r) => { if (r.url().includes("/api/mini/home") || r.url().includes("/api/me/active-building")) log.push(`resp ${r.status()} ${r.url().replace(BASE, "")}`); });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
  await page.goto(`${BASE}/mini/me`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const found = await page.locator("text=E2E Точка Б").first().waitFor({ state: "visible", timeout: 45_000 }).then(() => true).catch(() => false);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
  await page.screenshot({ path: ".agent/tasks/locations-2026-09/shots/06-mini-me.png" });
  let switched: string | null = null;
  if (found) {
    await page.locator("button", { hasText: "E2E Точка Б" }).first().click();
    await page.waitForTimeout(2500);
    const cookies = await ctx.cookies(BASE);
    switched = cookies.find((c) => c.name === "wesetup.building")?.value ?? null;
    await page.goto(`${BASE}/mini`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("text=E2E Точка Б").first().waitFor({ state: "visible", timeout: 45_000 }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    await page.screenshot({ path: ".agent/tasks/locations-2026-09/shots/08-mini-home-chip.png" });
  }
  console.log(JSON.stringify({ found, switched, log }, null, 2));
  await browser.close();
})();
