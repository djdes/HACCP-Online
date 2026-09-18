/* eslint-disable no-console */
// AC1, AC3, AC4 на dev 3020 (БД — туннель в прод, тестовая организация).
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ROOT = path.resolve(process.cwd(), ".agent/tasks/journal-time-edit-2026-09");
const OUT = path.join(ROOT, "shots");
fs.mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json"), "utf8")
) as { email: string; password: string };
const CLIMATE_DOC = "cmt6j45ne0hy482ts2ii5wkkd";
const VENT_DOC = "cmt6j45qy0hzf82ts36em34xh";
const INCOMING_DOC = "cmt6j45uq0i0e82tsvi4cnl97";
const results: Record<string, unknown> = {};
const errors: string[] = [];
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(OUT, `${n}.png`) });
const DIALOG = '[role="dialog"]';

async function settle(page: Page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  });
  const later = page.getByRole("button", { name: /Напомнить позже/ });
  if (await later.count()) await later.first().click().catch(() => {});
}
async function goto(page: Page, url: string) {
  await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 240_000 });
  await settle(page);
}

async function setClimateTime(page: Page, from: string, to: string) {
  const header = page.locator(`th button:has-text("${from}")`).first();
  await header.waitFor({ state: "visible", timeout: 60_000 });
  await header.click();
  const dialog = page.locator(DIALOG).filter({ hasText: "Время контроля" });
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  await dialog.locator('input[type="time"]').fill(to);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 60_000 });
  await page.locator(`th button:has-text("${to}")`).first().waitFor({ state: "visible", timeout: 60_000 });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`http ${r.status()} ${r.url().slice(0, 140)}`);
  });
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 240_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 240_000 });

    const tableToggle = page.getByRole("button", { name: /^Таблица$/ }).first();
    const cardsToggle = page.getByRole("button", { name: /^Карточки$/ }).first();
    // ---- AC1: климат
    if (process.env.SKIP_CLIMATE !== "1") {
    await goto(page, `/journals/climate_control/documents/${CLIMATE_DOC}`);
    await page.locator("table").first().waitFor({ state: "visible", timeout: 120_000 });
    if (await tableToggle.count()) await tableToggle.click().catch(() => {});
    await page.waitForTimeout(800);
    results.ac1_headerButtonsBefore = await page.locator('th button:has-text("10:00")').count();
    // Вносим замер температуры в первую строку под 10:00.
    const firstInput = page.locator('tbody input[type="number"]').first();
    await firstInput.waitFor({ state: "visible", timeout: 60_000 });
    await firstInput.fill("21.5");
    await firstInput.blur();
    await page.waitForTimeout(2000);
    await shot(page, "01-climate-before");
    await setClimateTime(page, "10:00", "09:30");
    await page.waitForTimeout(1000);
    await shot(page, "02-climate-after");
    results.ac1_headerAfter = {
      old: await page.locator('th button:has-text("10:00")').count(),
      new: await page.locator('th button:has-text("09:30")').count(),
      firstInputValue: await page.locator('tbody input[type="number"]').first().inputValue(),
    };
    // Проверяем через перезагрузку, что значение действительно под 09:30.
    await goto(page, `/journals/climate_control/documents/${CLIMATE_DOC}`);
    if (await tableToggle.count()) await tableToggle.click().catch(() => {});
    await page.waitForTimeout(800);
    results.ac1_afterReload = {
      header: await page.locator('th button:has-text("09:30")').count(),
      firstInputValue: await page.locator('tbody input[type="number"]').first().inputValue(),
    };
    // Мобильные чипы
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, `/journals/climate_control/documents/${CLIMATE_DOC}`);
    if (await cardsToggle.count()) await cardsToggle.click().catch(() => {});
    await page.waitForTimeout(800);
    results.ac1_mobileChips = await page.locator('button:has-text("09:30")').count();
    await shot(page, "03-climate-mobile-chips");
    await page.setViewportSize({ width: 1280, height: 900 });
    // Возвращаем 10:00 (замер должен переехать обратно).
    await goto(page, `/journals/climate_control/documents/${CLIMATE_DOC}`);
    if (await tableToggle.count()) await tableToggle.click().catch(() => {});
    await page.waitForTimeout(800);
    await setClimateTime(page, "09:30", "10:00");
    }

    // ---- AC3: вентиляция, автозаполнение выключено
    await goto(page, `/journals/cleaning_ventilation_checklist/documents/${VENT_DOC}`);
    if (await tableToggle.count()) await tableToggle.click().catch(() => {});
    await page.waitForTimeout(800);
    const combos = page.locator('tbody button[role="combobox"]');
    results.ac3_table = {
      total: await combos.count(),
      disabled: await page.locator('tbody button[role="combobox"][disabled], tbody button[role="combobox"][data-disabled]').count(),
      autofillSwitchChecked: await page.locator('button[role="switch"]').first().getAttribute("aria-checked"),
    };
    await shot(page, "04-vent-table");
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, `/journals/cleaning_ventilation_checklist/documents/${VENT_DOC}`);
    if (await cardsToggle.count()) await cardsToggle.click().catch(() => {});
    await page.waitForTimeout(800);
    // Карточки свёрнуты — раскрываем первую.
    const firstCard = page.getByText(/^№1 · /).first();
    await firstCard.waitFor({ state: "visible", timeout: 60_000 });
    await firstCard.click();
    const hint = page.getByText("нажмите, чтобы изменить время").first();
    await hint.waitFor({ state: "attached", timeout: 60_000 }).catch(() => {});
    results.ac3_cardsHint = await page.getByText("нажмите, чтобы изменить время").count();
    await hint.scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, "05-vent-cards");
    // Тап по процедуре открывает лист с полями времени.
    if (await hint.count()) {
      await hint.click();
      const sheet = page.locator(DIALOG).last();
      await sheet.waitFor({ state: "visible", timeout: 30_000 });
      results.ac3_sheetTimeInputs = await sheet.locator('input[type="time"]').count();
      await shot(page, "05b-vent-sheet");
      await page.keyboard.press("Escape");
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // ---- AC4: входной контроль — окно строки с полем времени
    await goto(page, `/journals/incoming_control/documents/${INCOMING_DOC}`);
    await page.getByRole("button", { name: /Добавить/ }).first().click();
    const menuItem = page.getByRole("menuitem", { name: /^Добавить$/ }).first();
    if (await menuItem.count()) await menuItem.click();
    const dialog = page.locator(DIALOG).filter({ hasText: "Добавление новой строки" });
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    results.ac4_timeField = {
      label: await dialog.getByText("Время поставки").count(),
      input: await dialog.locator('input[type="time"]').count(),
    };
    await shot(page, "06-incoming-dialog");
    await page.keyboard.press("Escape");
  } catch (error) {
    errors.push(`fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    await shot(page, "99-failure").catch(() => {});
  } finally {
    results.errors = errors;
    fs.writeFileSync(path.join(ROOT, "e2e/results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
  process.exit(errors.some((e) => e.startsWith("fatal")) ? 1 : 0);
}
void main();
