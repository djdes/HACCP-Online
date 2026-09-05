/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/shots");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const results: Record<string, unknown> = {};

async function measure(page: Page) {
  return page.evaluate(() => {
    const form = document.getElementById("complete-profile-form") as HTMLElement | null;
    const modal = form?.closest(".rounded-3xl") as HTMLElement | null;
    const pw = document.querySelector<HTMLInputElement>('input[autocomplete="new-password"]');
    const r = modal?.getBoundingClientRect();
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      modal: r ? { top: r.top, bottom: r.bottom, height: r.height } : null,
      formScroll: form ? { scrollHeight: form.scrollHeight, clientHeight: form.clientHeight, fits: form.scrollHeight <= form.clientHeight + 1 } : null,
      password: pw?.value ?? null,
      rows: Array.from(document.querySelectorAll("#complete-profile-form > *")).map((el) => Math.round(el.getBoundingClientRect().height)),
    };
  });
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

    await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#complete-profile-form").waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1200);
    results.m758 = await measure(page);
    await page.screenshot({ path: path.join(OUT, "01-mobile-758.png") });

    // regenerate changes the password
    const before = (results.m758 as { password: string }).password;
    await page.locator('button[aria-label="Подобрать другой пароль"]').click();
    await page.waitForTimeout(200);
    const after = await page.locator('input[autocomplete="new-password"]').inputValue();
    results.regenerate = { before, after, changed: before !== after, pattern: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!?#*+=@]).{6}$/.test(after) };

    // uncheck employee -> position field hides
    await page.locator('label:has-text("Я сотрудник") input[type="checkbox"]').click();
    await page.waitForTimeout(200);
    results.positionHiddenWhenUnchecked = (await page.locator('label:has-text("Должность")').count()) === 0;
    await page.screenshot({ path: path.join(OUT, "02-mobile-unchecked.png") });
    await page.locator('label:has-text("Я сотрудник") input[type="checkbox"]').click();

    // fill required -> status line
    await page.locator('input[placeholder="ООО «Ромашка»"]').fill("Кафе Тестовое 1");
    await page.locator('input[inputmode="tel"]').fill("+7 999 123-45-67");
    await page.waitForTimeout(200);
    results.statusAllFilled = (await page.locator('text=Всё заполнено').count()) > 0;
    results.submitEnabled = await page.locator('button[type="submit"][form="complete-profile-form"]').isEnabled();
    await page.screenshot({ path: path.join(OUT, "03-mobile-filled.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    results.m844 = await measure(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    results.desktop = await measure(page);
    await page.screenshot({ path: path.join(OUT, "04-desktop.png") });
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
