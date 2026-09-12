// Снимок табличного вида документа журнала на узких экранах.
// Запуск: npx tsx .agent/tasks/mobile-grid-compact-2026-09/e2e/capture.ts before
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

import { BASE, STORAGE } from "../../partner-autonomy-2026-09/e2e/config";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const TAG = process.argv[2] ?? "before";
const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

/** ООО БФС — организация со скриншотов пользователя. */
const ORG_ID = "cmtbo1xnc00848ctszzywbwwq";
/** Журнал холодильного оборудования, 1–15 сентября, одно ХО. */
const DOC_URL = `${BASE}/journals/cold_equipment_control/documents/cmthyn4p003ychrtskrpvp5px`;

const VIEWPORTS = [
  { w: 932, h: 430, tag: "phone-landscape" },
  { w: 390, h: 844, tag: "phone-portrait" },
  { w: 768, h: 1024, tag: "tablet" },
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const pan = document.querySelector("[data-journal-doc-pan]") as HTMLElement | null;
    const table = document.querySelector("[data-journal-blank-column] table") as HTMLElement | null;
    const nameCell = Array.from(document.querySelectorAll("th")).find((th) =>
      (th.textContent || "").includes("Наименование или номер"),
    ) as HTMLElement | null;
    const dayCell = document.querySelector("th[data-focus-today]") as HTMLElement | null;
    const blank = document.querySelector("[data-journal-blank-column]") as HTMLElement | null;
    return {
      viewport: doc.clientWidth,
      pageOverflow: doc.scrollWidth - doc.clientWidth,
      panScroll: pan ? pan.scrollWidth - pan.clientWidth : null,
      blankWidth: blank ? Math.round(blank.getBoundingClientRect().width) : null,
      tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
      nameWidth: nameCell ? Math.round(nameCell.getBoundingClientRect().width) : null,
      dayWidth: dayCell ? Math.round(dayCell.getBoundingClientRect().width) : null,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ storageState: STORAGE, viewport: { width: 1280, height: 900 } });
    // tsx + esbuild keepNames ломает вложенные функции в page.evaluate.
    await context.addInitScript("window.__name = (fn) => fn;");
    const page = await context.newPage();

    // Вход в организацию идёт кнопкой из карточки: сам роут только пишет
    // аудит, claim в JWT ставит useSession().update() на клиенте.
    await page.goto(`${BASE}/root/organizations/${ORG_ID}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const enter = page.locator("button", { hasText: /Войти как/ }).first();
    if (await enter.count()) {
      await enter.click();
      await page.waitForTimeout(4000);
    }
    const session = ((await (await page.request.get(`${BASE}/api/auth/session`)).json()) ?? {}) as {
      user?: { actingAsOrganizationId?: string | null };
    };
    console.log("режим просмотра организации:", session.user?.actingAsOrganizationId);

    // Табличный вид — тот, на который жалуется пользователь.
    await page.goto(`${BASE}/journals`, { waitUntil: "load" });
    await page.evaluate(() =>
      window.localStorage.setItem("journal-mobile-view:cold_equipment_control", "table"),
    );

    const report: Record<string, unknown> = {};
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(DOC_URL, { waitUntil: "load" });
      await page.waitForTimeout(2500);
      // Инструкция журнала показывается один раз и перекрывает лист.
      const gotIt = page.locator("button", { hasText: /^Понятно$/ }).first();
      if (await gotIt.count()) {
        await gotIt.click().catch(() => undefined);
        await page.waitForTimeout(900);
      }
      const m = await measure(page);
      report[vp.tag] = m;
      console.log(vp.tag, JSON.stringify(m));
      await page.screenshot({ path: path.join(SHOTS, `${TAG}-${vp.tag}.png`) });
      // Второй кадр — прокрутка вправо: видно ли, к какой строке ячейки.
      await page.evaluate(() => {
        const pan = document.querySelector("[data-journal-doc-pan]") as HTMLElement | null;
        if (pan) pan.scrollLeft = pan.scrollWidth;
        else window.scrollTo({ left: document.documentElement.scrollWidth });
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SHOTS, `${TAG}-${vp.tag}-scrolled.png`) });
    }

    fs.writeFileSync(path.join(HERE, `measure-${TAG}.json`), JSON.stringify(report, null, 2), "utf8");
    console.log("сохранено в", path.join(HERE, `measure-${TAG}.json`));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
