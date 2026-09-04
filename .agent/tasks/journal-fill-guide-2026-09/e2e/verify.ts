/* eslint-disable no-console */
// E2E for «Как заполнить?» (journal-fill-guide-2026-09). Run after seed-user.ts:
//   npx tsx .agent/tasks/journal-fill-guide-2026-09/e2e/verify.ts
import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ROOT = path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09");
const OUT = path.join(ROOT, "shots");
fs.mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/creds.json"), "utf8")) as {
  email: string;
  password: string;
};

const DIALOG = '[role="dialog"][aria-labelledby="fill-guide-title"]';
const TOUR = '[role="dialog"][aria-label="Подсказка по интерфейсу"]';
const FAB_NEW = 'button[aria-label="Как заполнить этот журнал"]';
const FAB_OLD = 'button[aria-label="Как заполнять этот журнал"]';
const OLD_SHEET = '[role="dialog"][aria-label="Инструкция по заполнению"]';

const results: Record<string, unknown> = {};
const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`) });

/** Next dev overlay (hydration warning toast) intercepts clicks — drop it. */
async function dropDevOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  });
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** Ring vs target: the pulsing ring div sits 6px outside the target. */
async function tourState(page: Page) {
  return page.evaluate(() => {
    const tour = document.querySelector('[role="dialog"][aria-label="Подсказка по интерфейсу"]');
    if (!tour) return { open: false as const };
    const ring = Array.from(tour.querySelectorAll<HTMLElement>("div")).find((d) =>
      (d.style.animation || "").includes("wesetup-spotlight-pulse")
    );
    const rr = ring?.getBoundingClientRect();
    const counter = tour.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? "";
    const title = counter ? (tour.querySelector('[aria-live="polite"]')?.parentElement?.nextElementSibling as HTMLElement | null)?.innerText?.trim() : "";
    let anchor: string | null = null;
    let delta: number | null = null;
    if (rr) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-tour]"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const d = Math.max(
          Math.abs(r.left - 6 - rr.left),
          Math.abs(r.top - 6 - rr.top),
          Math.abs(r.right + 6 - rr.right),
          Math.abs(r.bottom + 6 - rr.bottom)
        );
        if (delta === null || d < delta) {
          delta = d;
          anchor = el.getAttribute("data-tour");
        }
      }
    }
    const svgPath = tour.querySelector("path")?.getAttribute("d") ?? "";
    return {
      open: true as const,
      counter,
      title,
      anchor,
      delta,
      ringInViewport: rr ? rr.left >= -1 && rr.top >= -1 && rr.right <= window.innerWidth + 1 && rr.bottom <= window.innerHeight + 1 : null,
      hasCutout: svgPath.includes("a") && svgPath.startsWith("M0 0H"),
    };
  });
}

async function runTour(page: Page, label: string) {
  const steps: unknown[] = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(700);
    const state = await tourState(page);
    if (!state.open) break;
    steps.push(state);
    await shot(page, `${label}-step${i + 1}`);
    await page.keyboard.press("ArrowRight");
  }
  await page.waitForTimeout(300);
  return { steps, closedAfter: !(await tourState(page)).open };
}

async function ensureDocument(page: Page, code: string): Promise<string | null> {
  await page.goto(`${BASE}/journals/${code}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator('button:has-text("Как заполнить?")').first().waitFor({ state: "visible", timeout: 60_000 });
  const cards = page.locator('[data-tour="document-card"]');
  if ((await cards.count()) === 0) {
    await page.locator('[data-tour="create-document"]').first().click();
    const dialog = page.locator('[role="dialog"]').last();
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(500);
    await dialog.locator('button[type="submit"]').first().click();
    await page
      .waitForURL((u) => u.pathname.includes("/documents/"), { timeout: 30_000 })
      .catch(() => {});
    await page.goto(`${BASE}/journals/${code}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(800);
  }
  const link = page.locator('[data-tour="document-card"] a').first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute("href");
  const m = /\/documents\/([^/?]+)/.exec(href ?? "");
  return m ? m[1] : null;
}

async function journalFlow(page: Page, code: string, expectStep: string) {
  const r: Record<string, unknown> = {};
  // AC5 + AC1: first visit auto-opens the dialog
  await page.goto(`${BASE}/journals/${code}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const dialog = page.locator(DIALOG);
  r.autoOpen = await dialog.waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
  r.stepCount = await dialog.locator("ol > li").count();
  r.hasRulesTab = (await dialog.locator('[role="tab"]:has-text("Правила")').count()) > 0;
  r.buttonRightOfInstruction = await page.evaluate(() => {
    const instr = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.trim() === "Инструкция");
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Как заполнить?");
    if (!instr || !btn) return false;
    const a = instr.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    return b.left >= a.right - 1 && Math.abs(a.top - b.top) < 20;
  });
  await shot(page, `${code}-01-auto-open`);
  await dialog.locator('button:has-text("Понятно")').click();
  await page.waitForTimeout(300);
  // reload → no reopen
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  r.reopenAfterReload = (await page.locator(DIALOG).count()) > 0;
  await shot(page, `${code}-02-no-reopen`);
  // list tour
  await page.locator('button:has-text("Как заполнить?")').first().click();
  await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
  await shot(page, `${code}-03-dialog`);
  await page.locator(DIALOG).locator('button:has-text("Показать на экране")').last().click();
  await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 });
  r.listTour = await runTour(page, `${code}-04-list`);
  // document
  const docId = await ensureDocument(page, code);
  r.docId = docId;
  if (docId) {
    await page.goto(`${BASE}/journals/${code}/documents/${docId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const fab = page.locator(FAB_NEW);
    r.docFab = await fab.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(2000);
    r.docAutoOpen = (await page.locator(DIALOG).count()) > 0;
    await fab.click();
    await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
    await shot(page, `${code}-05-doc-dialog`);
    await page.locator(DIALOG).locator('[role="tab"]:has-text("Правила")').click();
    await page.waitForTimeout(300);
    r.rulesTabHasSteps = (await page.locator(DIALOG).locator("ol li").count()) > 0;
    await shot(page, `${code}-06-doc-rules`);
    await page.locator(DIALOG).locator('[role="tab"]:has-text("Куда нажимать")').click();
    await page.locator(DIALOG).locator('button:has-text("Показать на экране")').last().click();
    await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 });
    r.docTour = await runTour(page, `${code}-07-doc`);
    // Esc closes
    await page.locator(FAB_NEW).click();
    await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
    await page.locator(DIALOG).locator('button:has-text("Показать на экране")').last().click();
    await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    r.escCloses = (await page.locator(TOUR).count()) === 0;
    // AC4: ?tour=<stepId>
    await page.goto(`${BASE}/journals/${code}/documents/${docId}?tour=${expectStep}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const opened = await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(800);
    r.queryTour = { opened, state: await tourState(page), url: page.url() };
    await shot(page, `${code}-08-query-tour`);
    await page.keyboard.press("Escape");
    // list → document jump from the list dialog
    await page.goto(`${BASE}/journals/${code}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator('button:has-text("Как заполнить?")').first().click();
    await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
    const jump = page.locator(DIALOG).locator("ol > li").filter({ hasText: "внутри документа" }).first().locator('button:has-text("Показать на экране")');
    if (await jump.count()) {
      await jump.click();
      const jumped = await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(800);
      r.jumpToDocument = { jumped, url: page.url(), state: await tourState(page) };
      await shot(page, `${code}-09-jump`);
      await page.keyboard.press("Escape");
    }
  }
  return r;
}

async function main() {
  const browser: Browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  try {
    await login(page);
    results.login = page.url();

    const onlyMini = process.env.ONLY === "mini";
    if (onlyMini) {
      const prev = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/results.json"), "utf8"));
      results.hygiene = { docId: prev.hygiene?.docId };
      results.climate = { docId: prev.climate?.docId };
      results.note = "ONLY=mini: desktop flows reused from previous run";
    } else {
      results.hygiene = await journalFlow(page, "hygiene", "status-cell");
      results.climate = await journalFlow(page, "climate_control", "measure-input");
    }

    // AC1/AC7: journal without walkthrough
    if (!onlyMini) {
    await page.goto(`${BASE}/journals/cleaning`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator('a:has-text("Инструкция")').first().waitFor({ state: "visible", timeout: 60_000 });
    results.cleaningNoButton = (await page.locator('button:has-text("Как заполнить?")').count()) === 0;
    const cleaningCard = page.locator('[data-tour="document-card"] a, a[href*="/journals/cleaning/documents/"]').first();
    if (await cleaningCard.count()) {
      const href = await cleaningCard.getAttribute("href");
      await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const oldFab = page.locator(FAB_OLD);
      const visible = await oldFab.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
      results.cleaningOldFab = visible;
      if (visible) {
        await oldFab.click();
        results.cleaningOldSheet = await page.locator(OLD_SHEET).waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
        await shot(page, "cleaning-old-sheet");
        await page.keyboard.press("Escape");
      }
    } else {
      results.cleaningOldFab = "no-cleaning-document";
    }

    // AC8: guide CTA
    for (const code of ["hygiene", "climate_control"]) {
      await page.goto(`${BASE}/journals/${code}/guide`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      results[`guideCta_${code}`] = await page.locator('a:has-text("К заполнению")').first().getAttribute("href");
    }

    // AC5: another browser (fresh context) — no auto-open
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page2 = await ctx2.newPage();
    await login(page2);
    await page2.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page2.locator('button:has-text("Как заполнить?")').first().waitFor({ state: "visible", timeout: 60_000 });
    await page2.waitForTimeout(2500);
    results.otherBrowserAutoOpen = (await page2.locator(DIALOG).count()) > 0;
    await ctx2.close();
    }

    // AC6: Mini App at 390x844 (same cookie session)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/mini/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const miniBtn = page.locator('button:has-text("Как заполнить?")').first();
    results.miniListButton = await miniBtn.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
    await shot(page, "mini-01-list");
    if (results.miniListButton) {
      await dropDevOverlay(page);
      await miniBtn.click();
      await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(500); // enter animation (slide-in-from-bottom)
      results.miniDialog = await page.evaluate(() => {
        const card = document.querySelector('[role="dialog"][aria-labelledby="fill-guide-title"] > div:last-child') as HTMLElement | null;
        const r = card?.getBoundingClientRect();
        return r ? { top: r.top, bottom: r.bottom, height: r.height, vh: window.innerHeight, fits: r.bottom <= window.innerHeight + 1 && r.height <= window.innerHeight * 0.9 + 1 } : null;
      });
      await shot(page, "mini-02-dialog");
      await dropDevOverlay(page);
      await page.locator(DIALOG).locator('button:has-text("Понятно")').click();
    }
    const hygieneDocId = (results.hygiene as { docId?: string }).docId;
    if (hygieneDocId) {
      await page.goto(`${BASE}/mini/documents/${hygieneDocId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const fab = page.locator(FAB_NEW);
      results.miniDocFab = await fab.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
      results.miniFabAboveNav = await page.evaluate(() => {
        const fab = document.querySelector('button[aria-label="Как заполнить этот журнал"]') as HTMLElement | null;
        const nav = document.querySelector("#mini-root nav") as HTMLElement | null;
        const f = fab?.getBoundingClientRect();
        const n = nav?.getBoundingClientRect();
        return {
          fabBottom: f?.bottom ?? null,
          navTop: n?.top ?? null,
          navPosition: nav ? getComputedStyle(nav).position : null,
          above: f && n ? f.bottom <= n.top + 1 : null,
        };
      });
      await shot(page, "mini-03-doc");
      if (results.miniDocFab) {
        await dropDevOverlay(page);
        await fab.click();
        await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForTimeout(500);
        await dropDevOverlay(page);
        await page.locator(DIALOG).locator('button:has-text("Показать на экране")').last().click();
        await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 });
        results.miniDocTour = await runTour(page, "mini-04-doc");
      }
    }
  } catch (e) {
    results.error = String(e);
    await shot(page, "99-error").catch(() => {});
  } finally {
    const out = process.env.ONLY === "mini" ? "e2e/results-mini.json" : "e2e/results.json";
    fs.writeFileSync(path.join(ROOT, out), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}

main();
