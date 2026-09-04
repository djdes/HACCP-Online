/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/dashboard-polish-partner-previews-2026-09/shots");
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.E2E_EMAIL ?? "e2e-previews@wesetup.local";
const PASSWORD = process.env.E2E_PASSWORD ?? "E2e-Previews-2026!";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const results: Record<string, unknown> = {};
const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

// Trial-expired / stale-CAPA nags overlay the dashboard in this org.
async function dismissOverlays(page: Page) {
  // Nags mount after hydration + a fetch; give them time to appear.
  await page.locator("div.fixed.inset-0.z-40").first().waitFor({ state: "attached", timeout: 6_000 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    const overlay = page.locator("div.fixed.inset-0.z-40").first();
    if (!(await overlay.count())) return;
    const later = overlay.getByRole("button", { name: /Напомнить позже|Позже|Закрыть/ }).first();
    if (await later.count()) await later.click({ force: true });
    else {
      const anyBtn = overlay.locator("button").last();
      if (await anyBtn.count()) await anyBtn.click({ force: true });
      else await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(600);
  }
  results.overlayLeft = await page.locator("div.fixed.inset-0.z-40").count();
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });
    results.login = page.url();

    // Cron: render previews for this org (runs for all orgs, limited)
    if (CRON_SECRET && !process.env.SKIP_CRON) {
      const cron = await page.request.get(`${BASE}/api/cron/journal-previews`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
        timeout: 300_000,
      });
      results.cron = { status: cron.status(), body: await cron.text() };
    }

    // Dashboard desktop
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForSelector('details[data-storage-key="compliance-grid"]', { timeout: 60_000 });
    await dismissOverlays(page);
    results.dashboard = await page.evaluate(() => {
      const grid = document.querySelector('details[data-storage-key="compliance-grid"]')!;
      const cards = Array.from(grid.querySelectorAll("a[href]")) as HTMLAnchorElement[];
      const paper = cards.filter((a) => a.getAttribute("href")?.includes("/settings/journals/paper/"));
      const electronic = cards.filter((a) => a.getAttribute("href")?.startsWith("/journals/"));
      const imgs = Array.from(grid.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
      return {
        paperCount: paper.length,
        paperClasses: paper[0]?.className ?? "",
        electronicCount: electronic.length,
        electronicClasses: electronic.map((a) => a.className.match(/border-\[#[0-9a-f]+\]/)?.[0]),
        previewImgs: imgs.filter((s) => s.startsWith("/api/journal-previews/")).length,
        sampleImgs: imgs.filter((s) => s.startsWith("/journal-samples/")).length,
        partnerHint: Boolean(document.querySelector('button[aria-label^="Партнёрская программа"]')),
      };
    });
    await shot(page, "01-dashboard-desktop");

    // Preview image actually loads
    const previewSrc = await page.evaluate(
      () => (document.querySelector('img[src^="/api/journal-previews/"]') as HTMLImageElement | null)?.src ?? null,
    );
    if (previewSrc) {
      const r = await page.request.get(previewSrc);
      results.previewFetch = { status: r.status(), type: r.headers()["content-type"], cache: r.headers()["cache-control"], bytes: (await r.body()).length };
    } else {
      results.previewFetch = "no-preview-img";
    }

    // Partner hint modal
    const hint = page.locator('button[aria-label^="Партнёрская программа"]').first();
    if (await hint.count()) {
      await dismissOverlays(page);
      await hint.click();
      await page.getByText("Ваш бренд в WeSetup").waitFor({ state: "visible", timeout: 10_000 });
      results.partnerModal = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]') as HTMLElement;
        const r = dlg.getBoundingClientRect();
        return {
          h: r.height, w: r.width, vh: window.innerHeight,
          hasRates: /%/.test(dlg.innerText),
          hasCta: !!dlg.querySelector('a[href="/settings/partner"]'),
          text: dlg.innerText.slice(0, 400),
        };
      });
      await shot(page, "02-partner-modal");
      await page.keyboard.press("Escape");
    }

    // Journals page: hide + enable
    await page.goto(`${BASE}/journals`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForSelector('a[href^="/journals/"]', { timeout: 60_000 });
    const hideBtn = page.locator('button[aria-label^="Скрыть «"]').first();
    results.hideButtonCount = await page.locator('button[aria-label^="Скрыть «"]').count();
    const hideLabel = await hideBtn.getAttribute("aria-label");
    await hideBtn.hover();
    await shot(page, "03-journals-hover-eye");
    await hideBtn.click({ force: true });
    await page.getByText("Скрыть журнал с дашборда?").waitFor({ state: "visible", timeout: 10_000 });
    await shot(page, "04-hide-confirm");
    await page.getByRole("button", { name: "Скрыть", exact: true }).click();
    await page.waitForTimeout(2500);
    const name = hideLabel?.match(/«(.+)»/)?.[1] ?? "";
    results.hidden = { name, disabledSectionVisible: await page.getByText("Отключённые журналы").isVisible() };
    await shot(page, "05-after-hide");
    // enable back
    const enableBtn = page.getByRole("button", { name: /Включить/ }).first();
    await enableBtn.click();
    await page.waitForTimeout(2500);
    results.enabledBack = { stillHasHideBtnFor: await page.locator(`button[aria-label="Скрыть «${name}» с дашборда"]`).count() };
    await shot(page, "06-after-enable");

    // Mobile dashboard
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForSelector('details[data-storage-key="compliance-grid"]', { timeout: 60_000 });
    results.mobile = await page.evaluate(() => {
      const grid = document.querySelector('details[data-storage-key="compliance-grid"]')!;
      const h3 = grid.querySelector("summary h3") as HTMLElement;
      const badge = h3.nextElementSibling as HTMLElement | null;
      const settings = grid.querySelector('summary a[href="/settings/journals"]') as HTMLElement;
      const closeDay = Array.from(grid.querySelectorAll("summary button")).find((b) => /Закрыть день/.test(b.textContent ?? "")) as HTMLElement;
      const sel = grid.querySelector('summary a[href="/dashboard/catch-up"]') as HTMLElement;
      // No inner function declarations here: tsx/esbuild injects a `__name`
      // helper that does not exist inside the browser evaluate scope.
      return {
        title: h3.getBoundingClientRect().toJSON(),
        badge: badge ? badge.getBoundingClientRect().toJSON() : null,
        settings: settings ? settings.getBoundingClientRect().toJSON() : null,
        settingsText: settings?.innerText.trim(),
        closeDay: closeDay ? closeDay.getBoundingClientRect().toJSON() : null,
        selective: sel ? sel.getBoundingClientRect().toJSON() : null,
        selectiveText: sel?.innerText.trim(),
        sameRowTitleBadge: badge ? Math.abs(h3.getBoundingClientRect().top - badge.getBoundingClientRect().top) < 8 : null,
        sameRowButtons: closeDay && sel ? Math.abs(closeDay.getBoundingClientRect().top - sel.getBoundingClientRect().top) < 4 : null,
        vw: window.innerWidth, scrollW: document.documentElement.scrollWidth,
      };
    });
    const summary = page.locator('details[data-storage-key="compliance-grid"] summary');
    await summary.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await summary.screenshot({ path: path.join(OUT, "07-dashboard-mobile-summary.png") });
    await page.locator('details[data-storage-key="compliance-grid"]').screenshot({ path: path.join(OUT, "07-dashboard-mobile-section.png") });
    results.mobileTitleText = (await summary.locator("h3").innerText()).replace(/\s+/g, " ");
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
