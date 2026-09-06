/* eslint-disable no-console */
// Аудит всплывашек на маленьком телефоне: помещается ли карточка в экран,
// виден ли крестик и главная кнопка, есть ли внутренний скролл.
//   W=375 H=600 BASE=http://localhost:3020 node --env-file=.env.local --import tsx .agent/tasks/mobile-journals-2026-09/e2e/modal-audit.ts
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const W = Number(process.env.W ?? 375);
const H = Number(process.env.H ?? 600);
const DIR = path.resolve(process.cwd(), ".agent/tasks/mobile-journals-2026-09");
const SHOTS = path.join(DIR, "shots-modals");
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);
const NAV = { waitUntil: "domcontentloaded" as const, timeout: 180_000 };

type Case = { name: string; url: string; open: (page: Page) => Promise<void> };

const CASES: Case[] = [
  {
    name: "partner-hint",
    url: "/dashboard",
    open: async (page) => {
      await page
        .locator('button[aria-label^="Партнёрская программа"]')
        .first()
        .click();
    },
  },
  {
    name: "journal-instruction",
    url: "/journals/hygiene",
    open: async (page) => {
      await page.locator('button:has-text("Инструкция")').first().click();
    },
  },
  {
    name: "create-document",
    url: "/journals/hygiene",
    open: async (page) => {
      await page.locator('button:has-text("Создать документ")').first().click();
    },
  },
  {
    name: "auto-create",
    url: "/journals/hygiene",
    open: async (page) => {
      await page.locator('button[role="switch"]').first().click();
    },
  },
  {
    name: "staff-add",
    url: "/settings/users",
    open: async (page) => {
      await page.locator('button:has-text("Добавить")').first().click();
    },
  },
  {
    name: "document-settings",
    url: "/journals/hygiene/documents/cmt6j45i60htw82tsj2nnpgzw",
    open: async (page) => {
      await page.locator('button:has-text("Настройки журнала")').first().click();
    },
  },
  {
    name: "document-autofill-off",
    url: "/journals/hygiene/documents/cmt6j45i60htw82tsj2nnpgzw",
    open: async (page) => {
      await page.locator('button[role="switch"]').first().click();
    },
  },
  {
    name: "feedback",
    url: "/mini/me",
    open: async (page) => {
      await page
        .locator('button:has-text("Обратная связь"), button:has(svg.lucide-message-circle-more)')
        .first()
        .click();
    },
  },
  {
    name: "whats-new",
    url: "/dashboard?whatsnew=1",
    open: async () => {
      /* модалка открывается сама, если есть новости */
    },
  },
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"], [data-slot="dialog-content"]'),
    ).filter((el) => el.getBoundingClientRect().height > 0);
    const dialog = dialogs[dialogs.length - 1] as HTMLElement | undefined;
    if (!dialog) return null;
    // Карточка: сам элемент, если он и есть карточка (Radix), иначе второй ребёнок.
    // Карточка: у shadcn-диалога это сам content, у самописных
    // оверлеев — второй ребёнок (первый — затемнение).
    const slot = document.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const isOverlay =
      getComputedStyle(dialog).position === "fixed" &&
      dialog.clientWidth >= window.innerWidth - 1 &&
      dialog.clientHeight >= window.innerHeight - 1;
    const card = (slot && dialog.contains(slot)
      ? slot
      : isOverlay
        ? (dialog.querySelector(":scope > div:nth-child(2)") as HTMLElement | null) ?? dialog
        : dialog) as HTMLElement;
    const r = card.getBoundingClientRect();
    const closes = Array.from(
      card.querySelectorAll<HTMLElement>('button[aria-label="Закрыть"], button[aria-label="Close"], [data-slot="dialog-close"], button:has(svg.lucide-x)'),
    ).filter((el) => el.getClientRects().length > 0);
    const closeRects = closes.map((el) => el.getBoundingClientRect());
    const closeVisible = closeRects.some(
      (cr) => cr.top >= -1 && cr.bottom <= window.innerHeight + 1 && cr.width > 0,
    );
    const buttons = Array.from(card.querySelectorAll("button")).filter(
      (b) => b.getClientRects().length > 0,
    );
    const primary = buttons.filter((b) => {
      const bg = getComputedStyle(b).backgroundColor;
      return bg.includes("85, 102, 246") || bg.includes("85, 99, 255");
    });
    const primaryVisible = primary.some((b) => {
      const br = b.getBoundingClientRect();
      return br.top >= -1 && br.bottom <= window.innerHeight + 1;
    });
    const scroller = Array.from(card.querySelectorAll<HTMLElement>("*")).find((el) => {
      const s = getComputedStyle(el);
      return (
        (s.overflowY === "auto" || s.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 1
      );
    });
    return {
      cardTop: Math.round(r.top),
      cardBottom: Math.round(r.bottom),
      cardHeight: Math.round(r.height),
      vh: window.innerHeight,
      cardFits: r.top >= -1 && r.bottom <= window.innerHeight + 1,
      closeButtons: closes.length,
      closeVisible,
      primaryButtons: primary.length,
      primaryVisible,
      innerScroll: Boolean(scroller),
      cardScrolls: card.scrollHeight > card.clientHeight + 1,
    };
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
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

    for (const c of CASES) {
      const r: Record<string, unknown> = {};
      try {
        await page.goto(`${BASE}${c.url}`, NAV);
        await page.waitForTimeout(2500);
        await page.evaluate(() =>
          document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
        );
        await c.open(page);
        await page.waitForTimeout(2000);
        await page.evaluate(() =>
          document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()),
        );
        r.geometry = await measure(page);
        await page.screenshot({ path: path.join(SHOTS, `${W}x${H}-${c.name}.png`) });
        await page.keyboard.press("Escape");
      } catch (e) {
        r.error = String(e).slice(0, 160);
      }
      results[c.name] = r;
      console.log(c.name, JSON.stringify(r.geometry ?? r.error));
    }
  } finally {
    fs.writeFileSync(
      path.join(DIR, `e2e/modal-audit-${W}x${H}.json`),
      JSON.stringify(results, null, 2),
    );
    await browser.close();
  }
})();
