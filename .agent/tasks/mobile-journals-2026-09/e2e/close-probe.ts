/* eslint-disable no-console */
// Есть ли крестик в окне «Создание документа» и где он.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3020";
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: 320, height: 568 },
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
    await page.goto(`${BASE}/journals/hygiene`, NAV);
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    await page.locator('button:has-text("Создать документ")').first().click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));

    out.probe = await page.evaluate(() => {
      const content = document.querySelector<HTMLElement>('[data-slot="dialog-content"]');
      if (!content) return { found: false };
      const close = content.querySelector<HTMLElement>('[data-slot="dialog-close"]');
      const cr = close?.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const cs = close ? getComputedStyle(close) : null;
      const wrapper = close?.parentElement;
      const wr = wrapper?.getBoundingClientRect();
      return {
        found: true,
        contentRect: { top: Math.round(contentRect.top), height: Math.round(contentRect.height) },
        hasClose: Boolean(close),
        closeRect: cr
          ? { top: Math.round(cr.top), right: Math.round(cr.right), w: Math.round(cr.width), h: Math.round(cr.height) }
          : null,
        closeStyle: cs
          ? { position: cs.position, display: cs.display, opacity: cs.opacity, zIndex: cs.zIndex, visibility: cs.visibility }
          : null,
        wrapper: wr
          ? { class: wrapper?.className ?? "", top: Math.round(wr.top), h: Math.round(wr.height), position: getComputedStyle(wrapper!).position }
          : null,
      };
    });
  } catch (e) {
    out.error = String(e).slice(0, 200);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
  }
})();
