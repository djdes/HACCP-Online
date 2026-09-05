/* eslint-disable no-console */
// Проверка второго круга: мобильная пилюля, «Настроить точки», переименование,
// копирование помещений, подтверждение выключения, баннер сотрудников,
// точка по умолчанию у нового сотрудника, заметка автосоздания, Mini App.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "smoke");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/state.json"), "utf8"));
const results: Record<string, unknown> = {};

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function go(page: Page, url: string, wait = 1500) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(wait);
}
async function api(page: Page, method: "get" | "post" | "patch" | "delete", url: string, data?: unknown) {
  const res = await page.request[method](`${BASE}${url}`, data === undefined ? undefined : { data });
  return { status: res.status(), json: await res.json().catch(() => null) };
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const created: { roomIds: string[] } = { roomIds: [] };
  try {
    await go(page, "/login", 0);
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingA });
    // Гайд «Как заполнить?» всплывает один раз и перехватывает клики — помечаем виденным.
    await api(page, "post", "/api/me/notices", { key: "fill-guide:hygiene" });

    // Меню точек: «Настроить точки»
    await go(page, "/journals/hygiene");
    await page.locator('[data-tour="location-switcher"]:visible').first().click();
    const menu = page.locator('[role="menu"][data-state="open"]');
    await menu.waitFor({ state: "visible", timeout: 10_000 });
    results.manageLink = (await menu.locator('a:has-text("Настроить точки")').count()) > 0;
    await shot(page, "r2-01-menu-manage");
    await page.keyboard.press("Escape");

    // Телефон: пилюля в шапке, меню, шторка с «Разделы»
    await page.setViewportSize({ width: 390, height: 780 });
    await go(page, "/journals/hygiene");
    const mobilePill = page.locator('[data-tour="location-switcher"]:visible').first();
    results.mobilePillVisible = await mobilePill.isVisible().catch(() => false);
    results.mobilePillText = (await mobilePill.innerText().catch(() => "")).trim();
    await shot(page, "r2-02-mobile-pill");
    await mobilePill.click();
    await page.locator('[role="menu"][data-state="open"]').waitFor({ state: "visible", timeout: 10_000 });
    await shot(page, "r2-03-mobile-pill-menu");
    await page.keyboard.press("Escape");
    await page.locator("button:has(svg.lucide-menu)").first().click();
    await page.waitForTimeout(600);
    results.sheetHasSections = (await page.locator('[role="dialog"] >> text=Разделы').count()) > 0;
    await shot(page, "r2-04-mobile-sheet");
    await page.keyboard.press("Escape");

    // Настройки точек: переименование, копирование помещений, подтверждение выключения
    await page.setViewportSize({ width: 1280, height: 860 });
    const room = await api(page, "post", "/api/settings/rooms", { buildingId: state.buildingA, name: "E2E Кухня", kind: "kitchen" });
    if (room.json?.room?.id) created.roomIds.push(room.json.room.id);
    await go(page, "/settings/buildings");
    // Карточка после клика по карандашу теряет <h2> — держим элемент, а не локатор.
    const cardHandle = await page.locator("h2", { hasText: "E2E Точка Б" }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]").elementHandle();
    if (!cardHandle) throw new Error("card B not found");
    await (await cardHandle.$('button[aria-label="Переименовать точку и адрес"]'))!.click();
    await page.waitForTimeout(300);
    await (await cardHandle.$('input[aria-label="Адрес точки"]'))!.fill("пр. Мира, 10");
    await (await cardHandle.$('button:has-text("Сохранить")'))!.click();
    await page.waitForTimeout(2000);
    await go(page, "/settings/buildings");
    results.renamedAddress = (await page.locator("text=пр. Мира, 10").count()) > 0;
    const cardB2 = page.locator("h2", { hasText: "E2E Точка Б" }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]");
    results.copyControlVisible = (await cardB2.locator('button:has-text("Скопировать")').count()) > 0;
    await shot(page, "r2-05-rename-and-copy");
    await cardB2.locator('button:has-text("Скопировать")').click();
    await page.waitForTimeout(2500);
    await go(page, "/settings/buildings");
    const cardB3 = page.locator("h2", { hasText: "E2E Точка Б" }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]");
    results.copiedRoomVisible = (await cardB3.locator("text=E2E Кухня").count()) > 0;
    await shot(page, "r2-06-copied-rooms");
    await page.locator('button[role="switch"][aria-label="Вести журналы отдельно по точкам"]').click();
    await page.waitForTimeout(600);
    results.toggleOffConfirm = (await page.locator('[role="dialog"] >> text=Выключить раздельные журналы?').count()) > 0;
    await shot(page, "r2-07-toggle-off-confirm");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    results.stillEnabled = await page.locator('button[role="switch"][aria-label="Вести журналы отдельно по точкам"]').getAttribute("aria-checked");

    // Сотрудники: баннер и точка по умолчанию
    await go(page, "/settings/users", 2500);
    results.staffBanner = (await page.locator("text=без точки").count()) > 0;
    await shot(page, "r2-08-staff-banner");
    await page.setViewportSize({ width: 390, height: 780 });
    await go(page, "/settings/users", 2500);
    const addBtn = page.locator('button[aria-label^="Добавить в «"]').first();
    await addBtn.click();
    await page.locator('[role="dialog"]').last().waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(700);
    results.defaultChipA = await page.locator('[role="dialog"] button[aria-pressed="true"]', { hasText: "E2E Точка А" }).count();
    results.addDialogHeight = await page.evaluate(() => {
      const d = Array.from(document.querySelectorAll('[role="dialog"]')).filter((x) => x.getBoundingClientRect().height > 0).pop();
      const r = d?.getBoundingClientRect();
      return r ? { h: Math.round(r.height), vh: window.innerHeight, fits: r.top >= 0 && r.bottom <= window.innerHeight } : null;
    });
    await shot(page, "r2-09-mobile-add-default-point");
    await page.keyboard.press("Escape");

    // Автосоздание: заметка про точки
    await page.setViewportSize({ width: 1280, height: 860 });
    await go(page, "/settings/auto-journals");
    results.autoJournalsNote = (await page.locator("text=создаётся на каждую точку").count()) > 0;
    await shot(page, "r2-10-auto-journals-note");

    // Mini App: точка в верхней панели
    await page.setViewportSize({ width: 390, height: 780 });
    await go(page, "/mini/me", 2500);
    results.miniTopBarLocation = (await page.locator("header >> text=E2E Точка А").count()) > 0;
    await shot(page, "r2-11-mini-topbar");

    // Точка запоминается в аккаунте: cookie стёрта — точка Б осталась
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingB });
    const cookies = await ctx.cookies(BASE);
    await ctx.clearCookies();
    await ctx.addCookies(cookies.filter((c) => c.name !== "wesetup.building"));
    const home = await api(page, "get", "/api/mini/home");
    results.rememberedBuilding = home.json?.location?.activeBuildingId === state.buildingB ? "B" : home.json?.location?.activeBuildingId;

    // Крошки: общий документ подписан
    const crumbs = await api(page, "get", "/api/journals/hygiene/documents-menu");
    results.crumbSharedHint = (crumbs.json?.items ?? []).some((i: { hint?: string }) => (i.hint ?? "").startsWith("Общий"));
    const search = await api(page, "get", "/api/search?q=E2E");
    results.searchHintHasLocation = JSON.stringify(search.json ?? {}).includes("E2E Точка");
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-r2-error.png") }).catch(() => {});
  } finally {
    for (const id of created.roomIds) await page.request.delete(`${BASE}/api/settings/rooms/${id}`).catch(() => null);
    fs.writeFileSync(path.join(DIR, "e2e/verify2-results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
