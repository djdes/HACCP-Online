/* eslint-disable no-console */
// Листы снизу: свайп закрывает профиль, меню организации выезжает снизу,
// меню «⋯» документа на телефоне — тоже лист.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/mobile-journals-2026-09");
const SHOTS = path.join(DIR, "shots-sheets");
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);
const docs = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/docs.json"), "utf8")) as {
  docs: Record<string, { id: string }>;
};
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

async function killPortal(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
  );
}

/** Свайп вниз синтетическими pointer-событиями (pointerType: touch). */
async function swipeDown(page: Page, selector: string, distance = 220): Promise<unknown> {
  return page.evaluate(
    ({ selector, distance }) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return { found: false };
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + 20;
      const fire = (type: string, clientY: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerType: "touch",
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY,
            isPrimary: true,
          }),
        );
      const log: Record<string, unknown> = { start: Math.round(y) };
      log.down = fire("pointerdown", y);
      for (let step = 1; step <= 6; step += 1) {
        fire("pointermove", y + (distance / 6) * step);
      }
      log.transformMid = getComputedStyle(el).transform;
      fire("pointerup", y + distance);
      return log;
    },
    { selector, distance },
  );
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
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

    // 1. Профиль: открыть и закрыть свайпом.
    await page.goto(`${BASE}/dashboard`, NAV);
    await page.waitForTimeout(2500);
    await killPortal(page);
    await page.locator('button[aria-label="Профиль"]').first().click();
    await page.waitForTimeout(800);
    out.profileOpened = await page.locator('[role="dialog"][aria-modal="true"]').isVisible();
    out.swipe = await swipeDown(page, '[role="dialog"][aria-modal="true"] > div:nth-child(2)');
    await page.waitForTimeout(700);
    out.closedBySwipe = !(await page
      .locator('[role="dialog"][aria-modal="true"]')
      .isVisible()
      .catch(() => false));

    // 2. Меню организации (бургер) — снизу.
    await page.locator('button:has(svg.lucide-menu)').first().click();
    await page.waitForTimeout(900);
    await killPortal(page);
    out.navSheet = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        vw: window.innerWidth,
        vh: window.innerHeight,
        fromBottom: Math.abs(Math.round(r.bottom) - window.innerHeight) <= 1,
        fullWidth: Math.round(r.width) >= window.innerWidth - 1,
      };
    });
    await page.screenshot({ path: path.join(SHOTS, "nav-sheet.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // 3. Меню «⋯» в документе.
    const hygiene = docs.docs.hygiene?.id;
    if (hygiene) {
      await page.goto(`${BASE}/journals/hygiene/documents/${hygiene}`, NAV);
      await page.waitForTimeout(3000);
      await killPortal(page);
      await page.locator('button[aria-label="Ещё действия"]').first().click();
      await page.waitForTimeout(900);
      await killPortal(page);
      out.docMenu = await page.evaluate(() => {
        const dialogs = Array.from(
          document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
        ).filter((el) => el.getBoundingClientRect().height > 0);
        const dialog = dialogs[dialogs.length - 1];
        if (!dialog) return null;
        const card = dialog.querySelector<HTMLElement>(":scope > div:nth-child(2)");
        const r = (card ?? (dialog as HTMLElement)).getBoundingClientRect();
        return {
          fromBottom: Math.abs(Math.round(r.bottom) - window.innerHeight) <= 1,
          fullWidth: Math.round(r.width) >= window.innerWidth - 1,
          rows: Array.from(dialog.querySelectorAll("button"))
            .map((b) => (b.textContent ?? "").trim())
            .filter(Boolean)
            .slice(0, 8),
        };
      });
      await page.screenshot({ path: path.join(SHOTS, "doc-menu-sheet.png") });
    }

    // 4. Крошки журнала и меню ячейки таблицы.
    if (hygiene) {
      await page.goto(`${BASE}/journals/hygiene/documents/${hygiene}`, NAV);
      await page.waitForTimeout(3000);
      await killPortal(page);
      const crumb = page.locator('nav button, header button').filter({ hasText: "Гигиени" }).first();
      if (await crumb.isVisible().catch(() => false)) {
        await crumb.click();
        await page.waitForTimeout(800);
        await killPortal(page);
        out.crumbSheet = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
          if (!dialog) return null;
          const card = dialog.querySelector<HTMLElement>(":scope > div:nth-child(2)");
          const r = (card ?? (dialog as HTMLElement)).getBoundingClientRect();
          return {
            fromBottom: Math.abs(Math.round(r.bottom) - window.innerHeight) <= 1,
            fullWidth: Math.round(r.width) >= window.innerWidth - 1,
            rows: Array.from(dialog.querySelectorAll("button")).length,
          };
        });
        await page.screenshot({ path: path.join(SHOTS, "crumb-sheet.png") });
        await page.keyboard.press("Escape");
      }
    }

    // 5. Меню ячейки таблицы (ПКМ / долгое нажатие) — тоже лист.
    if (hygiene) {
      await page.goto(`${BASE}/journals/hygiene/documents/${hygiene}`, NAV);
      await page.waitForTimeout(3000);
      await killPortal(page);
      // На телефоне журнал по умолчанию в карточках — переключаемся в таблицу.
      const tableTab = page.locator('[role="tab"]:has-text("Таблица")').first();
      if (await tableTab.isVisible().catch(() => false)) {
        await tableTab.click();
        await page.waitForTimeout(1200);
      }
      // Клетка статуса сотрудника: именно она открывает меню по ПКМ.
      const table = page.locator("table tbody td").filter({ hasText: /Зд\.|В|Б\/л|От/ }).first();
      out.cellFound = await table.isVisible().catch(() => false);
      if (out.cellFound) {
        await table.click({ button: "right" });
        await page.waitForTimeout(800);
        await killPortal(page);
        out.cellMenuDebug = await page.evaluate(() => ({
          cells: document.querySelectorAll("table tbody td").length,
          dialogs: document.querySelectorAll('[role="dialog"]').length,
          menus: document.querySelectorAll('[role="menu"]').length,
        }));
        out.cellMenu = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
          if (!dialog) return null;
          const card = dialog.querySelector<HTMLElement>(":scope > div:nth-child(2)");
          const r = (card ?? (dialog as HTMLElement)).getBoundingClientRect();
          return {
            fromBottom: Math.abs(Math.round(r.bottom) - window.innerHeight) <= 1,
            fullWidth: Math.round(r.width) >= window.innerWidth - 1,
            rows: Array.from(dialog.querySelectorAll("button"))
              .map((b) => (b.textContent ?? "").trim())
              .filter(Boolean)
              .slice(0, 6),
          };
        });
        await page.screenshot({ path: path.join(SHOTS, "cell-menu-sheet.png") });
      }
    }
  } catch (e) {
    out.error = String(e).slice(0, 250);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    fs.writeFileSync(path.join(DIR, "e2e/sheets-check.json"), JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
