/* eslint-disable no-console */
// Мобильный обход всех журналов (390×780): документ в табличном виде,
// геометрия скролла (шапка и таблица в одном контейнере?), переполнение
// страницы, диалог «Создать документ» — влезает ли на первый экран.
//   BASE=http://localhost:3020 node --env-file=.env.local --import tsx .agent/tasks/mobile-journals-2026-09/e2e/crawl.ts [codes...]
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/mobile-journals-2026-09");
const SHOTS = path.join(DIR, process.env.W && Number(process.env.W) >= 640 ? "shots-desktop" : "shots");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const docsJson = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/docs.json"), "utf8")) as {
  docs: Record<string, { id: string; status: string; name: string }>;
};
const paperJson = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/paper.json"), "utf8")) as {
  paper: { id: string; journalId: string; status: string; title: string }[];
};
const only = process.argv.slice(2);
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

type Geometry = {
  toggle: { left: number; width: number; widerThanScreen: boolean } | null;
  panScrollLeft: number | null;
  h1: { width: number; widerThanScreen: boolean } | null;
  pageScrollWidth: number;
  innerWidth: number;
  pageOverflow: boolean;
  scrollers: { tag: string; cls: string; scrollWidth: number; clientWidth: number; tables: number; hasPaperHeader: boolean }[];
  headerContainer: string | null;
  gridContainer: string | null;
  sameContainer: boolean | null;
  tablesTotal: number;
  paperHeaderFound: boolean;
};

async function measure(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const se = document.scrollingElement!;
    const isScroller = (el: Element) => {
      const s = getComputedStyle(el);
      return (s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1;
    };
    const describe = (el: Element | null) => {
      if (!el) return null;
      const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter((c) => /overflow|viewport|grid|paper|mx-|px-/.test(c)).slice(0, 6).join(" ");
      return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${cls}]`;
    };
    const nearestScroller = (el: Element | null) => {
      let cur = el?.parentElement ?? null;
      while (cur && cur !== document.body) {
        const s = getComputedStyle(cur);
        if (s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden") return cur;
        cur = cur.parentElement;
      }
      return document.scrollingElement as Element;
    };
    const tables = Array.from(document.querySelectorAll("table")).filter((t) => t.getClientRects().length > 0);
    // Бумажная шапка: таблица, содержащая «СИСТЕМА ХАССП» или «Начат».
    const paperHeader =
      tables.find((t) => /СИСТЕМА ХАССП|Начат/.test(t.textContent ?? "")) ?? null;
    // Основная сетка: первая видимая таблица с thead, не шапка.
    const grid = tables.find((t) => t !== paperHeader && t.tHead && t.tHead.rows.length > 0) ?? null;
    const scrollers = Array.from(document.querySelectorAll("*"))
      .filter((el) => el !== se && isScroller(el) && el.getClientRects().length > 0)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") ?? "").slice(0, 80),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        tables: el.querySelectorAll("table").length,
        hasPaperHeader: paperHeader ? el.contains(paperHeader) : false,
      }));
    const hc = paperHeader ? nearestScroller(paperHeader) : null;
    const gc = grid ? nearestScroller(grid) : null;
    const tablist = Array.from(document.querySelectorAll('[role="tablist"]')).find((t) => /Таблица/.test(t.textContent ?? "") && t.getClientRects().length > 0) ?? null;
    const tr = tablist?.getBoundingClientRect();
    const pan = document.querySelector("[data-journal-doc-pan]");
    const panScrollLeft = pan ? pan.scrollLeft : null;
    // Ширина «листа» (первого дочернего блока pan-зоны шире экрана) и вылезают ли за экран заголовок/кнопки.
    const h1 = document.querySelector("main h1, [data-journal-doc-pan] h1");
    const h1r = h1?.getBoundingClientRect();
    return {
      toggle: tr ? { left: Math.round(tr.left + (panScrollLeft ?? 0)), width: Math.round(tr.width), widerThanScreen: tr.width > window.innerWidth + 2 } : null,
      panScrollLeft,
      h1: h1r ? { width: Math.round(h1r.width), widerThanScreen: h1r.width > window.innerWidth + 2 } : null,
      pageScrollWidth: se.scrollWidth,
      innerWidth: window.innerWidth,
      pageOverflow: se.scrollWidth > window.innerWidth + 1,
      scrollers,
      headerContainer: describe(hc),
      gridContainer: describe(gc),
      sameContainer: hc && gc ? hc === gc : null,
      tablesTotal: tables.length,
      paperHeaderFound: Boolean(paperHeader),
    };
  });
}

async function dialogGeometry(page: Page) {
  return page.evaluate(() => {
    const d = Array.from(document.querySelectorAll('[role="dialog"]')).filter((x) => x.getBoundingClientRect().height > 0).pop();
    if (!d) return null;
    const r = d.getBoundingClientRect();
    const submit = Array.from(d.querySelectorAll("button")).find((b) => b.getAttribute("type") === "submit" || /Создать|Сохранить|Готово/.test(b.textContent ?? ""));
    const sr = submit?.getBoundingClientRect();
    const body = Array.from(d.querySelectorAll("*")).find((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1;
    });
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
      vh: window.innerHeight,
      fits: r.top >= -1 && r.bottom <= window.innerHeight + 1,
      submitText: submit?.textContent?.trim().slice(0, 30) ?? null,
      submitVisible: sr ? sr.top >= 0 && sr.bottom <= window.innerHeight : null,
      scrollsInside: Boolean(body),
    };
  });
}

async function killPortal(page: Page) {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const W = Number(process.env.W ?? 390);
  const H = Number(process.env.H ?? 780);
  const mobile = W < 640;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  // tsx (esbuild keepNames) вставляет __name в функции внутри evaluate.
  await ctx.addInitScript("window.__name = (fn) => fn;");
  const page = await ctx.newPage();
  const results: Record<string, unknown> = {};
  try {
    await page.goto(`${BASE}/login`, NAV);
    // Без гидрации форма уходит GET'ом с паролем в URL — ждём networkidle.
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });
    // Автовсплывашки гайдов — пометить просмотренными для всех журналов.
    for (const code of Object.keys(docsJson.docs)) {
      await page.request.post(`${BASE}/api/me/notices`, { data: { key: `fill-guide:${code}` } }).catch(() => {});
    }

    const codes = Object.keys(docsJson.docs).filter((c) => only.length === 0 || only.includes(c));
    for (const code of codes) {
      const doc = docsJson.docs[code];
      const r: Record<string, unknown> = { name: doc.name, status: doc.status };
      try {
        // 1. Список журнала + диалог создания.
        await page.goto(`${BASE}/journals/${code}`, NAV);
        await page.waitForTimeout(1200);
        await killPortal(page);
        r.listPageOverflow = await page.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth + 1);
        const createBtn = page.locator('button:has-text("Создать документ"), a:has-text("Создать документ"), button:has-text("Создать")').first();
        if (await createBtn.isVisible().catch(() => false)) {
          await createBtn.click();
          await page.waitForTimeout(700);
          await killPortal(page);
          r.createDialog = await dialogGeometry(page);
          await page.screenshot({ path: path.join(SHOTS, `${code}-1-create-dialog.png`) });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        } else {
          r.createDialog = "no-button";
        }

        // 2. Документ — табличный вид.
        await page.goto(`${BASE}/journals/${code}/documents/${doc.id}`, NAV);
        // Ждём, пока уйдут скелетоны и появится либо тумблер вида, либо таблица.
        await page.waitForFunction(
          () => document.querySelectorAll(".animate-pulse, [aria-busy=\"true\"]").length === 0 && document.querySelector("main h1") && (document.querySelector("table") || document.querySelector('[role="tablist"]')),
          undefined,
          { timeout: 120_000 },
        ).catch(() => {});
        await page.waitForTimeout(2500);
        await killPortal(page);
        const toggle = page.locator('[role="tablist"] button:has-text("Таблица"), button:has-text("Таблица")').first();
        r.hasToggle = await toggle.isVisible().catch(() => false);
        if (r.hasToggle) {
          await toggle.click();
          await page.waitForTimeout(500);
        }
        r.table = await measure(page);
        await page.evaluate(() => { const pan = document.querySelector("[data-journal-doc-pan]"); if (pan) pan.scrollLeft = 0; });
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(SHOTS, `${code}-2-table.png`) });
        // Прокрутить вбок до конца и снять — видно ли, что шапка едет вместе.
        await page.evaluate(() => {
          const se = document.scrollingElement!;
          const scrollers = Array.from(document.querySelectorAll("*")).filter((el) => {
            const s = getComputedStyle(el);
            return (s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1;
          });
          for (const el of scrollers) el.scrollLeft = 200;
          se.scrollLeft = 200;
          const grid = Array.from(document.querySelectorAll("table")).find((t) => t.tHead && !/СИСТЕМА ХАССП/.test(t.textContent ?? ""));
          grid?.scrollIntoView({ block: "start" });
          window.scrollBy(0, -140);
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SHOTS, `${code}-3-table-scrolled.png`) });
        if (r.hasToggle) {
          const cards = page.locator('button:has-text("Карточки")').first();
          if (await cards.isVisible().catch(() => false)) {
            await cards.click();
            await page.waitForTimeout(400);
            await page.evaluate(() => window.scrollTo(0, 0));
            r.cardsPageOverflow = await page.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth + 1);
            await page.screenshot({ path: path.join(SHOTS, `${code}-4-cards.png`) });
          }
        }
      } catch (e) {
        r.error = String(e).slice(0, 300);
        await page.screenshot({ path: path.join(SHOTS, `${code}-99-error.png`) }).catch(() => {});
      }
      results[code] = r;
      console.log(code, JSON.stringify({ overflow: (r.table as Geometry | undefined)?.pageOverflow, same: (r.table as Geometry | undefined)?.sameContainer, scrollers: (r.table as Geometry | undefined)?.scrollers.length, dialog: r.createDialog }));
    }

    // 3. Бумажные журналы.
    if (only.length === 0 || only.includes("paper")) {
      const seen = new Set<string>();
      for (const pd of paperJson.paper) {
        if (seen.has(pd.journalId)) continue;
        seen.add(pd.journalId);
        const key = `paper_${pd.journalId}`;
        const r: Record<string, unknown> = { title: pd.title, status: pd.status };
        try {
          await page.goto(`${BASE}/settings/journals/paper/${pd.journalId}`, NAV);
          await page.waitForTimeout(1200);
          await killPortal(page);
          r.listPageOverflow = await page.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth + 1);
          const createBtn = page.locator('button:has-text("Создать документ"), button:has-text("Новый документ"), button:has-text("Создать")').first();
          if (await createBtn.isVisible().catch(() => false)) {
            await createBtn.click();
            await page.waitForTimeout(700);
            await killPortal(page);
            r.createDialog = await dialogGeometry(page);
            await page.screenshot({ path: path.join(SHOTS, `${key}-1-create-dialog.png`) });
            await page.keyboard.press("Escape");
            await page.waitForTimeout(300);
          }
          await page.screenshot({ path: path.join(SHOTS, `${key}-0-list.png`) });
          await page.goto(`${BASE}/settings/journals/paper/${pd.journalId}/documents/${pd.id}`, NAV);
          await page.waitForTimeout(1500);
          await killPortal(page);
          r.table = await measure(page);
          await page.screenshot({ path: path.join(SHOTS, `${key}-2-doc.png`) });
          await page.evaluate(() => {
            const scrollers = Array.from(document.querySelectorAll("*")).filter((el) => {
              const s = getComputedStyle(el);
              return (s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1;
            });
            for (const el of scrollers) el.scrollLeft = 200;
            document.scrollingElement!.scrollLeft = 200;
          });
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(SHOTS, `${key}-3-doc-scrolled.png`) });
        } catch (e) {
          r.error = String(e).slice(0, 300);
        }
        results[key] = r;
        console.log(key, JSON.stringify({ overflow: (r.table as Geometry | undefined)?.pageOverflow, same: (r.table as Geometry | undefined)?.sameContainer, scrollers: (r.table as Geometry | undefined)?.scrollers.length, dialog: r.createDialog }));
      }
    }
  } finally {
    fs.writeFileSync(path.join(DIR, `e2e/crawl-results-${process.env.OUT ?? "all"}.json`), JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
