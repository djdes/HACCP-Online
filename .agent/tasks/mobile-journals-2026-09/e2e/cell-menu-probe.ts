/* eslint-disable no-console */
// Меню ячейки журнала на телефоне: должно приходить листом снизу.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/mobile-journals-2026-09");
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);
const docs = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/docs.json"), "utf8")) as {
  docs: Record<string, { id: string }>;
};
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript("window.__name = (fn) => fn;");
  const page = await ctx.newPage();
  const out: Record<string, unknown> = {};
  try {
    await page.goto(`${BASE}/login`, NAV);
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });

    await page.goto(`${BASE}/journals/hygiene/documents/${docs.docs.hygiene.id}`, NAV);
    await page.waitForTimeout(3500);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    const tableTab = page.locator('[role="tab"]:has-text("Таблица")').first();
    if (await tableTab.isVisible().catch(() => false)) {
      await tableTab.click();
      await page.waitForTimeout(1500);
    }

    // Синтетическое contextmenu — так же, как долгое нажатие в мобильном Chrome.
    out.fired = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll<HTMLElement>("table tbody td"));
      const cell = cells.find((el) => /Зд\.|Б\/л|Отп\.|^В$/.test((el.textContent ?? "").trim()));
      if (!cell) return { found: false, sample: cells.slice(0, 8).map((c) => (c.textContent ?? "").trim()) };
      const r = cell.getBoundingClientRect();
      cell.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
        }),
      );
      return { found: true, text: (cell.textContent ?? "").trim() };
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));

    out.result = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      const menu = document.querySelector('[role="menu"]');
      const card = dialog?.querySelector<HTMLElement>(":scope > div:nth-child(2)");
      const r = card?.getBoundingClientRect();
      return {
        sheet: Boolean(dialog),
        oldMenu: Boolean(menu),
        fromBottom: r ? Math.abs(Math.round(r.bottom) - window.innerHeight) <= 1 : null,
        rows: dialog
          ? Array.from(dialog.querySelectorAll("button"))
              .map((b) => (b.textContent ?? "").trim())
              .filter(Boolean)
              .slice(0, 8)
          : [],
      };
    });
    await page.screenshot({ path: path.join(DIR, "shots-sheets/cell-menu-sheet.png") });
  } catch (e) {
    out.error = String(e).slice(0, 250);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
  }
})();
