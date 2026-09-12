// Печать — бланк для проверяющего, её ломать нельзя. Компактные правила
// стоят под `@media screen`, здесь это проверяется эмуляцией print.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const ORG_ID = "cmtbo1xnc00848ctszzywbwwq";
const DOCS: Array<[string, string]> = [
  ["cold", "/journals/cold_equipment_control/documents/cmthyn4p003ychrtskrpvp5px"],
  ["cleaning", "/journals/cleaning/documents/cmtmmj2jy000nr2tst9d7f2h0"],
];

async function main() {
  const password = process.env.WESETUP_ROOT_PW;
  if (!password) throw new Error("WESETUP_ROOT_PW не задан");
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    // Узкое окно + печать: если бы компактные правила протекли в печать,
    // бланк уехал бы вслед за экраном.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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

    for (const [tag, docPath] of DOCS) {
      await page.goto(`${BASE}${docPath}`, { waitUntil: "load" });
      await page.waitForTimeout(3500);
      await page.evaluate(() =>
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
      );

      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(600);
      // Селекторы по содержимому — скрипт должен работать и на проде,
      // где разметки `data-grid-*` ещё нет: иначе эталон не с чем сверить.
      const m = await page.evaluate(() => {
        const label = Array.from(document.querySelectorAll("th")).find((th) =>
          /Наименование/.test(th.textContent || ""),
        ) as HTMLElement | undefined;
        const table = label?.closest("table") as HTMLElement | null;
        const rows = Array.from(table?.querySelectorAll("thead tr") ?? []);
        const dayRow = rows[rows.length - 1];
        const days = Array.from(dayRow?.children ?? []) as HTMLElement[];
        const day = days[days.length - 1];
        return {
          layout: table ? getComputedStyle(table).tableLayout : null,
          labelPosition: label ? getComputedStyle(label).position : null,
          labelWidth: label ? Math.round(label.getBoundingClientRect().width) : null,
          dayWidth: day ? Math.round(day.getBoundingClientRect().width) : null,
          dayCount: days.length,
          tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
        };
      });
      console.log(tag, JSON.stringify(m));
      await page.pdf({ path: path.join(SHOTS, `print-${tag}.pdf`), format: "A4", landscape: true });
      await page.emulateMedia({ media: "screen" });
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
