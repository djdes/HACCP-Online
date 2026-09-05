/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/shots");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const results: Record<string, unknown> = {};

async function lockState(page: Page) {
  return page.evaluate(() => ({
    scrollY: window.scrollY,
    bodyPosition: getComputedStyle(document.body).position,
    bodyTop: document.body.style.top,
  }));
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 758 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 200)));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });

    // --- profile modal: layout ---
    await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#complete-profile-form").waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1200);
    results.layout = await page.evaluate(() => {
      const form = document.getElementById("complete-profile-form")!;
      const rows = Array.from(form.children).map((el) => Math.round(el.getBoundingClientRect().height));
      const fields = Array.from(form.querySelectorAll("label > span:first-child, div > span:first-child")).filter((el) => (el as HTMLElement).className.includes("rounded-2xl border")).map((el) => Math.round(el.getBoundingClientRect().height));
      const header = form.previousElementSibling as HTMLElement;
      return {
        rows,
        fieldHeights: fields,
        allFieldsSameHeight: new Set(fields).size === 1,
        headerText: header?.innerText.replace(/\s+/g, " ").trim(),
        promoText: (document.querySelector('a[href*="tasksflow"]')?.closest("div")?.parentElement as HTMLElement | null)?.innerText.replace(/\s+/g, " ").trim(),
        fits: form.scrollHeight <= form.clientHeight + 1,
        formScroll: { scrollHeight: form.scrollHeight, clientHeight: form.clientHeight },
      };
    });
    await page.screenshot({ path: path.join(OUT, "05-mobile-v2.png") });

    // --- profile modal: scroll lock ---
    results.lockWhileOpen = await lockState(page);
    await page.mouse.move(200, 100);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
    results.afterWheelWhileOpen = await lockState(page);
    await page.locator('button[aria-label="Закрыть"]').first().click();
    await page.waitForTimeout(400);
    results.afterClose = await lockState(page);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(500);
    results.afterWheelWhenClosed = await lockState(page);

    // --- fill guide dialog on /journals/hygiene: shared lock path ---
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const btn = page.locator('button:has-text("Как заполнить?")').first();
    await btn.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const dialog = page.locator('[role="dialog"][aria-labelledby="fill-guide-title"]');
    if ((await dialog.count()) === 0) await btn.click();
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(400);
    results.guideLockWhileOpen = await lockState(page);
    await page.mouse.move(200, 60);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
    results.guideAfterWheel = await lockState(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    results.guideAfterClose = await lockState(page);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    results.guideAfterWheelWhenClosed = await lockState(page);
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error-v2.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/results-v2.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
