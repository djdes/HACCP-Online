/* eslint-disable no-console */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const BASE = "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/shots");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 758 } })).newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#email").fill(creds.email); await page.locator("#password").fill(creds.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
  await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#complete-profile-form").waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const overlays = () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("div.fixed.inset-0")).filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed").map((el) => ({ cls: el.className.slice(0, 80), text: el.innerText.replace(/\s+/g, " ").slice(0, 60) })));
  console.log("overlays while open:", JSON.stringify(await overlays(), null, 1));
  console.log("close buttons:", JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('button[aria-label="Закрыть"]')).map((b) => (b.closest("[role=dialog]")?.getAttribute("aria-labelledby") ?? b.parentElement?.className.slice(0, 50))))));
  await page.locator('[role="dialog"][aria-labelledby="complete-profile-title"] button[aria-label="Закрыть"]').click();
  await page.waitForTimeout(500);
  console.log("profile modal still present:", (await page.locator("#complete-profile-form").count()) > 0);
  console.log("overlays after close:", JSON.stringify(await overlays(), null, 1));
  console.log("body:", await page.evaluate(() => ({ position: getComputedStyle(document.body).position, style: document.body.getAttribute("style") })));
  await page.screenshot({ path: path.join(OUT, "06-after-close.png") });
  await page.mouse.wheel(0, 600); await page.waitForTimeout(400);
  console.log("scrollY after wheel:", await page.evaluate(() => window.scrollY));
  await browser.close();
}
main();
