/* eslint-disable no-console */
// Быстрый ввод в окне бракеража (390px): дефолт −30 мин, чипы времени,
// чипы недавних блюд, «Сохранить и добавить ещё», раскладка даты/времени.
// BROWSER=webkit — движок Safari (ближе к iPhone), иначе Chromium.
import { chromium, webkit, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ROOT = path.resolve(process.cwd(), ".agent/tasks/names-memory-2026-09");
const OUT = path.join(ROOT, "shots");
const docs = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/docs.json"), "utf8")) as Record<string, { id: string } | null>;
const results: Record<string, unknown> = {};
const errors: string[] = [];
const engine = process.env.BROWSER === "webkit" ? "webkit" : "chromium";
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(OUT, `${engine}-${n}.png`) });
const DIALOG = '[role="dialog"]';
const DISH = `E2E Быстро ${Date.now().toString().slice(-5)}`;

function minutesBetween(a: string, b: string) {
  const parse = (v: string) => {
    const [d, t] = v.split(" ");
    return new Date(`${d}T${t}:00`).getTime();
  };
  return Math.round((parse(a) - parse(b)) / 60_000);
}
function nowValue(offsetMin: number) {
  const dt = new Date(Date.now() - offsetMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

async function settle(page: Page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
  const later = page.getByRole("button", { name: /Напомнить позже/ });
  if (await later.count()) await later.first().click().catch(() => {});
}
async function pairValue(dialog: ReturnType<Page["locator"]>, dateLabel: string, timeLabel: string) {
  const d = await dialog.getByLabel(dateLabel).inputValue();
  const t = await dialog.getByLabel(timeLabel).inputValue();
  return `${d} ${t}`;
}

async function main() {
  const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({ channel: "chrome" });
  // Сессия из login-state.ts — без повторных входов (лимитер 5/5 мин).
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: engine === "chromium",
    hasTouch: true,
    deviceScaleFactor: 2,
    storageState: path.join(ROOT, "e2e/state.json"),
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  try {

    await page.goto(`${BASE}/journals/finished_product/documents/${docs.finished_product!.id}`, { waitUntil: "load", timeout: 240_000 });
    await settle(page);
    await page.getByRole("button", { name: /^Добавить изделие$/ }).first().click();
    const dialog = page.locator(DIALOG).filter({ hasText: "Добавление новой строки" });
    await dialog.waitFor({ state: "visible", timeout: 30_000 });

    // Дефолт: изготовление ≈ сейчас − 30 мин, снятие ≈ сейчас.
    const production = await pairValue(dialog, "Дата изготовления", "Время изготовления");
    const rejection = await pairValue(dialog, "Дата снятия бракеража", "Время снятия бракеража");
    results.defaultProductionOffsetMin = minutesBetween(nowValue(0), production);
    results.defaultRejectionOffsetMin = minutesBetween(nowValue(0), rejection);

    // Раскладка даты/времени (все пары).
    results.pairs = await dialog.evaluate((el) => {
      const dates = Array.from(el.querySelectorAll('input[type="date"]')) as HTMLElement[];
      return dates.map((date) => {
        const time = date.parentElement?.querySelector('input[type="time"]') as HTMLElement | null;
        const d = date.getBoundingClientRect();
        const t = time?.getBoundingClientRect();
        const cs = getComputedStyle(date);
        return {
          dateW: Math.round(d.width), dateRight: Math.round(d.right),
          timeLeft: t ? Math.round(t.left) : null, timeRight: t ? Math.round(t.right) : null,
          overlap: t ? d.right > t.left + 0.5 : null, offscreen: t ? t.right > window.innerWidth : null,
          appearance: (cs as unknown as { webkitAppearance?: string }).webkitAppearance ?? cs.appearance,
          textAlign: cs.textAlign, height: Math.round(d.height),
        };
      });
    });
    results.formScroll = await dialog.locator("div.overflow-y-auto").first().evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    await shot(page, "10-defaults");

    // Чипы времени.
    const chips = dialog.getByRole("button", { name: /^(−15 мин|−30 мин|−45 мин|−1 ч)$/ });
    results.offsetChips = await chips.allInnerTexts();
    results.chip30Pressed = await dialog.getByRole("button", { name: "−30 мин" }).getAttribute("aria-pressed");
    await dialog.getByRole("button", { name: "−1 ч" }).click();
    results.afterHourChipOffsetMin = minutesBetween(nowValue(0), await pairValue(dialog, "Дата изготовления", "Время изготовления"));
    results.chipHourPressed = await dialog.getByRole("button", { name: "−1 ч" }).getAttribute("aria-pressed");
    // «Сейчас (и разрешение…)» у снятия.
    await dialog.getByRole("button", { name: /^Сейчас \(и разрешение/ }).click();
    const rel = await pairValue(dialog, "Дата разрешения", "Время разрешения");
    const rej = await pairValue(dialog, "Дата снятия бракеража", "Время снятия бракеража");
    results.rejectionEqualsRelease = rel === rej;

    // Недавние блюда чипами (список с прошлого прогона может быть пуст).
    results.recentChips = await dialog.locator('[aria-label="Недавние наименования"] button').allInnerTexts();

    // «Сохранить и добавить ещё».
    const name = dialog.getByRole("combobox", { name: "Наименование изделия" });
    await name.fill(DISH);
    await name.evaluate((el) => (el as HTMLElement).blur());
    const productionBefore = await pairValue(dialog, "Дата изготовления", "Время изготовления");
    await dialog.getByRole("button", { name: "Сохранить и добавить ещё" }).click();
    // Ждём, пока сохранение отработает и черновик очистится (до 10 с).
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(500);
      if ((await name.inputValue()) === "") break;
    }
    results.keepOpen = {
      stillOpen: await dialog.isVisible(),
      nameCleared: await name.inputValue(),
      productionKept: (await pairValue(dialog, "Дата изготовления", "Время изготовления")) === productionBefore,
      recentChipFirst: (await dialog.locator('[aria-label="Недавние наименования"] button').allInnerTexts())[0],
      rating: await dialog.getByRole("combobox", { name: "Органолептическая оценка" }).innerText(),
    };
    await shot(page, "11-after-save-more");
    // Чип недавнего блюда подставляет название.
    await dialog.locator('[aria-label="Недавние наименования"] button').first().click();
    results.chipSetsName = await name.inputValue();
    await page.keyboard.press("Escape");
  } catch (error) {
    errors.push(`fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    await shot(page, "99-failure-quick").catch(() => {});
  } finally {
    results.errors = errors;
    fs.writeFileSync(path.join(ROOT, `e2e/results-quick-${engine}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
  process.exit(errors.some((e) => e.startsWith("fatal")) ? 1 : 0);
}
void main();
