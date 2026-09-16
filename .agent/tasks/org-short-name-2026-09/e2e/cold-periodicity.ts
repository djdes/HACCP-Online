// e2e: периодичность контроля в журнале холодильного оборудования — карандаш в шапке (Enter сохраняет)
// и поле в «Настройках журнала». Запуск: npx tsx .agent/tasks/org-short-name-2026-09/e2e/cold-periodicity.ts
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { db, E2E_DATABASE_URL } from "../../journal-responsibles-org-2026-09/e2e/db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SHOTS = path.join(HERE, "..", "shots");
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));

const checks: Array<{ name: string; ok: boolean; detail?: unknown }> = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
};
const periodicityOf = async (id: string) =>
  ((await db.journalDocument.findUnique({ where: { id }, select: { config: true } }))?.config as Record<string, unknown> | null)?.controlPeriodicity;

async function main() {
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DATABASE_URL_DIRECT = E2E_DATABASE_URL;
  const browser = await chromium.launch({ headless: true });
  let id: string | null = null;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
    await page.fill("#email", state.users.managerA.email);
    await page.fill("#password", state.password);
    await page.waitForLoadState("networkidle").catch(() => null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.click('button[type="submit"]').catch(() => null);
      const left = await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }).then(() => true).catch(() => false);
      if (left) break;
      if (attempt === 2) throw new Error("login: форма не отправилась");
      await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
      await page.fill("#email", state.users.managerA.email);
      await page.fill("#password", state.password);
      await page.waitForTimeout(1500);
    }

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const created = await ctx.request.post(`${BASE}/api/journal-documents`, {
      data: { templateCode: "cold_equipment_control", title: "E2E холод периодичность", dateFrom: `${y}-${pad(m + 1)}-01`, dateTo: `${y}-${pad(m + 1)}-${pad(last)}`, force: true },
      timeout: 180_000,
    });
    id = (await created.json().catch(() => null))?.document?.id ?? null;
    check("документ холодильного журнала создан", created.ok() && Boolean(id), created.status());

    await page.goto(`${BASE}/journals/cold_equipment_control/documents/${id}`, { waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(3000);
    const guide = page.locator('[role="dialog"][aria-labelledby="fill-guide-title"]');
    if (await guide.isVisible().catch(() => false)) await guide.getByRole("button", { name: "Понятно" }).first().click().catch(() => null);

    // 1. Карандаш в шапке, сохранение по Enter.
    const cell = page.locator('td[class*="header-periodicity"]').first();
    check("шапка: строка «Периодичность контроля» есть (дефолт шаблона)", (await cell.innerText()).includes("Ежедневно"), await cell.innerText());
    await cell.hover();
    const pencil = page.getByRole("button", { name: "Изменить периодичность контроля" });
    check("шапка: карандаш у периодичности виден по наведению", await pencil.first().isVisible());
    await pencil.first().click({ force: true });
    const editor = page.getByRole("textbox", { name: "Изменить периодичность контроля" }).first();
    await editor.waitFor({ timeout: 15_000 });
    check("шапка: подсказка «Enter — сохранить, Shift+Enter — новая строка»", (await page.locator("body").innerText()).includes("Enter — сохранить, Shift+Enter — новая строка"));
    await editor.fill("Два раза в смену — E2E через карандаш");
    await editor.press("Enter");
    const toast = await page.locator("[data-sonner-toast]", { hasText: "Периодичность контроля обновлена" }).first().waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    check("шапка: Enter сохраняет, тост «Периодичность контроля обновлена»", toast);
    check("шапка: config.controlPeriodicity записан", (await periodicityOf(id!)) === "Два раза в смену — E2E через карандаш", await periodicityOf(id!));
    await page.screenshot({ path: path.join(SHOTS, "cold-periodicity-pencil.png") });

    // 2. «Настройки журнала»: поле периодичности.
    await page.reload({ waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Настройки журнала" }).first().click();
    const field = page.getByRole("textbox", { name: "Периодичность контроля" }).first();
    await field.waitFor({ timeout: 30_000 });
    check("настройки: поле «Периодичность контроля» с текущим значением", (await field.inputValue()) === "Два раза в смену — E2E через карандаш", await field.inputValue());
    await field.fill("Три раза в смену — E2E через настройки");
    await page.screenshot({ path: path.join(SHOTS, "cold-periodicity-settings.png") });
    await page.getByRole("dialog").last().getByRole("button", { name: "Сохранить" }).last().click();
    await page.waitForTimeout(3000);
    check("настройки: сохранение записывает периодичность", (await periodicityOf(id!)) === "Три раза в смену — E2E через настройки", await periodicityOf(id!));
    await page.reload({ waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(2000);
    check("шапка после настроек: новый текст", (await page.locator('td[class*="header-periodicity"]').first().innerText()).includes("Три раза в смену"));

    // 3. Сохранение строк документа не стирает периодичность.
    const cfg = (await db.journalDocument.findUnique({ where: { id: id! }, select: { config: true } }))?.config as Record<string, unknown>;
    const { controlPeriodicity: _omit, ...withoutHeader } = cfg;
    void _omit;
    const rowSave = await ctx.request.patch(`${BASE}/api/journal-documents/${id}`, { data: { config: withoutHeader } });
    check("сохранение конфига без поля шапки не стирает периодичность", rowSave.ok() && (await periodicityOf(id!)) === "Три раза в смену — E2E через настройки", { status: rowSave.status(), value: await periodicityOf(id!) });
    await ctx.close();
  } catch (error) {
    console.error("E2E ERROR", error);
    checks.push({ name: "e2e без исключений", ok: false, detail: String(error).slice(0, 600) });
  } finally {
    await browser.close();
    if (id) await db.journalDocument.delete({ where: { id } }).catch(() => null);
    const passed = checks.filter((c) => c.ok).length;
    fs.writeFileSync(path.join(HERE, "cold-periodicity.json"), JSON.stringify(checks, null, 2));
    console.log(`\n${passed}/${checks.length} PASS`);
    await db.$disconnect();
    process.exit(passed === checks.length ? 0 : 1);
  }
}

main();
