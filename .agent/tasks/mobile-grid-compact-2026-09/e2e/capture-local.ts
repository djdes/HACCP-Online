// Тот же снимок, что и capture.ts, но против локального dev-сервера —
// чтобы итерировать по вёрстке без деплоя. База та же (туннель в прод),
// поэтому только чтение.
// Запуск: WESETUP_ROOT_PW='…' npx tsx .agent/tasks/mobile-grid-compact-2026-09/e2e/capture-local.ts after
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const TAG = process.argv[2] ?? "after";
const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const ORG_ID = "cmtbo1xnc00848ctszzywbwwq";
const JOURNALS: Record<string, string> = {
  cold: "/journals/cold_equipment_control/documents/cmthyn4p003ychrtskrpvp5px",
  cleaning: "/journals/cleaning/documents/cmtmmj2jy000nr2tst9d7f2h0",
  hygiene: "/journals/hygiene/documents/cmti2xbju043ihrtspr69q3iu",
};
const JOURNAL = process.argv[3] ?? "cold";
const DOC_PATH = JOURNALS[JOURNAL] ?? JOURNALS.cold;

const VIEWPORTS = [
  { w: 932, h: 430, tag: "phone-landscape" },
  { w: 390, h: 844, tag: "phone-portrait" },
  { w: 768, h: 1024, tag: "tablet" },
  { w: 1440, h: 900, tag: "desktop" },
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const pan = document.querySelector("[data-journal-doc-pan]") as HTMLElement | null;
    const sheet = document.querySelector("[data-journal-grid-sheet]") as HTMLElement | null;
    const table = document.querySelector("table[data-journal-grid]") as HTMLElement | null;
    const label = document.querySelector("th[data-grid-label]") as HTMLElement | null;
    const day = document.querySelector("th[data-grid-day]") as HTMLElement | null;
    const viewport = doc.clientWidth;
    const tableWidth = table ? Math.round(table.getBoundingClientRect().width) : null;
    return {
      viewport,
      tableWidth,
      sideScroll: tableWidth ? Math.max(0, tableWidth - viewport) : null,
      panScroll: pan ? pan.scrollWidth - pan.clientWidth : null,
      sheetWidth: sheet ? Math.round(sheet.getBoundingClientRect().width) : null,
      labelWidth: label ? Math.round(label.getBoundingClientRect().width) : null,
      dayWidth: day ? Math.round(day.getBoundingClientRect().width) : null,
    };
  });
}

async function main() {
  const password = process.env.WESETUP_ROOT_PW;
  if (!password) throw new Error("WESETUP_ROOT_PW не задан");
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    await page.waitForTimeout(2500);
    const enter = page.locator("button", { hasText: /Войти как/ }).first();
    if (await enter.count()) {
      await enter.click();
      await page.waitForTimeout(5000);
    }

    await page.goto(`${BASE}/journals`, { waitUntil: "load" });
    const journalCode = DOC_PATH.split("/")[2];
    await page.evaluate(
      (code) => window.localStorage.setItem(`journal-mobile-view:${code}`, "table"),
      journalCode,
    );

    const report: Record<string, unknown> = {};
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${BASE}${DOC_PATH}`, { waitUntil: "load" });
      await page.waitForTimeout(3500);
      // Дев-оверлей Next перехватывает клики.
      await page.evaluate(() =>
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
      );
      const gotIt = page.locator("button", { hasText: /^Понятно$/ }).first();
      if (await gotIt.count()) {
        await gotIt.click().catch(() => undefined);
        await page.waitForTimeout(900);
      }
      const m = await measure(page);
      report[vp.tag] = m;
      console.log(vp.tag, JSON.stringify(m));
      await page.screenshot({ path: path.join(SHOTS, `${TAG}-${vp.tag}.png`) });
    }

    fs.writeFileSync(path.join(HERE, `measure-${TAG}.json`), JSON.stringify(report, null, 2), "utf8");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
