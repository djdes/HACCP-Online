// Почему в уборке закрепилась не каждая строка: печатаем позицию и левый
// край каждой ячейки-подписи.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ORG_ID = "cmtbo1xnc00848ctszzywbwwq";
const DOC_PATH = process.argv[2] ?? "/journals/cleaning/documents/cmtmmj2jy000nr2tst9d7f2h0";

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
    const code = DOC_PATH.split("/")[2];
    await page.goto(`${BASE}/journals`, { waitUntil: "load" });
    await page.evaluate(
      (c) => window.localStorage.setItem(`journal-mobile-view:${c}`, "table"),
      code,
    );
    await page.goto(`${BASE}${DOC_PATH}`, { waitUntil: "load" });
    await page.waitForTimeout(3500);
    await page.evaluate(() =>
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
    );

    const atPoint = await page.evaluate(() => {
      const out: Array<Record<string, unknown>> = [];
      const label = document.querySelector("td[data-grid-label]") as HTMLElement | null;
      const y = label ? Math.round(label.getBoundingClientRect().top + 8) : 400;
      for (const x of [3, 12, 24, 30, 60]) {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        const cell = el?.closest("td,th") as HTMLTableCellElement | null;
        out.push({
          x,
          tag: cell?.tagName ?? null,
          marker: cell
            ? ["data-grid-check", "data-grid-label", "data-grid-label2", "data-grid-day"].find((a) =>
                cell.hasAttribute(a),
              ) ?? "нет"
            : null,
          left: cell ? Math.round(cell.getBoundingClientRect().left) : null,
          width: cell ? Math.round(cell.getBoundingClientRect().width) : null,
          text: (cell?.textContent || "").trim().slice(0, 20),
        });
      }
      return out;
    });
    console.log("что под точкой:", JSON.stringify(atPoint, null, 2));

    const rows = await page.evaluate(() => {
      const table = document.querySelector("table[data-journal-grid]");
      if (!table) return { error: "нет таблицы" };
      const out: Array<Record<string, unknown>> = [];
      for (const tr of Array.from(table.querySelectorAll("tr"))) {
        const cells = Array.from(tr.children) as HTMLTableCellElement[];
        const label = cells.find((c) => c.hasAttribute("data-grid-label"));
        out.push({
          cells: cells.length,
          hasLabel: Boolean(label),
          position: label ? getComputedStyle(label).position : null,
          bg: label ? getComputedStyle(label).backgroundColor : null,
          left: label ? Math.round(label.getBoundingClientRect().left) : null,
          text: (cells[1]?.textContent || cells[0]?.textContent || "").trim().slice(0, 30),
        });
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
