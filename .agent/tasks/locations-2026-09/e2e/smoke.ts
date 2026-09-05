/* eslint-disable no-console */
// Дым по экранам точек: одна/две точки, партнёр, мобильная версия, всплывашки.
//   npx tsx .agent/tasks/locations-2026-09/e2e/smoke.ts
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "smoke");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/state.json"), "utf8"));
const results: Record<string, unknown> = {};
const fits: Record<string, unknown> = {};
fs.mkdirSync(OUT, { recursive: true });

const MOBILE = { width: 390, height: 780 };
const DESKTOP = { width: 1280, height: 860 };

async function dropDevOverlay(page: Page) {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
}
async function shot(page: Page, name: string) {
  await dropDevOverlay(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function go(page: Page, url: string, wait = 1500) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(wait);
}
/** Влезает ли открытый диалог в первый экран телефона. */
async function measureDialog(page: Page, key: string) {
  const info = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter((d) => {
      const r = d.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const d = dialogs[dialogs.length - 1] as HTMLElement | undefined;
    if (!d) return null;
    const r = d.getBoundingClientRect();
    const vh = window.innerHeight;
    const buttons = Array.from(d.querySelectorAll("button")).filter((b) => b.getBoundingClientRect().height > 0);
    const primary = buttons.filter((b) => /Добавить|Сохранить|Готово|Создать|Удалить|Понятно|Найти/.test(b.textContent ?? "")).pop();
    const pr = primary?.getBoundingClientRect();
    const scroller = Array.from(d.querySelectorAll("*")).find((el) => {
      const cs = getComputedStyle(el);
      return /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
    }) as HTMLElement | undefined;
    return {
      top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), vh,
      fitsViewport: r.top >= -1 && r.bottom <= vh + 1,
      primary: primary?.textContent?.trim() ?? null,
      primaryVisible: pr ? pr.bottom <= vh + 1 && pr.top >= 0 : null,
      innerScroll: scroller ? { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight } : null,
    };
  });
  fits[key] = info;
  return info;
}
async function api(page: Page, method: "get" | "post" | "put" | "patch", url: string, data?: unknown) {
  const res = await page.request[method](`${BASE}${url}`, data === undefined ? undefined : { data });
  return { status: res.status(), json: await res.json().catch(() => null) };
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 120)));
  try {
    await go(page, "/login", 0);
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });

    // ---------- одна точка (режим выключен) ----------
    results.flagOff = (await api(page, "patch", "/api/settings/buildings", { perLocationJournals: false })).status;
    await go(page, "/journals/hygiene");
    results.pillWhenOff = await page.locator('[data-tour="location-switcher"]').count();
    await shot(page, "01-desktop-one-location-journals");
    await go(page, "/settings/buildings");
    await shot(page, "02-desktop-settings-toggle-off");
    results.flagOn = (await api(page, "patch", "/api/settings/buildings", { perLocationJournals: true })).status;

    // ---------- две точки ----------
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingA });
    await go(page, "/journals/hygiene");
    await shot(page, "03-desktop-two-locations-journals");
    await page.locator('[data-tour="location-switcher"]').click();
    await page.locator('[role="menu"][data-state="open"]').waitFor({ state: "visible", timeout: 10_000 });
    await shot(page, "04-desktop-location-menu");
    await page.keyboard.press("Escape");
    await go(page, "/journals");
    await shot(page, "05-desktop-journals-hub");
    await go(page, "/dashboard");
    await shot(page, "06-desktop-dashboard");
    await go(page, `/journals/hygiene/documents/${state.docA}`);
    await shot(page, "07-desktop-document-header");
    await go(page, "/settings/buildings");
    await shot(page, "08-desktop-settings-toggle-on");
    await go(page, "/settings");
    await shot(page, "09-desktop-settings-hub");

    // Сотрудники: диалоги с чипами «Точки»
    await go(page, "/settings/users", 2500);
    const addBtn = page.locator('button[aria-label^="Добавить в «"]').first();
    if (await addBtn.count()) {
      await addBtn.click();
      await page.locator('[role="dialog"]').last().waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(600);
      await shot(page, "10-desktop-staff-add-dialog");
      results.addDialogHasChips = (await page.locator('[role="dialog"] >> text=Все точки').count()) > 0;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    } else {
      results.addDialog = "кнопка добавления не найдена";
    }
    let edit = page.locator('button[aria-label="Редактировать сотрудника"]').first();
    if (!(await edit.isVisible().catch(() => false))) {
      const expander = page.locator('button[aria-expanded="false"]').first();
      if (await expander.count()) await expander.click();
      await page.waitForTimeout(500);
      edit = page.locator('button[aria-label="Редактировать сотрудника"]').first();
    }
    if (await edit.isVisible().catch(() => false)) {
      await edit.click();
      await page.locator('[role="dialog"]').last().waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(600);
      await shot(page, "11-desktop-staff-edit-dialog");
      results.editDialogHasChips = (await page.locator('[role="dialog"] >> text=Все точки').count()) > 0;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    } else {
      results.editDialog = "кнопка редактирования не найдена";
    }

    // ---------- партнёр уровня «просмотр» в кабинете клиента ----------
    const open = await api(page, "post", `/api/partner/clients/${state.org}/open`);
    results.partnerOpen = open.status;
    if (open.status === 200) {
      await go(page, "/journals/hygiene", 2000);
      await shot(page, "12-desktop-partner-cabinet");
      results.partnerPill = await page.locator('[data-tour="location-switcher"]').count();
      results.partnerSwitch = (await api(page, "post", "/api/me/active-building", { buildingId: state.buildingB })).status;
      results.partnerCreateBuilding = (await api(page, "post", "/api/settings/buildings", { name: "Партнёрская точка" })).status;
      results.partnerToggleFlag = (await api(page, "patch", "/api/settings/buildings", { perLocationJournals: false })).status;
      await go(page, "/journals/hygiene", 1500);
      results.partnerPillAfterSwitch = (await page.locator('[data-tour="location-switcher"]').innerText().catch(() => "")).trim();
      await shot(page, "13-desktop-partner-after-switch");
      results.partnerExit = (await api(page, "post", "/api/partner/exit")).status;
      // Вернуть состояние: режим включён, партнёрская точка удалена.
      results.flagOnAfterPartner = (await api(page, "patch", "/api/settings/buildings", { perLocationJournals: true })).status;
      const list = await api(page, "get", "/api/settings/buildings");
      const stray = (list.json?.buildings ?? []).filter((b: { name: string }) => b.name === "Партнёрская точка");
      for (const b of stray) await api(page, "post", `/api/settings/buildings/${b.id}`).catch(() => null);
      for (const b of stray) await page.request.delete(`${BASE}/api/settings/buildings/${b.id}`);
      results.strayDeleted = stray.length;
      results.flagAfterPartner = (await api(page, "get", "/api/mini/home")).json?.location?.enabled ?? null;
    }

    // ---------- мобильная версия ----------
    await page.setViewportSize(MOBILE);
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingA });
    await go(page, "/journals/hygiene");
    await shot(page, "14-mobile-journals");
    await page.locator("button:has(svg.lucide-menu)").first().click();
    await page.waitForTimeout(700);
    await shot(page, "15-mobile-menu-sheet");
    results.mobileSheetHasLocations = (await page.locator('[role="dialog"] >> text=E2E Точка Б').count()) > 0;
    await measureDialog(page, "mobile-menu-sheet");
    await page.keyboard.press("Escape");

    await go(page, `/journals/hygiene/documents/${state.docA}`);
    await shot(page, "16-mobile-document-header");

    await go(page, "/settings/buildings");
    await shot(page, "17-mobile-settings-buildings");
    await page.locator('button:has-text("Добавить точку")').first().click();
    await page.waitForTimeout(500);
    await shot(page, "18-mobile-add-point-form");
    await page.locator('button[aria-label="Удалить здание"], button[aria-label="Удалить точку"]').first().click();
    await page.locator('[role="dialog"]').last().waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(500);
    await measureDialog(page, "mobile-delete-point-confirm");
    await shot(page, "19-mobile-delete-point-confirm");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    await go(page, "/settings/users", 2500);
    const addBtnM = page.locator('button[aria-label^="Добавить в «"]').first();
    if (await addBtnM.count()) {
      await addBtnM.click();
      await page.locator('[role="dialog"]').last().waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(700);
      await measureDialog(page, "mobile-staff-add-dialog");
      await shot(page, "20-mobile-staff-add-dialog");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
    let editM = page.locator('button[aria-label="Редактировать сотрудника"]').first();
    if (!(await editM.isVisible().catch(() => false))) {
      const expander = page.locator('button[aria-expanded="false"]').first();
      if (await expander.count()) await expander.click();
      await page.waitForTimeout(500);
      editM = page.locator('button[aria-label="Редактировать сотрудника"]').first();
    }
    if (await editM.isVisible().catch(() => false)) {
      await editM.click();
      await page.locator('[role="dialog"]').last().waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(700);
      await measureDialog(page, "mobile-staff-edit-dialog");
      await shot(page, "21-mobile-staff-edit-dialog");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // Анкета после регистрации: «Точек» = 2 → подпись про точки
    await go(page, "/dashboard?welcome=1", 1500);
    const nudge = page.locator('[role="dialog"][aria-labelledby="complete-profile-title"]');
    if (await nudge.isVisible().catch(() => false)) {
      await nudge.locator('button[aria-label="Больше"]').first().click().catch(() => {});
      await page.waitForTimeout(400);
      await measureDialog(page, "mobile-profile-nudge-two-locations");
      await shot(page, "22-mobile-profile-nudge-two-locations");
      await page.keyboard.press("Escape");
    } else {
      results.nudge = "анкета не открылась";
    }

    // Mini App
    await go(page, "/mini/me", 4000);
    await shot(page, "23-mini-me-switcher");
    results.miniMeSwitcher = (await page.locator("text=E2E Точка Б").count()) > 0;

    // Сотрудник, ограниченный одной точкой
    results.restrict = (await api(page, "put", `/api/users/${creds.id}`, { buildingIds: [state.buildingB] })).status;
    await go(page, "/journals/hygiene");
    results.restrictedPill = await page.locator('[data-tour="location-switcher"]').count();
    await shot(page, "24-mobile-restricted-no-pill");
    await go(page, "/mini/me", 4000);
    await shot(page, "25-mini-me-restricted");
    results.miniRestrictedSwitcher = (await page.locator("text=E2E Точка А").count()) > 0;
    results.reset = (await api(page, "put", `/api/users/${creds.id}`, { buildingIds: [] })).status;
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(DIR, "e2e/smoke-results.json"), JSON.stringify({ results, fits }, null, 2));
    console.log(JSON.stringify({ results, fits }, null, 2));
    await browser.close();
  }
}
main();
