// Фаза A — меню панели платформы (AC1–AC3).
// Запуск: npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/phase-a-menu.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

import { BASE, HERE, STORAGE } from "./config";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

/**
 * Переполнение меряем по шапке, а не по всей странице: ниже на /root
 * стоит широкая таблица организаций в собственном скроллере, она давала
 * бы ложное срабатывание и была такой всегда.
 *
 * Правый край каждого ВИДИМОГО пункта не должен выходить за окно.
 * Скрытые панели выпадашек из замера исключены — они absolute и
 * невидимы, но участвуют в раскладке.
 */
async function headerOverflow(page: Page): Promise<{ delta: number; worst: string }> {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return { delta: -1, worst: "header не найден" };
    const limit = document.documentElement.clientWidth;
    let delta = header.scrollWidth - header.clientWidth;
    let worst = `header ${header.scrollWidth}/${header.clientWidth}`;
    const nav = header.querySelector('nav[aria-label="Разделы платформы"]');
    for (const el of Array.from(nav?.children ?? [])) {
      const target = el.tagName === "DIV" ? el.querySelector("button") ?? el : el;
      const rect = (target as HTMLElement).getBoundingClientRect();
      if (rect.width === 0) continue;
      const over = Math.round(rect.right - limit);
      if (over > delta) {
        delta = over;
        worst = `${(target.textContent || "").trim()} право=${Math.round(rect.right)} > ${limit}`;
      }
    }
    return { delta, worst };
  });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ storageState: STORAGE });
    const page = await context.newPage();

    // --- AC1: три ширины, ничего не вылезает.
    for (const size of [
      { w: 1920, h: 1080, tag: "1920" },
      { w: 1280, h: 800, tag: "1280" },
      { w: 360, h: 740, tag: "360" },
    ]) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.goto(`${BASE}/root`, { waitUntil: "load" });
      await page.waitForTimeout(700);
      const overflow = await headerOverflow(page);
      record(`AC1 ${size.tag}px: шапка не вылезает за край`, overflow.delta <= 1, overflow.worst);
      await page.screenshot({ path: path.join(SHOTS, `a-menu-${size.tag}.png`), fullPage: false });
    }

    // --- Верхний уровень на компьютере: шесть элементов.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/root`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    const topLevel = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Разделы платформы"]');
      if (!nav) return [];
      return Array.from(nav.children).map((el) => (el.textContent || "").trim());
    });
    // Пять: «Организации» ссылкой + четыре группы.
    record("AC1 верхний уровень — пять элементов", topLevel.length === 5, `${topLevel.length}`);

    // --- AC2: активный раздел и его группа подсвечены.
    await page.goto(`${BASE}/root/partners`, { waitUntil: "load" });
    await page.waitForTimeout(600);
    const active = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Разделы платформы"]');
      const groupButtons = Array.from(nav?.querySelectorAll("button") ?? []);
      const moneyBtn = groupButtons.find((b) => (b.textContent || "").includes("Деньги и продажи"));
      const current = nav?.querySelector('[aria-current="page"]');
      return {
        groupHighlighted: Boolean(moneyBtn?.className.includes("bg-white/10")),
        currentText: (current?.textContent || "").trim(),
        currentHref: current instanceof HTMLAnchorElement ? current.getAttribute("href") : null,
      };
    });
    record("AC2 группа активного раздела подсвечена", active.groupHighlighted, "Деньги и продажи");
    record(
      'AC2 у пункта стоит aria-current="page"',
      active.currentHref === "/root/partners",
      `${active.currentText} → ${active.currentHref}`,
    );

    // --- AC3: три страницы-сироты есть в меню (группа «Платформа»).
    const orphans = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Разделы платформы"]');
      const hrefs = Array.from(nav?.querySelectorAll("a") ?? []).map((a) => a.getAttribute("href"));
      return {
        total: hrefs.length,
        audit: hrefs.includes("/root/audit"),
        impersonations: hrefs.includes("/root/audit-impersonations"),
        timings: hrefs.includes("/root/timings"),
      };
    });
    record("AC3 «Аудит» в меню", orphans.audit);
    record("AC3 «Входы под клиента» в меню", orphans.impersonations);
    record("AC3 «Тайминги» в меню", orphans.timings);
    record("AC3 всего разделов в меню", orphans.total === 20, `${orphans.total} (19 подразделов + /root)`);

    // Раскрытая группа на скриншоте — видно и панель, и подсветку.
    const moneyButton = page
      .locator('nav[aria-label="Разделы платформы"] button', { hasText: "Деньги и продажи" })
      .first();
    await moneyButton.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, "a-menu-group-open.png") });

    // --- Телефон: лист снизу со всеми разделами.
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${BASE}/root`, { waitUntil: "load" });
    await page.waitForTimeout(700);
    const sheetButton = page.locator("button", { hasText: "Разделы" }).first();
    const hasSheetButton = await sheetButton.isVisible().catch(() => false);
    record("AC1 360px: кнопка «Разделы» видна", hasSheetButton);
    if (hasSheetButton) {
      await sheetButton.click();
      await page.waitForTimeout(900);
      const sheetLinks = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav[aria-label="Разделы платформы"]'));
        const sheet = navs[navs.length - 1];
        return Array.from(sheet?.querySelectorAll("a") ?? []).length;
      });
      record("AC1 360px: в листе все разделы", sheetLinks === 20, `${sheetLinks} ссылок`);
      const overflowOpen = await headerOverflow(page);
      record("AC1 360px: лист не ломает ширину", overflowOpen.delta <= 1, overflowOpen.worst);
      await page.screenshot({ path: path.join(SHOTS, "a-menu-360-sheet.png") });
    }

    fs.writeFileSync(path.join(HERE, "phase-a.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== Фаза A: ${checks.length - failed.length}/${checks.length} ===`);
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
