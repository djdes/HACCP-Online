/* eslint-disable no-console */
// Тёмная тема и всплывашки: доходят ли до них перекраски (порталы в body
// лежат вне `.app-shell`, к которому привязаны dark-правила).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/mobile-journals-2026-09");
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

    await page.goto(`${BASE}/settings/appearance`, NAV);
    await page.waitForTimeout(2000);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    await page.locator('[role="radio"]:has-text("Тёмная")').first().click();
    await page.waitForTimeout(1200);

    out.shell = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".app-shell");
      return {
        theme: shell?.getAttribute("data-app-theme") ?? null,
        shellBg: shell ? getComputedStyle(shell).backgroundColor : null,
      };
    });

    // Профильный лист (портал в body).
    await page.locator('button[aria-label="Профиль"]').first().click();
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
    out.sheet = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      const card = dialog?.querySelector<HTMLElement>(":scope > div:nth-child(2)");
      if (!card) return null;
      const cs = getComputedStyle(card);
      const row = card.querySelector<HTMLElement>("a, button");
      return {
        cardBg: cs.backgroundColor,
        cardColor: cs.color,
        rowColor: row ? getComputedStyle(row).color : null,
        insideAppShell: Boolean(card.closest(".app-shell")),
      };
    });
    await page.screenshot({ path: path.join(DIR, "shots-sheets/dark-profile-sheet.png") });
    await page.keyboard.press("Escape");

    // Возвращаем светлую тему, чтобы не оставлять аккаунт в тёмной.
    await page.goto(`${BASE}/settings/appearance`, NAV);
    await page.waitForTimeout(1500);
    await page.locator('[role="radio"]:has-text("Системная")').first().click();
    await page.waitForTimeout(800);
  } catch (e) {
    out.error = String(e).slice(0, 250);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
  }
})();
