// Что распирает колонку подписи: печатаем все ячейки второго столбца.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ORG_ID = "cmtbo1xnc00848ctszzywbwwq";
const DOC_PATH = "/journals/cold_equipment_control/documents/cmthyn4p003ychrtskrpvp5px";

async function main() {
  const password = process.env.WESETUP_ROOT_PW;
  if (!password) throw new Error("WESETUP_ROOT_PW не задан");
  const browser = await chromium.launch({ channel: "chrome" });
  try {
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
    await page.goto(`${BASE}/journals`, { waitUntil: "load" });
    await page.evaluate(() =>
      window.localStorage.setItem("journal-mobile-view:cold_equipment_control", "table"),
    );
    await page.goto(`${BASE}${DOC_PATH}`, { waitUntil: "load" });
    await page.waitForTimeout(3500);
    await page.evaluate(() =>
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
    );

    const rows = await page.evaluate(() => {
      const table = document.querySelector("table[data-journal-grid]");
      if (!table) return [];
      const out: Array<Record<string, unknown>> = [];
      for (const tr of Array.from(table.querySelectorAll("tr"))) {
        for (const cell of Array.from(tr.children) as HTMLTableCellElement[]) {
          const rect = cell.getBoundingClientRect();
          if (rect.width < 60) continue;
          out.push({
            tag: cell.tagName,
            colSpan: cell.colSpan,
            width: Math.round(rect.width),
            marked: cell.hasAttribute("data-grid-label"),
            minW: getComputedStyle(cell).minWidth,
            text: (cell.textContent || "").trim().slice(0, 48),
          });
        }
      }
      return out;
    });
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
