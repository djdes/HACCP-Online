/* eslint-disable no-console */
// Проверяем гипотезу: блокировка прокрутки (body position:fixed) ломает
// position:fixed у всплывашек. Тестовый div меряем до и после блокировки.
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
    await page.goto(`${BASE}/journals/hygiene`, NAV);
    await page.waitForTimeout(2500);

    out.result = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;inset:0;pointer-events:none";
      document.body.appendChild(probe);
      const before = probe.getBoundingClientRect();

      // Имитируем lockBodyScroll
      const b = document.body;
      const prev = { position: b.style.position, top: b.style.top, overflow: b.style.overflow };
      b.style.position = "fixed";
      b.style.top = `-${window.scrollY}px`;
      b.style.left = "0";
      b.style.right = "0";
      b.style.overflow = "hidden";
      const during = probe.getBoundingClientRect();

      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.overflow = prev.overflow;
      const after = probe.getBoundingClientRect();
      probe.remove();

      return {
        vh: window.innerHeight,
        before: { top: Math.round(before.top), height: Math.round(before.height) },
        duringLock: { top: Math.round(during.top), height: Math.round(during.height) },
        after: { top: Math.round(after.top), height: Math.round(after.height) },
      };
    });
  } catch (e) {
    out.error = String(e).slice(0, 300);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
  }
})();
