/* eslint-disable no-console */
// Настройки и меню профиля на телефоне: строка показателей, группы,
// лист снизу вместо выпадающего меню, страница «Внешний вид».
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 780);
const DIR = path.resolve(process.cwd(), ".agent/tasks/mobile-journals-2026-09");
const SHOTS = path.join(DIR, "shots-settings");
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

async function killPortal(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
  );
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
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

    // 1. Страница настроек.
    await page.goto(`${BASE}/settings`, NAV);
    await page.waitForTimeout(2500);
    await killPortal(page);
    out.settings = await page.evaluate(() => {
      const stats = Array.from(document.querySelectorAll("section .grid > div")).slice(0, 4);
      const tops = stats.map((el) => Math.round(el.getBoundingClientRect().top));
      const groups = Array.from(document.querySelectorAll("main h2")).map((h) =>
        (h.textContent ?? "").trim(),
      );
      const quickStart = Array.from(document.querySelectorAll("main a")).find((a) =>
        /Быстрый старт/.test(a.textContent ?? ""),
      );
      const qr = quickStart?.getBoundingClientRect();
      return {
        statTiles: stats.length,
        statsInOneRow: tops.length > 1 && new Set(tops).size === 1,
        groups,
        quickStartHeight: qr ? Math.round(qr.height) : null,
        pageOverflow: document.scrollingElement!.scrollWidth > window.innerWidth + 1,
      };
    });
    await page.screenshot({ path: path.join(SHOTS, `${W}-settings-top.png`) });
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `${W}-settings-groups.png`) });

    // 2. Меню профиля — лист снизу.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('button[aria-label="Профиль"]').first().click();
    await page.waitForTimeout(900);
    await killPortal(page);
    out.profileSheet = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!dialog) return null;
      const card = dialog.querySelector<HTMLElement>(":scope > div:nth-child(2)");
      const r = (card ?? (dialog as HTMLElement)).getBoundingClientRect();
      const rows = Array.from(dialog.querySelectorAll("a, button"))
        .map((el) => (el.textContent ?? "").trim())
        .filter(Boolean);
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        vw: window.innerWidth,
        vh: window.innerHeight,
        fullWidth: Math.round(r.width) >= window.innerWidth - 1,
        anchoredToBottom: Math.abs(Math.round(r.bottom) - window.innerHeight) <= 1,
        rows: rows.slice(0, 14),
        hasTheme: rows.some((t) => /Внешний вид/.test(t)),
        hasLogout: rows.some((t) => /Выйти/.test(t)),
      };
    });
    await page.screenshot({ path: path.join(SHOTS, `${W}-profile-sheet.png`) });
    await page.keyboard.press("Escape");

    // 3. Страница «Внешний вид».
    await page.goto(`${BASE}/settings/appearance`, NAV);
    await page.waitForTimeout(2000);
    await killPortal(page);
    out.appearance = await page.evaluate(() => ({
      title: (document.querySelector("main h1")?.textContent ?? "").trim(),
      modes: Array.from(document.querySelectorAll('[role="radio"]')).map((el) =>
        (el.textContent ?? "").trim(),
      ),
    }));
    await page.screenshot({ path: path.join(SHOTS, `${W}-appearance.png`) });
  } catch (e) {
    out.error = String(e).slice(0, 300);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    fs.writeFileSync(path.join(DIR, `e2e/settings-mobile-${W}.json`), JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
