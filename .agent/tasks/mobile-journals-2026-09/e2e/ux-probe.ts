/* eslint-disable no-console */
// Мелкие замеры для UX-разбора: плавающие кнопки, размеры целей нажатия,
// нижний отступ страницы под ними.
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

    for (const [name, url] of [
      ["dashboard", "/dashboard"],
      ["journal-list", "/journals/hygiene"],
      ["document", `/journals/hygiene/documents/${docs.docs.hygiene.id}`],
    ] as const) {
      await page.goto(`${BASE}${url}`, NAV);
      await page.waitForTimeout(2500);
      await page.evaluate(() =>
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
      );
      out[name] = await page.evaluate(() => {
        const floating = Array.from(document.querySelectorAll<HTMLElement>("button, a"))
          .filter((el) => {
            const s = getComputedStyle(el);
            return s.position === "fixed" && el.getClientRects().length > 0;
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24),
              top: Math.round(r.top),
              right: Math.round(window.innerWidth - r.right),
              size: `${Math.round(r.width)}×${Math.round(r.height)}`,
            };
          });

        // Что лежит под плавающими кнопками — перекрывают ли они контент.
        const covered = floating
          .map((f) => {
            const el = document.elementFromPoint(
              window.innerWidth - f.right - 20,
              f.top + 20,
            ) as HTMLElement | null;
            const host = el?.closest("table, form, [role='tablist'], button, a");
            return host ? host.tagName.toLowerCase() : null;
          })
          .filter(Boolean);

        // Самые мелкие цели нажатия в основном контенте.
        const small = Array.from(
          document.querySelectorAll<HTMLElement>("main button, main a, main input, main td"),
        )
          .filter((el) => el.getClientRects().length > 0)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { h: Math.round(r.height), w: Math.round(r.width) };
          })
          .filter((r) => r.h > 0 && r.h < 32 && r.w > 0);

        return {
          floating,
          coveredByFloating: covered,
          smallTargets: small.length,
          smallestHeight: small.length ? Math.min(...small.map((s) => s.h)) : null,
          pageBottomPadding: getComputedStyle(document.querySelector("main")!).paddingBottom,
        };
      });
      console.log(name, JSON.stringify(out[name]).slice(0, 400));
    }
  } catch (e) {
    out.error = String(e).slice(0, 250);
    console.log("error", out.error);
  } finally {
    fs.writeFileSync(path.join(DIR, "e2e/ux-probe.json"), JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
