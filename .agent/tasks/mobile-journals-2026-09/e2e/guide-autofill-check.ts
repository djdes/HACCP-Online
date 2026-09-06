/* eslint-disable no-console */
// Проверка круга 3: окно «Инструкция» с двумя вкладками, всплывашки
// тумблеров автоматики и их геометрия на телефоне.
//   BASE=http://localhost:3020 node --env-file=.env.local --import tsx .agent/tasks/mobile-journals-2026-09/e2e/guide-autofill-check.ts [codes...]
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/mobile-journals-2026-09");
const SHOTS = path.join(DIR, "shots-guide");
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);
const codes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["hygiene", "climate_control", "med_books", "audit_plan"];
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

async function dialogGeometry(page: Page) {
  return page.evaluate(() => {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
    ).filter((el) => el.getBoundingClientRect().height > 0);
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return null;
    const card = dialog.querySelector<HTMLElement>(":scope > div:nth-child(2)");
    const r = (card ?? dialog).getBoundingClientRect();
    const scroller = Array.from(dialog.querySelectorAll<HTMLElement>("*")).find((el) => {
      const s = getComputedStyle(el);
      return s.overflowY === "auto" || s.overflowY === "scroll";
    });
    const buttons = Array.from(dialog.querySelectorAll("button")).map((b) =>
      (b.textContent ?? "").trim().slice(0, 24),
    );
    const tabs = Array.from(dialog.querySelectorAll('[role="tab"]')).map((t) =>
      (t.textContent ?? "").trim(),
    );
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
      vh: window.innerHeight,
      fits: r.top >= -1 && r.bottom <= window.innerHeight + 1,
      innerScroll: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : false,
      canScrollInside: Boolean(scroller),
      tabs,
      buttons: buttons.filter(Boolean),
      textLength: (dialog.textContent ?? "").trim().length,
    };
  });
}

async function killPortal(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
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
  const results: Record<string, unknown> = {};
  try {
    await page.goto(`${BASE}/login`, NAV);
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });

    for (const code of codes) {
      const r: Record<string, unknown> = {};
      try {
        await page.request.post(`${BASE}/api/me/notices`, {
          data: { key: `fill-guide:${code}` },
        });
        await page.goto(`${BASE}/journals/${code}`, NAV);
        await page.waitForTimeout(2500);
        await killPortal(page);
        await page.keyboard.press("Escape");

        // 1. Кнопка «Инструкция» → окно с двумя вкладками.
        const guideBtn = page.locator('button:has-text("Инструкция")').first();
        r.guideButton = await guideBtn.isVisible().catch(() => false);
        if (r.guideButton) {
          await guideBtn.click();
          await page.waitForTimeout(900);
          await killPortal(page);
          r.guideDialog = await dialogGeometry(page);
          await page.screenshot({ path: path.join(SHOTS, `${code}-1-guide-steps.png`) });
          const rulesTab = page.locator('[role="tab"]:has-text("Правила")').first();
          if (await rulesTab.isVisible().catch(() => false)) {
            await rulesTab.click();
            await page.waitForTimeout(600);
            r.rulesTab = await dialogGeometry(page);
            await page.screenshot({ path: path.join(SHOTS, `${code}-2-guide-rules.png`) });
          }
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        }

        // 2. Тумблеры автоматики: всплывашка и её геометрия.
        const switches = page.locator('button[role="switch"]');
        const count = await switches.count();
        r.switches = count;
        if (count > 0) {
          await switches.first().click();
          await page.waitForTimeout(2500);
          await killPortal(page);
          r.autoCreateDialog = await dialogGeometry(page);
          await page.screenshot({ path: path.join(SHOTS, `${code}-3-autocreate.png`) });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(600);
        }
        if (count > 1) {
          await switches.nth(1).click();
          await page.waitForTimeout(2500);
          await killPortal(page);
          r.autoFillDialog = await dialogGeometry(page);
          await page.screenshot({ path: path.join(SHOTS, `${code}-4-autofill.png`) });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(400);
        }
      } catch (e) {
        r.error = String(e).slice(0, 200);
        await page.screenshot({ path: path.join(SHOTS, `${code}-99-error.png`) }).catch(() => {});
      }
      results[code] = r;
      console.log(code, JSON.stringify(r).slice(0, 400));
    }
  } finally {
    fs.writeFileSync(
      path.join(DIR, `e2e/guide-autofill-${process.env.OUT ?? "run"}.json`),
      JSON.stringify(results, null, 2),
    );
    await browser.close();
  }
})();
