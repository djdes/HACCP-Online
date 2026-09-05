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
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });

    // --- modal: header, idle icon, person autofill ---
    await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const dialog = page.locator('[role="dialog"][aria-labelledby="complete-profile-title"]');
    await dialog.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(800);
    results.header = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-labelledby="complete-profile-title"]') as HTMLElement;
      const header = d.querySelector("h2")!.closest("div.flex.shrink-0") as HTMLElement;
      const cs = getComputedStyle(header);
      return { borderBottom: cs.borderBottomWidth, idleIcon: !!d.querySelector('svg[aria-label="Подставим данные из ЕГРЮЛ по ИНН"]') };
    });
    const inn = dialog.locator('input[placeholder="7701234567"]');
    await inn.click();
    await page.keyboard.type("7707083893", { delay: 30 });
    await dialog.locator('svg[aria-label="Найдено в ЕГРЮЛ"]').waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(400);
    results.autofill = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-labelledby="complete-profile-title"]') as HTMLElement;
      return {
        org: (d.querySelector('input[placeholder="ООО «Ромашка»"]') as HTMLInputElement).value,
        person: (d.querySelector('input[placeholder="Мария Иванова"]') as HTMLInputElement).value,
        position: (d.querySelector('input[list="owner-position-suggestions"]') as HTMLInputElement).value,
      };
    });
    await page.screenshot({ path: path.join(OUT, "10-inn-person.png") });

    // --- settings: legal profile section ---
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/settings/organization`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    results.settingsUrl = page.url();
    const section = page.locator('h2:has-text("Данные из ЕГРЮЛ")');
    results.sectionVisible = await section.waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    if (results.sectionVisible) {
      const innInput = page.locator('input[placeholder="7700123456"]');
      await innInput.fill("7707083893");
      const findBtn = page.locator('button:has-text("Найти")').first();
      await findBtn.click();
      await page.locator('dt:has-text("ОГРН")').waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(800);
      results.legalRows = await page.evaluate(() =>
        Array.from(document.querySelectorAll("dl dt")).map((dt) => `${dt.textContent?.trim()}: ${(dt.nextElementSibling as HTMLElement | null)?.innerText.trim().slice(0, 70)}`)
      );
      await page.locator('h2:has-text("Данные из ЕГРЮЛ")').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(OUT, "11-settings-legal.png") });
      // refresh button works
      const refresh = page.locator('button:has-text("Обновить из ЕГРЮЛ")');
      await refresh.click();
      await page.waitForTimeout(2500);
      results.refreshToast = await page.evaluate(() => Array.from(document.querySelectorAll("[data-sonner-toast]")).map((t) => (t as HTMLElement).innerText.trim()));
    }
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error-legal.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/results-legal.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
