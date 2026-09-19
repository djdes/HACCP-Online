/* eslint-disable no-console */
// AC1–AC6 на dev 3020 (БД — туннель в прод, тестовая организация).
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ROOT = path.resolve(process.cwd(), ".agent/tasks/names-memory-2026-09");
const OUT = path.join(ROOT, "shots");
fs.mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json"), "utf8")
) as { email: string; password: string };
const docs = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/docs.json"), "utf8")) as Record<
  string,
  { id: string; title: string } | null
>;
const results: Record<string, unknown> = {};
const errors: string[] = [];
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(OUT, `${n}.png`) });
const DIALOG = '[role="dialog"]';
const DISH = `E2E Блюдо ${Date.now().toString().slice(-5)}`;
const PRODUCT = `E2E Продукт ${Date.now().toString().slice(-5)}`;

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
async function openAdd(page: Page, dialogTitle: string) {
  const direct = page.getByRole("button", { name: /^Добавить (изделие|строку)$/ }).first();
  if (await direct.count()) {
    await direct.click();
  } else {
    await page.getByRole("button", { name: /Добавить/ }).first().click();
    await page.waitForTimeout(600);
    // Если окно строки уже открылось — ничего внутри него не нажимаем.
    if ((await page.locator(DIALOG).filter({ hasText: dialogTitle }).count()) === 0) {
      // Dropdown на ПК или нижний лист на телефоне — пункт «Добавить…».
      const item = page
        .locator('[role="menuitem"], [role="dialog"] button')
        .filter({ hasText: /^Добавить( изделие| строку)?$/ })
        .first();
      if (await item.count()) await item.click();
    }
  }
  const dialog = page.locator(DIALOG).filter({ hasText: dialogTitle });
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  return dialog;
}
async function suggestOptions(dialog: ReturnType<Page["locator"]>, label: string) {
  const input = dialog.getByRole("combobox", { name: label });
  await input.click();
  await dialog.page().waitForTimeout(400);
  const options = await dialog.getByRole("listbox", { name: new RegExp(label) }).getByRole("option").allInnerTexts();
  // Escape закрыл бы всё окно (Radix слушает document) — снимаем фокус.
  await input.evaluate((el) => (el as HTMLElement).blur());
  return options;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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

    // ---- AC3/AC4/AC5 + AC1 (бракераж, 390px)
    const fp = docs.finished_product!;
    await goto(page, `/journals/finished_product/documents/${fp.id}`);
    const dialog = await openAdd(page, "Добавление");
    const form = dialog.locator("div.overflow-y-auto").first();
    results.ac3_overflow = await form.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
    results.ac3_dateTime = await dialog.evaluate((el) => {
      const date = el.querySelector('input[type="date"]') as HTMLElement | null;
      const time = el.querySelector('input[type="time"]') as HTMLElement | null;
      if (!date || !time) return null;
      const d = date.getBoundingClientRect();
      const t = time.getBoundingClientRect();
      return { dateRight: Math.round(d.right), timeLeft: Math.round(t.left), overlap: d.right > t.left + 0.5, timeRight: Math.round(t.right), viewport: window.innerWidth };
    });
    const yes = dialog.getByRole("radio", { name: "Да" });
    const no = dialog.getByRole("radio", { name: "Нет" });
    results.ac4_default = { yes: await yes.getAttribute("aria-checked"), no: await no.getAttribute("aria-checked"), yesHasCheck: (await yes.locator("svg").count()) > 0 };
    results.ac5_rating = await dialog.getByRole("combobox", { name: "Органолептическая оценка" }).innerText();
    await shot(page, "01-fp-dialog");
    await no.click();
    results.ac4_afterClick = { yes: await yes.getAttribute("aria-checked"), no: await no.getAttribute("aria-checked") };
    await yes.click();
    // Наименование → сохранить → запомнилось
    const nameInput = dialog.getByRole("combobox", { name: "Наименование изделия" });
    await nameInput.fill(DISH);
    await nameInput.evaluate((el) => (el as HTMLElement).blur());
    await dialog.getByRole("button", { name: /Добавить запись|Сохранить/ }).first().click();
    await dialog.waitFor({ state: "hidden", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const api = await (await page.request.get(`${BASE}/api/name-suggestions?scope=dish`)).json();
    results.ac1_apiFirst = (api.values as string[])[0];
    // В другом окне (повторно открыть) — первым в списке
    const dialog2 = await openAdd(page, "Добавление");
    results.ac1_listFirst = (await suggestOptions(dialog2, "Наименование изделия"))[0];
    await shot(page, "02-fp-suggest");
    await page.keyboard.press("Escape");
    await dialog2.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});

    // Интенсивное охлаждение — то же блюдо первым
    if (docs.intensive_cooling) {
      await goto(page, `/journals/intensive_cooling/documents/${docs.intensive_cooling.id}`);
      const ic = await openAdd(page, "строки");
      results.ac1_icFirst = (await suggestOptions(ic, "Наименование блюда"))[0];
      await shot(page, "03-ic-suggest");
      await page.keyboard.press("Escape");
    }

    // ---- AC2: скоропорт → входной контроль
    if (docs.perishable_rejection) {
      await goto(page, `/journals/perishable_rejection/documents/${docs.perishable_rejection.id}`);
      const pr = await openAdd(page, "строки");
      const prName = pr.getByRole("combobox", { name: "Наименование изделия" });
      await prName.fill(PRODUCT);
      await prName.evaluate((el) => (el as HTMLElement).blur());
      results.ac2_prButtons = {
        compliant: await pr.getByRole("radio", { name: "Соответствует", exact: true }).getAttribute("aria-checked"),
        non: await pr.getByRole("radio", { name: "Не соответствует" }).getAttribute("aria-checked"),
      };
      await shot(page, "04-pr-dialog");
      await pr.getByRole("button", { name: /Добавить|Сохранить/ }).last().click();
      await pr.waitFor({ state: "hidden", timeout: 60_000 });
      await page.waitForTimeout(1500);
      const api2 = await (await page.request.get(`${BASE}/api/name-suggestions?scope=product`)).json();
      results.ac2_apiFirst = (api2.values as string[])[0];
    }
    if (docs.incoming_control) {
      await goto(page, `/journals/incoming_control/documents/${docs.incoming_control.id}`);
      const inc = await openAdd(page, "Добавление новой строки");
      results.ac2_incomingFirst = await inc.locator("button", { hasText: /E2E Продукт|Продукт/ }).first().innerText().catch(() => null);
      results.ac2_incomingListHead = (await inc.locator('button:has(span.font-medium)').allInnerTexts()).slice(0, 2);
      await shot(page, "05-incoming-dialog");
      await page.keyboard.press("Escape");
    }

    // ---- AC6: Mini App
    await goto(page, `/mini/documents/${fp.id}`);
    for (let i = 0; i < 3; i += 1) {
      const tour = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: "задачи на сегодня" });
      if ((await tour.count()) === 0) break;
      await tour.locator("button").first().click().catch(() => {});
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
    const mini = await openAdd(page, "Добавление");
    results.ac6_mini = {
      overflow: await mini.locator("div.overflow-y-auto").first().evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })),
      yes: await mini.getByRole("radio", { name: "Да" }).getAttribute("aria-checked"),
      rating: await mini.getByRole("combobox", { name: "Органолептическая оценка" }).innerText(),
      firstSuggestion: (await suggestOptions(mini, "Наименование изделия"))[0],
    };
    await shot(page, "06-mini-dialog");
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
