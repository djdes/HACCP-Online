/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/free-plan-mobile-polish-2026-09/shots");
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.E2E_EMAIL ?? "e2e-previews@wesetup.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "E2e-Previews-2026!";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const results: Record<string, unknown> = {};
const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`) });

const MOBILE_PAGES = [
  "/dashboard",
  "/settings",
  "/settings/partner",
  "/settings/subscription",
  "/settings/auto-journals",
  "/settings/journals",
  "/journals",
  "/journals/cleaning",
  "/verifications",
];

async function dismissOverlays(page: Page) {
  await page.locator("div.fixed.inset-0.z-40").first().waitFor({ state: "attached", timeout: 3_000 }).catch(() => {});
  for (let i = 0; i < 3; i++) {
    const overlay = page.locator("div.fixed.inset-0.z-40").first();
    if (!(await overlay.count())) return;
    const later = overlay.getByRole("button", { name: /Напомнить позже|Позже|Закрыть/ }).first();
    if (await later.count()) await later.click({ force: true });
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
}

// Elements sticking out of the viewport on the right (ignoring fixed/portal chrome).
async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const bad: string[] = [];
    document.querySelectorAll("main *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") return;
      if (r.right > vw + 1 && r.left < vw) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.getAttribute("class") ?? "").slice(0, 80);
        bad.push(`${tag}.${cls} right=${Math.round(r.right)}`);
      }
    });
    return { vw, scrollW: document.documentElement.scrollWidth, bad: bad.slice(0, 12), badCount: bad.length };
  });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });

    // C: dashboard without trial
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForSelector('details[data-storage-key="compliance-grid"]', { timeout: 90_000 });
    await dismissOverlays(page);
    results.dashboardTrialText = await page.evaluate(() => /Тестовый период|тестового периода|Записей сегодня/.test(document.body.innerText));
    await shot(page, "01-dashboard-desktop");

    // B: partner modal desktop + mobile
    const hint = page.locator('button[aria-label^="Партнёрская программа"]').first();
    if (await hint.count()) {
      await hint.click();
      await page.getByText("Ваш бренд в WeSetup").waitFor({ state: "visible", timeout: 10_000 });
      await shot(page, "02-partner-modal-desktop");
      await page.keyboard.press("Escape");
    }

    // C: subscription page copy
    await page.goto(`${BASE}/settings/subscription`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForTimeout(1500);
    results.subscription = await page.evaluate(() => ({
      hasTrialWord: /тестовый период|Тестовый период|50 записей/.test(document.body.innerText),
      hasFreeNote: /Бесплатно до 3 сотрудников/.test(document.body.innerText),
      paused: /Аккаунт на паузе/.test(document.body.innerText),
    }));
    await shot(page, "03-subscription-desktop");

    // Cron dry-run
    if (CRON_SECRET) {
      const r = await page.request.get(`${BASE}/api/cron/auto-pause-inactive?dryRun=1`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        timeout: 300_000,
      });
      const body = (await r.json()) as Record<string, unknown>;
      results.cronDryRun = { status: r.status(), scanned: body.organizationsScanned, warned: body.warned, paused: body.paused, sample: (body.results as unknown[])?.slice(0, 3) };
    }

    // A: mobile overflow sweep
    await page.setViewportSize({ width: 390, height: 844 });
    const sweep: Record<string, unknown> = {};
    for (const p of MOBILE_PAGES) {
      await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.waitForTimeout(2500);
      await dismissOverlays(page);
      sweep[p] = await overflowReport(page);
      await shot(page, `10-mobile${p.replace(/\//g, "_")}`);
    }
    results.mobileSweep = sweep;

    // B: partner modal mobile
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForSelector('details[data-storage-key="compliance-grid"]', { timeout: 90_000 });
    await dismissOverlays(page);
    const hintM = page.locator('button[aria-label^="Партнёрская программа"]').first();
    if (await hintM.count()) {
      await hintM.click();
      await page.getByText("Ваш бренд в WeSetup").waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(400);
      results.partnerModalMobile = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
        const r = dlg.getBoundingClientRect();
        const over = Array.from(dlg.querySelectorAll("*")).filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.right > r.right + 1;
        }).length;
        return { top: r.top, bottom: r.bottom, h: r.height, w: r.width, vh: window.innerHeight, vw: window.innerWidth, fits: r.bottom <= window.innerHeight && r.top >= 0, childrenOverflowing: over };
      });
      await shot(page, "20-partner-modal-mobile");
      await page.keyboard.press("Escape");
    }

    // B: partner form mobile (required marks + checkbox row)
    await page.goto(`${BASE}/settings/partner`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForTimeout(2000);
    results.partnerForm = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll("label")).find((l) => /Принимаю/.test(l.textContent ?? ""));
      const cb = label?.querySelector('[role="checkbox"]') as HTMLElement | null;
      const txt = label?.querySelector("span") as HTMLElement | null;
      const stars = document.querySelectorAll('label span[aria-hidden]').length;
      const optional = Array.from(document.querySelectorAll("label")).filter((l) => /не обязательно/.test(l.textContent ?? "")).length;
      return {
        hasCheckbox: !!cb,
        sameRow: cb && txt ? Math.abs(cb.getBoundingClientRect().top - txt.getBoundingClientRect().top) < 12 : null,
        requiredStars: stars,
        optionalMarks: optional,
        legend: /обязательные поля/.test(document.body.innerText),
      };
    });
    await shot(page, "21-partner-form-mobile");
    const consent = page.locator("label", { hasText: "Принимаю" }).first();
    await consent.scrollIntoViewIfNeeded();
    await consent.screenshot({ path: path.join(OUT, "22-partner-consent-row.png") });

    results.pageErrors = pageErrors;
  } finally {
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
