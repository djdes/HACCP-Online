/* eslint-disable no-console */
// Verifier-side independent browser checks for journal-fill-guide-2026-09.
// Covers what the builder's verify.ts did NOT prove: `?tab=` preservation,
// document -> list jump, list -> document jump at a non-first step, the mini
// bottom-sheet measured after animations settle, AC5 first-visit auto-open on a
// freshly reset key (run reset-notice.ts first), Esc / Назад / Далее / Готово,
// SVG cutout == ring == target(+pad).
//   npx tsx .agent/tasks/journal-fill-guide-2026-09/e2e/verify-verifier.ts
//   SKIP_AC5=1 ... — skip the fresh-key auto-open block (results-verifier-run1.json has it)
// Results are saved after every section; a watchdog aborts after 8 minutes.
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
const SKIP_AC5 = process.env.SKIP_AC5 === "1";

const DIALOG = '[role="dialog"][aria-labelledby="fill-guide-title"]';
const TOUR = '[role="dialog"][aria-label="Подсказка по интерфейсу"]';
const FAB_NEW = 'button[aria-label="Как заполнить этот журнал"]';
const FAB_OLD = 'button[aria-label="Как заполнять этот журнал"]';
const OLD_SHEET = '[role="dialog"][aria-label="Инструкция по заполнению"]';

const results: Record<string, unknown> = {};
const save = () =>
  fs.writeFileSync(path.join(ROOT, "e2e/results-verifier.json"), JSON.stringify(results, null, 2));
const shot = (p: Page, name: string) =>
  p.screenshot({ path: path.join(OUT, `verifier-${name}.png`) });

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

/** Ring vs closest [data-tour] target; cutout path vs ring. */
async function tourState(page: Page) {
  return page.evaluate(() => {
    const tour = document.querySelector('[role="dialog"][aria-label="Подсказка по интерфейсу"]');
    if (!tour) return { open: false as const };
    const ring = Array.from(tour.querySelectorAll<HTMLElement>("div")).find((d) =>
      (d.style.animation || "").includes("wesetup-spotlight-pulse")
    );
    const rr = ring?.getBoundingClientRect();
    const live = tour.querySelector('[aria-live="polite"]');
    const counter = live?.textContent?.trim() ?? "";
    const title = (live?.parentElement?.nextElementSibling as HTMLElement | null)?.innerText?.trim() ?? "";
    const buttons = Array.from(tour.querySelectorAll("button")).map(
      (b) => b.textContent?.trim() || b.getAttribute("aria-label") || ""
    );
    let anchor: string | null = null;
    let maxOffset: number | null = null;
    let offsets: number[] | null = null;
    if (rr) {
      let best = Infinity;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-tour]"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const o = [r.left - rr.left, r.top - rr.top, rr.right - r.right, rr.bottom - r.bottom];
        const m = Math.max(...o.map(Math.abs));
        if (m < best) {
          best = m;
          anchor = el.getAttribute("data-tour");
          maxOffset = Math.round(m * 100) / 100;
          offsets = o.map((v) => Math.round(v * 100) / 100);
        }
      }
    }
    const pathEl = tour.querySelector("path");
    const d = pathEl?.getAttribute("d") ?? "";
    // NB: no named inner functions here — tsx/esbuild wraps them in __name(),
    // which does not exist inside page.evaluate.
    let cutoutMatchesRing: boolean | null = null;
    if (rr) {
      const r = Math.max(0, Math.min(12, rr.width / 2, rr.height / 2));
      const mx = String(Math.round((rr.left + r) * 100) / 100);
      const my = String(Math.round(rr.top * 100) / 100);
      cutoutMatchesRing = d.includes(`M${mx} ${my}`);
    }
    return {
      open: true as const,
      counter,
      title,
      buttons,
      anchor,
      maxOffset,
      offsets,
      pathStartsWithViewport: d.startsWith(`M0 0H${window.innerWidth}V${window.innerHeight}H0Z`),
      evenodd: pathEl?.getAttribute("fill-rule") === "evenodd",
      fill: pathEl?.getAttribute("fill") ?? null,
      cutoutMatchesRing,
      ringInViewport: rr
        ? rr.left >= -1 && rr.top >= -1 && rr.right <= window.innerWidth + 1 && rr.bottom <= window.innerHeight + 1
        : null,
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

async function buttonGeometry(page: Page) {
  return page.evaluate(() => {
    const instr = Array.from(document.querySelectorAll("a")).find((a) => a.textContent?.trim() === "Инструкция");
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Как заполнить?");
    if (!instr || !btn) return { found: Boolean(instr), button: Boolean(btn), rightOf: false };
    const a = instr.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    return {
      found: true,
      button: true,
      rightOf: b.left >= a.right - 1 && Math.abs(a.top - b.top) < 20,
      instr: { left: a.left, right: a.right, top: a.top },
      btn: { left: b.left, right: b.right, top: b.top },
    };
  });
}

async function main() {
  const watchdog = setTimeout(() => {
    results.error = "watchdog: 8 min exceeded";
    save();
    process.exit(2);
  }, 8 * 60 * 1000);
  const browser: Browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message.split("\n")[0]));
  try {
    await login(page);
    results.login = page.url();
    save();

    // ---------- AC5 on a freshly reset key (climate_control) ----------
    if (SKIP_AC5) {
      results.ac5 = "skipped — see results-verifier-run1.json (fresh-key run)";
    } else {
      await page.goto(`${BASE}/journals/climate_control`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const dialog = page.locator(DIALOG);
      const autoOpen = await dialog.waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
      await shot(page, "ac5-auto-open");
      // Server-side flag must already be set while the dialog is still open (marked on open, not on close).
      await page.waitForTimeout(800);
      const seenWhileOpen = await page.evaluate(() =>
        fetch("/api/me/notices?key=fill-guide%3Aclimate_control", { cache: "no-store" }).then((r) => r.json())
      );
      // Leave WITHOUT closing, come back: must not reopen.
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.goto(`${BASE}/journals/climate_control`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator('button:has-text("Как заполнить?")').first().waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(2500);
      const reopenAfterLeaving = (await page.locator(DIALOG).count()) > 0;
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator('button:has-text("Как заполнить?")').first().waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(2500);
      const reopenAfterReload = (await page.locator(DIALOG).count()) > 0;
      // Other browser, same account.
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page2 = await ctx2.newPage();
      await login(page2);
      await page2.goto(`${BASE}/journals/climate_control`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page2.locator('button:has-text("Как заполнить?")').first().waitFor({ state: "visible", timeout: 60_000 });
      await page2.waitForTimeout(2500);
      const otherBrowserAutoOpen = (await page2.locator(DIALOG).count()) > 0;
      await ctx2.close();
      results.ac5 = { autoOpen, seenWhileOpen, reopenAfterLeaving, reopenAfterReload, otherBrowserAutoOpen };
    }
    save();

    // ---------- AC1 ----------
    {
      const ac1: Record<string, unknown> = {};
      for (const code of ["hygiene", "climate_control"]) {
        await page.goto(`${BASE}/journals/${code}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.locator('button:has-text("Как заполнить?")').first().waitFor({ state: "visible", timeout: 60_000 });
        ac1[code] = await buttonGeometry(page);
      }
      await page.goto(`${BASE}/journals/cleaning`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator('a:has-text("Инструкция")').first().waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(1000);
      ac1.cleaningButtonCount = await page.locator('button:has-text("Как заполнить?")').count();
      results.ac1 = ac1;
    }
    save();

    // ---------- AC2 desktop: dialog steps + previews + rules tab ----------
    {
      await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator('button:has-text("Как заполнить?")').first().click();
      const dialog = page.locator(DIALOG);
      await dialog.waitFor({ state: "visible", timeout: 30_000 });
      const stepTitles = await dialog.locator("ol > li").evaluateAll((lis) =>
        lis.map((li) => (li.querySelector("div.text-\\[14px\\]") as HTMLElement | null)?.innerText?.trim() ?? "")
      );
      const previewCount = await dialog.locator("ol > li div[aria-hidden]").count();
      const rulesTab = dialog.locator('[role="tab"]:has-text("Правила")');
      const hasRulesTab = (await rulesTab.count()) > 0;
      await rulesTab.click();
      await page.waitForTimeout(300);
      const rulesHeadings = await dialog.locator("section > div > span").evaluateAll((els) => els.map((e) => e.textContent?.trim()));
      results.ac2desktop = { stepTitles, previewCount, hasRulesTab, rulesHeadings };
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      results.ac2desktopEscClosesDialog = (await dialog.count()) === 0;
    }
    save();

    // ---------- AC4: ?tab= preserved, tour starts at requested step ----------
    {
      const ac4: Record<string, unknown> = {};
      await page.goto(`${BASE}/journals/hygiene?tab=active&tour=open-document`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const opened = await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(800);
      ac4.tabActive = { opened, state: await tourState(page), url: page.url() };
      await shot(page, "ac4-tab-active");
      await page.keyboard.press("Escape");

      // closed tab: no targets on this tab -> tour must not open, tour= removed, tab= kept, closed tab stays selected
      await page.goto(`${BASE}/journals/hygiene?tab=closed&tour=open-document`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator('button:has-text("Как заполнить?")').first().waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(4500);
      ac4.tabClosed = {
        url: page.url(),
        tourCount: await page.locator(TOUR).count(),
        dialogCount: await page.locator(DIALOG).count(),
        closedTabSelected: await page.evaluate(() => {
          const a = Array.from(document.querySelectorAll("a")).find((x) => x.textContent?.trim() === "Закрытые");
          return a ? a.className.includes("font-medium") : null;
        }),
        toast: await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []),
      };
      await shot(page, "ac4-tab-closed");

      // document -> list
      await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const href = await page.locator('[data-tour="document-card"] a').first().getAttribute("href");
      const docId = /\/documents\/([^/?]+)/.exec(href ?? "")?.[1] ?? null;
      results.docId = docId;
      if (docId) {
        await page.goto(`${BASE}/journals/hygiene/documents/${docId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.locator(FAB_NEW).waitFor({ state: "visible", timeout: 60_000 });
        await page.locator(FAB_NEW).click();
        await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
        const li = page.locator(DIALOG).locator("ol > li").filter({ hasText: "Откройте документ" }).first();
        const elsewhereLabel = await li.locator("span.text-\\[11px\\]").allInnerTexts();
        await li.locator('button:has-text("Показать на экране")').click();
        await page.waitForURL((u) => u.pathname === "/journals/hygiene", { timeout: 30_000 }).catch(() => {});
        const jumped = await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
        await page.waitForTimeout(800);
        ac4.docToList = { elsewhereLabel, jumped, url: page.url(), state: await tourState(page) };
        await shot(page, "ac4-doc-to-list");
        await page.keyboard.press("Escape");

        // list -> document at a NON-first document step (autofill = step 4 of 5)
        await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.locator('button:has-text("Как заполнить?")').first().click();
        await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
        await page.locator(DIALOG).locator("ol > li").filter({ hasText: "Включите автозаполнение" }).first()
          .locator('button:has-text("Показать на экране")').click();
        await page.waitForURL((u) => u.pathname.includes("/documents/"), { timeout: 30_000 }).catch(() => {});
        const jumped2 = await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
        await page.waitForTimeout(800);
        ac4.listToDocLaterStep = { jumped: jumped2, url: page.url(), state: await tourState(page) };
        await shot(page, "ac4-list-to-doc-autofill");
        await page.keyboard.press("Escape");
      }
      results.ac4 = ac4;
    }
    save();

    // ---------- AC3: buttons, cutout, Esc ----------
    if (results.docId) {
      const docId = results.docId as string;
      await page.goto(`${BASE}/journals/hygiene/documents/${docId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator(FAB_NEW).waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(1500);
      const docAutoOpen = (await page.locator(DIALOG).count()) > 0;
      await page.locator(FAB_NEW).click();
      await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
      await page.locator(DIALOG).locator('button:has-text("Показать на экране")').last().click();
      await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 });
      const dialogClosedWhenTourOpen = (await page.locator(DIALOG).count()) === 0;
      const tour = await runTour(page, "ac3-doc");
      // Назад + Esc
      await page.locator(FAB_NEW).click();
      await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
      await page.locator(DIALOG).locator('button:has-text("Показать на экране")').last().click();
      await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
      const afterNext = await tourState(page);
      const backBtn = page.locator(TOUR).locator('button:has-text("Назад")');
      let afterBack: Awaited<ReturnType<typeof tourState>> = { open: false };
      if (await backBtn.count()) {
        await backBtn.click();
        await page.waitForTimeout(500);
        afterBack = await tourState(page);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      results.ac3 = {
        docAutoOpen,
        dialogClosedWhenTourOpen,
        tour,
        backNav: { afterNext: afterNext.open ? afterNext.counter : null, afterBack: afterBack.open ? afterBack.counter : null },
        escCloses: (await page.locator(TOUR).count()) === 0,
      };
    }
    save();

    // ---------- AC8 ----------
    {
      const ac8: Record<string, unknown> = {};
      for (const code of ["hygiene", "climate_control"]) {
        await page.goto(`${BASE}/journals/${code}/guide`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        ac8[code] = await page.locator('a:has-text("К заполнению")').first().getAttribute("href");
      }
      results.ac8 = ac8;
    }
    save();

    // ---------- AC7 ----------
    {
      await page.goto(`${BASE}/journals/cleaning`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const card = page.locator('a[href*="/journals/cleaning/documents/"]').first();
      if (await card.count()) {
        const href = await card.getAttribute("href");
        await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        const oldFab = await page.locator(FAB_OLD).waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
        const newFab = (await page.locator(FAB_NEW).count()) > 0;
        let oldSheet: boolean | null = null;
        if (oldFab) {
          await page.locator(FAB_OLD).click();
          oldSheet = await page.locator(OLD_SHEET).waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
          await shot(page, "ac7-cleaning-old-sheet");
          await page.keyboard.press("Escape");
        }
        results.ac7 = { oldFab, newFab, oldSheet };
      } else {
        results.ac7 = "no-cleaning-document";
      }
    }
    save();

    // ---------- AC2 (390px bottom-sheet) + AC6 mini ----------
    {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}/mini/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const miniBtn = page.locator('button:has-text("Как заполнить?")').first();
      const miniListButton = await miniBtn.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
      const staleBox = await page.locator("text=заполнение таблицы доступно на сайте").count();
      await shot(page, "ac6-mini-list");
      await dropDevOverlay(page);
      await miniBtn.click();
      await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
      // Wait for the card's enter animation only, with a hard cap (infinite
      // animations elsewhere on the page never resolve `finished`).
      await page.evaluate(() => {
        const card = document.querySelector('[role="dialog"][aria-labelledby="fill-guide-title"] > div:last-child');
        const anims = card ? card.getAnimations({ subtree: true }) : [];
        return Promise.race([
          Promise.all(anims.map((a) => a.finished.catch(() => undefined))),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      });
      await page.waitForTimeout(250);
      const miniDialog = await page.evaluate(() => {
        const root = document.querySelector('[role="dialog"][aria-labelledby="fill-guide-title"]') as HTMLElement | null;
        const card = root?.querySelector(":scope > div:last-child") as HTMLElement | null;
        if (!card) return null;
        const r = card.getBoundingClientRect();
        const header = card.children[0] as HTMLElement;
        const body = card.children[1] as HTMLElement;
        const footer = card.children[2] as HTMLElement;
        const before = body.scrollTop;
        body.scrollTop = 300;
        const after = body.scrollTop;
        body.scrollTop = before;
        return {
          vh: window.innerHeight,
          top: r.top,
          bottom: r.bottom,
          height: r.height,
          fitsViewport: r.bottom <= window.innerHeight + 0.5 && r.top >= -0.5,
          within90vh: r.height <= window.innerHeight * 0.9 + 0.5,
          headerBottom: header.getBoundingClientRect().bottom,
          footerRect: { top: footer.getBoundingClientRect().top, bottom: footer.getBoundingClientRect().bottom },
          bodyOverflowY: getComputedStyle(body).overflowY,
          bodyScrollable: body.scrollHeight > body.clientHeight,
          bodyScrollTopAfterScroll: after,
          borderRadius: getComputedStyle(card).borderTopLeftRadius + " / " + getComputedStyle(card).borderBottomLeftRadius,
          bodyOverflowLocked: document.body.style.overflow,
          runningAnimations: card.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
        };
      });
      await shot(page, "ac2-mini-dialog");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      results.ac2mini = { miniListButton, staleBox, miniDialog, escClosed: (await page.locator(DIALOG).count()) === 0 };
      save();

      const docId = results.docId as string | null;
      if (docId) {
        await page.goto(`${BASE}/mini/documents/${docId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        const fab = page.locator(FAB_NEW);
        const miniDocFab = await fab.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
        const fabGeom = await page.evaluate(() => {
          const fab = document.querySelector('button[aria-label="Как заполнить этот журнал"]') as HTMLElement | null;
          const nav = document.querySelector("#mini-root nav") as HTMLElement | null;
          const f = fab?.getBoundingClientRect();
          const n = nav?.getBoundingClientRect();
          return {
            fabBottom: f?.bottom ?? null,
            fabRight: f?.right ?? null,
            vh: window.innerHeight,
            navTop: n?.top ?? null,
            navPosition: nav ? getComputedStyle(nav).position : null,
            fabParent: fab?.parentElement?.tagName ?? null,
          };
        });
        await shot(page, "ac6-mini-doc");
        await dropDevOverlay(page);
        await fab.click();
        await page.locator(DIALOG).waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForTimeout(500);
        const tabs = await page.locator(DIALOG).locator('[role="tab"]').allInnerTexts();
        await dropDevOverlay(page);
        await page.locator(DIALOG).locator('button:has-text("Показать на экране")').last().click();
        await page.locator(TOUR).waitFor({ state: "visible", timeout: 30_000 });
        const miniDocTour = await runTour(page, "ac6-mini-doc");
        results.ac6 = { miniDocFab, fabGeom, tabs, miniDocTour };
      }
    }
    save();
  } catch (e) {
    results.error = String(e);
    await shot(page, "99-error").catch(() => {});
  } finally {
    clearTimeout(watchdog);
    results.pageErrors = pageErrors;
    save();
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}

main();
