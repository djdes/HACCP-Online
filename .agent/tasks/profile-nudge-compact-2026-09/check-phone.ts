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
  const page = await (await browser.newContext({ viewport: { width: 390, height: 758 }, deviceScaleFactor: 2 })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email); await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const phone = page.locator('[role="dialog"][aria-labelledby="complete-profile-title"] input[inputmode="tel"]');
    await phone.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(800);
    await phone.click();
    results.afterFocus = await phone.inputValue();
    await page.keyboard.type("9991234567", { delay: 20 });
    results.afterTyping = await phone.inputValue();
    await page.screenshot({ path: path.join(OUT, "08-phone-typed.png") });
    await page.keyboard.type("5");
    results.extraDigitIgnored = await phone.inputValue();
    for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
    results.afterBackspace3 = await phone.inputValue();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("89851234567", { delay: 10 });
    results.localFormatTyped = await phone.inputValue();
    await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
    results.afterClearAll = await phone.inputValue();
    await page.locator('input[placeholder="ООО «Ромашка»"]').click();
    await page.waitForTimeout(200);
    results.afterBlurEmpty = await phone.inputValue();
    await phone.click();
    results.refocusSeeds = await phone.inputValue();
    await page.locator('input[placeholder="ООО «Ромашка»"]').click();
    await page.waitForTimeout(200);
    results.blurPrefixOnlyClears = await phone.inputValue();
    // paste
    await phone.click();
    await page.evaluate(async () => { await navigator.clipboard.writeText("+7 (912) 000-11-22").catch(() => {}); });
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("+7 (912) 000-11-22");
    results.pasteFormatted = await phone.inputValue();
    // invite dialog (Radix Input) on /settings/users
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/settings/users`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const tel = page.locator('input[inputmode="tel"]').first();
    const hasTel = await tel.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
    results.settingsUsersTelVisible = hasTel;
    if (hasTel) { await tel.click(); results.settingsUsersAfterFocus = await tel.inputValue(); await page.keyboard.type("9161112233"); results.settingsUsersTyped = await tel.inputValue(); }
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error-phone.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/results-phone.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
