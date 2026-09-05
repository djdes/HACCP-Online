/* eslint-disable no-console */
// Третий круг: сводка по точкам на дашборде, бейдж «Общий», карточка точки
// (сотрудники, КПП/телефон), шаг «Назовите точки», proxy (guard партнёра на dev),
// закрытие дня по точкам, превью по точкам, отчёты, ускорение Mini App.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "smoke");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const partner = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/creds.json"), "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/state.json"), "utf8"));
const results: Record<string, unknown> = {};

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function go(page: Page, url: string, wait = 1500) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForTimeout(wait);
}
async function api(page: Page, method: "get" | "post" | "patch" | "put" | "delete", url: string, data?: unknown) {
  const res = await page.request[method](`${BASE}${url}`, data === undefined ? undefined : { data });
  return { status: res.status(), json: await res.json().catch(() => null), headers: res.headers() };
}
async function login(page: Page, email: string, password: string) {
  await go(page, "/login", 0);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  // --- proxy (бывший middleware) на dev: трейлинг-слеш и guard партнёра ---
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const r = await page.request.get(`${BASE}/journals/hygiene/`, { maxRedirects: 0 }).catch(() => null);
    results.proxyTrailingSlash = r ? `${r.status()} -> ${r.headers()["location"] ?? ""}` : "error";
    await login(page, partner.email, partner.password);
    results.partnerOpen = (await api(page, "post", `/api/partner/clients/${state.org}/open`)).status;
    results.partnerCreateBuilding = (await api(page, "post", "/api/settings/buildings", { name: "Партнёрская точка" })).status;
    results.partnerToggleFlag = (await api(page, "patch", "/api/settings/buildings", { perLocationJournals: false })).status;
    results.partnerCreateDocument = (await api(page, "post", "/api/journal-documents", { templateCode: "hygiene", dateFrom: "2026-12-01", dateTo: "2026-12-15" })).status;
    results.partnerSwitchBuilding = (await api(page, "post", "/api/me/active-building", { buildingId: state.buildingB })).status;
    await api(page, "post", "/api/partner/exit");
    await ctx.close();
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await login(page, creds.email, creds.password);
    await api(page, "post", "/api/me/notices", { key: "fill-guide:hygiene" });
    // Если guard партнёра на dev не сработал — вернуть режим и убрать мусор.
    await api(page, "patch", "/api/settings/buildings", { perLocationJournals: true });
    const list = await api(page, "get", "/api/settings/buildings");
    for (const b of (list.json?.buildings ?? []).filter((x: { name: string }) => x.name === "Партнёрская точка")) {
      await page.request.delete(`${BASE}/api/settings/buildings/${b.id}`);
    }
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingA });

    // --- дашборд: сводка по точкам ---
    await go(page, "/dashboard", 2500);
    const strip = page.locator('section[aria-label="Сводка по точкам"]');
    results.dashboardStrip = await strip.isVisible().catch(() => false);
    results.dashboardStripText = (await strip.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
    await shot(page, "r3-01-dashboard-strip");
    await strip.locator("button", { hasText: "E2E Точка Б" }).click();
    await page.waitForTimeout(3000);
    results.stripSwitchedPill = (await page.locator('[data-tour="location-switcher"]:visible').first().innerText().catch(() => "")).trim();
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingA });

    // --- бейдж «Общий» в списке документов ---
    await go(page, "/journals/hygiene", 2000);
    results.sharedBadgeCount = await page.locator("text=Общий").count();
    await shot(page, "r3-02-shared-badge");

    // --- закрытие дня по точкам ---
    const tpl = await api(page, "get", "/api/journals/today-status");
    void tpl;
    const closeA = await api(page, "post", "/api/dashboard/close-day", { kind: "no-events", reason: "e2e" }).catch(() => ({ status: 0, json: null, headers: {} }));
    results.closeDayStatus = closeA.status;
    const statusA = await api(page, "get", "/api/journals/today-status");
    const hygieneA = (statusA.json?.journals ?? statusA.json?.items ?? []).find?.((j: { code?: string }) => j.code === "hygiene");
    results.closeDayHygieneA = hygieneA ? JSON.stringify(hygieneA).slice(0, 120) : JSON.stringify(statusA.json).slice(0, 120);
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingB });
    const statusB = await api(page, "get", "/api/journals/today-status");
    const hygieneB = (statusB.json?.journals ?? statusB.json?.items ?? []).find?.((j: { code?: string }) => j.code === "hygiene");
    results.closeDayHygieneB = hygieneB ? JSON.stringify(hygieneB).slice(0, 120) : JSON.stringify(statusB.json).slice(0, 120);
    await api(page, "post", "/api/me/active-building", { buildingId: state.buildingA });

    // --- карточка точки: КПП/телефон и сотрудники точки ---
    await go(page, "/settings/buildings", 1500);
    const cardHandle = await page.locator("h2", { hasText: "E2E Точка Б" }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]").elementHandle();
    if (!cardHandle) throw new Error("card B not found");
    await (await cardHandle.$('button[aria-label="Переименовать точку и адрес"]'))!.click();
    await page.waitForTimeout(300);
    await (await cardHandle.$('input[aria-label="КПП точки"]'))!.fill("770101001");
    await (await cardHandle.$('input[aria-label="Телефон точки"]'))!.fill("+7 999 111-22-33");
    await (await cardHandle.$('button:has-text("Сохранить")'))!.click();
    await page.waitForTimeout(2000);
    await go(page, "/settings/buildings", 1500);
    results.kppShown = (await page.locator("text=КПП 770101001").count()) > 0;
    const cardB = await page.locator("h2", { hasText: "E2E Точка Б" }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]").elementHandle();
    await (await cardB!.$('button:has-text("Изменить")'))!.click();
    await page.waitForTimeout(400);
    const firstBox = await cardB!.$('input[type="checkbox"]');
    await firstBox!.check();
    await shot(page, "r3-03-point-staff-picker");
    await (await cardB!.$('button:has-text("Сохранить")'))!.click();
    await page.waitForTimeout(2000);
    await go(page, "/settings/buildings", 1500);
    const cardB2 = await page.locator("h2", { hasText: "E2E Точка Б" }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]").elementHandle();
    results.staffHereAfter = (await cardB2!.innerText()).match(/здесь:\s*(\d+)/)?.[1] ?? null;
    await shot(page, "r3-04-point-card");

    // --- отчёты: подпись точки ---
    await go(page, "/reports", 2500);
    results.reportsPointNote = (await page.locator("text=графики и счётчики по документам").count()) > 0;
    await shot(page, "r3-05-reports-point");

    // --- Mini App: время ответа /api/mini/home (второй запрос — фон) ---
    await api(page, "get", "/api/mini/home");
    const t0 = Date.now();
    await api(page, "get", "/api/mini/home");
    results.miniHomeSecondMs = Date.now() - t0;

    // --- шаг «Назовите точки»: анкета с «Точек» = 2 (данные тестовой организации) ---
    await page.setViewportSize({ width: 390, height: 780 });
    await go(page, "/dashboard?welcome=1", 2000);
    const nudge = page.locator('[role="dialog"][aria-labelledby="complete-profile-title"]');
    if (await nudge.isVisible().catch(() => false)) {
      await nudge.locator('input[placeholder="ООО «Ромашка»"]').fill("Кафе «Тестовое 1»");
      await nudge.locator('input[placeholder="+7 999 123-45-67"]').click();
      await page.keyboard.type("9991234567", { delay: 20 });
      await nudge.locator('button[aria-label="Больше"]').first().click().catch(() => {});
      await page.waitForTimeout(300);
      await nudge.locator('button[type="submit"]').click();
      await page.waitForTimeout(4000);
      results.namingStepTitle = (await page.locator("#complete-profile-title").innerText().catch(() => "")).trim();
      results.namingInputs = await page.locator('input[aria-label^="Название точки"]').count();
      const dlg = await page.evaluate(() => {
        const d = Array.from(document.querySelectorAll('[role="dialog"]')).filter((x) => x.getBoundingClientRect().height > 0).pop();
        const r = d?.getBoundingClientRect();
        return r ? { h: Math.round(r.height), vh: window.innerHeight, fits: r.top >= 0 && r.bottom <= window.innerHeight } : null;
      });
      results.namingDialog = dlg;
      await shot(page, "r3-06-naming-step");
      await page.locator('button:has-text("Позже")').click().catch(() => {});
    } else {
      results.namingStep = "анкета не открылась";
    }
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-r3-error.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(DIR, "e2e/verify3-results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
