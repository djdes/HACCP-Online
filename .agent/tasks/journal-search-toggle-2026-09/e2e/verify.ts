// Проверка трёх правок: поиск по журналам на дашборде и в наборе,
// индикатор вкл/выкл на странице журнала, кнопка «назад» у крошек.
// Запуск: WESETUP_ROOT_PW='…' npx tsx .agent/tasks/journal-search-toggle-2026-09/e2e/verify.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

/** ООО БФС — организация с реальным набором журналов. */
const ORG_ID = "cmtbo1xnc00848ctszzywbwwq";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function settle(page: Page, ms = 2500) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
}

async function main() {
  const password = process.env.WESETUP_ROOT_PW;
  if (!password) throw new Error("WESETUP_ROOT_PW не задан");
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await context.addInitScript("window.__name = (fn) => fn;");
    const page = await context.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: "load" });
    for (let i = 0; i < 40; i += 1) {
      await page.fill("#email", "Admin@wesetup.ru");
      await page.fill("#password", password);
      if ((await page.inputValue("#email")) === "Admin@wesetup.ru") break;
      await page.waitForTimeout(300);
    }
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });

    await page.goto(`${BASE}/root/organizations/${ORG_ID}`, { waitUntil: "load" });
    await settle(page);
    const enter = page.locator("button", { hasText: /Войти как/ }).first();
    if (await enter.count()) {
      await enter.click();
      await page.waitForTimeout(5000);
    }

    // ---------- 1. Поиск на дашборде ----------
    await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
    await settle(page, 4000);
    const dashSearch = page.getByLabel("Поиск по журналам").first();
    record("дашборд: поле поиска есть", await dashSearch.isVisible().catch(() => false));
    await page.screenshot({ path: path.join(SHOTS, "01-dashboard.png") });

    await dashSearch.fill("гигиен");
    await page.waitForTimeout(900);
    const dashText = await page.evaluate(() => document.body.innerText);
    record("дашборд: фильтрация работает", /Найдено \d+ из \d+/.test(dashText), dashText.match(/Найдено \d+ из \d+/)?.[0]);
    await page.screenshot({ path: path.join(SHOTS, "02-dashboard-search.png") });

    // Отключённый журнал должен находиться и предлагать включение.
    await dashSearch.fill("бракераж");
    await page.waitForTimeout(1000);
    const disabledBlock = await page.evaluate(() => document.body.innerText.includes("Отключённые"));
    record("дашборд: отключённые в результатах", disabledBlock);
    await page.screenshot({ path: path.join(SHOTS, "03-dashboard-disabled.png") });

    // ---------- 2. Поиск в наборе ----------
    await page.goto(`${BASE}/settings/journals`, { waitUntil: "load" });
    await settle(page, 4000);
    const setSearch = page.getByLabel("Поиск по набору журналов").first();
    record("набор: поле поиска есть", await setSearch.isVisible().catch(() => false));
    await setSearch.fill("темпер");
    await page.waitForTimeout(1000);
    const setText = await page.evaluate(() => document.body.innerText);
    record("набор: фильтрация работает", /Найдено \d+ из \d+/.test(setText), setText.match(/Найдено \d+ из \d+/)?.[0]);
    await page.screenshot({ path: path.join(SHOTS, "04-set-search.png") });

    // ---------- 3. Индикатор на странице журнала ----------
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "load" });
    await settle(page, 4000);
    const indicator = page.locator("button", { hasText: /Включён|Отключён/ }).first();
    record("журнал: индикатор рядом с заголовком", await indicator.isVisible().catch(() => false));
    await page.screenshot({ path: path.join(SHOTS, "05-journal-header.png") });

    if (await indicator.isVisible().catch(() => false)) {
      await indicator.click();
      await page.waitForTimeout(900);
      const dialogText = await page.evaluate(
        () => (document.querySelector('[role="dialog"]') as HTMLElement | null)?.innerText ?? "",
      );
      record("журнал: окно подтверждения открылось", dialogText.includes("Отключить журнал"), dialogText.slice(0, 60));
      await page.screenshot({ path: path.join(SHOTS, "06-journal-confirm.png") });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Та же модалка на телефоне — шторкой снизу.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "load" });
    await settle(page, 4000);
    const mIndicator = page.locator("button", { hasText: /Включён|Отключён/ }).first();
    if (await mIndicator.isVisible().catch(() => false)) {
      await mIndicator.click();
      await page.waitForTimeout(900);
      const atBottom = await page.evaluate(() => {
        const card = document.querySelector('[role="dialog"] > div') as HTMLElement | null;
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        return Math.round(window.innerHeight - rect.bottom);
      });
      record("телефон: подтверждение — шторка снизу", atBottom !== null && atBottom <= 2, `отступ снизу ${atBottom}px`);
      await page.screenshot({ path: path.join(SHOTS, "07-journal-sheet-mobile.png") });
      await page.keyboard.press("Escape");
    }

    // ---------- 4. Кнопка «назад» ----------
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto(`${BASE}/settings/journals`, { waitUntil: "load" });
    await settle(page, 3000);
    const nav = await page.evaluate(() => {
      const back = document.querySelector('button[aria-label="Назад"]') as HTMLElement | null;
      const crumbs = document.querySelector('nav[aria-label="Хлебные крошки"]') as HTMLElement | null;
      if (!back || !crumbs) return null;
      const b = back.getBoundingClientRect();
      const c = crumbs.getBoundingClientRect();
      return {
        sameRow: Math.abs(Math.round(b.top + b.height / 2) - Math.round(c.top + c.height / 2)) <= 4,
        gap: Math.round(c.left - b.right),
        round: getComputedStyle(back).borderRadius,
      };
    });
    record("настройки: кнопка в одной строке с крошками", Boolean(nav?.sameRow), JSON.stringify(nav));
    await page.screenshot({ path: path.join(SHOTS, "08-back-settings.png") });

    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "load" });
    await settle(page, 3000);
    const navJournal = await page.evaluate(() => {
      const back = document.querySelector('button[aria-label="Назад"]') as HTMLElement | null;
      const crumbs = document.querySelector('nav[aria-label="Хлебные крошки"]') as HTMLElement | null;
      if (!back || !crumbs) return null;
      const b = back.getBoundingClientRect();
      const c = crumbs.getBoundingClientRect();
      return {
        sameRow: Math.abs(Math.round(b.top + b.height / 2) - Math.round(c.top + c.height / 2)) <= 4,
        gap: Math.round(c.left - b.right),
      };
    });
    record("журнал: кнопка в одной строке с крошками", Boolean(navJournal?.sameRow), JSON.stringify(navJournal));
    await page.screenshot({ path: path.join(SHOTS, "09-back-journal.png") });

    fs.writeFileSync(path.join(HERE, "verify.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== ${checks.length - failed.length}/${checks.length} ===`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
