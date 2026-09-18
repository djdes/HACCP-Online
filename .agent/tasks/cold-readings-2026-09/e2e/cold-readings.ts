// e2e cold-readings-2026-09: журнал холодильного оборудования — несколько замеров в день и минус с телефона.
// Запуск (dev на 3020 с wesetup_e2e): npx tsx .agent/tasks/cold-readings-2026-09/e2e/cold-readings.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

import { db, E2E_DATABASE_URL } from "../../journal-responsibles-org-2026-09/e2e/db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SHOTS = path.join(HERE, "..", "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));
const U = state.users as Record<string, { id: string; email: string }>;
const ORG_A = state.orgA as string;

const checks: Array<{ name: string; ok: boolean; detail?: unknown }> = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 500)}` : ""}`);
};

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
  await page.locator("#email").waitFor({ timeout: 120_000 });
  await page.fill("#email", email);
  await page.fill("#password", state.password);
  await page.waitForLoadState("networkidle").catch(() => null);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.click('button[type="submit"]').catch(() => null);
    const left = await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }).then(() => true).catch(() => false);
    if (left) return;
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
    await page.fill("#email", email);
    await page.fill("#password", state.password);
    await page.waitForTimeout(1500);
  }
  throw new Error("login: форма не отправилась");
}

/** Все значения температур документа за сегодня, слитые по сотрудникам. */
async function dayTemperatures(documentId: string, day: Date) {
  const entries = await db.journalDocumentEntry.findMany({ where: { documentId, date: day }, select: { data: true, employeeId: true } });
  const merged: Record<string, number> = {};
  for (const entry of entries) {
    const temps = ((entry.data as { temperatures?: Record<string, number | null> } | null)?.temperatures ?? {}) as Record<string, number | null>;
    for (const [key, value] of Object.entries(temps)) if (value != null) merged[key] = value;
  }
  return { merged, employees: entries.length };
}

async function main() {
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DATABASE_URL_DIRECT = E2E_DATABASE_URL;
  const day = new Date(`${todayKey()}T00:00:00.000Z`);
  const area = await db.area.findFirstOrThrow({ where: { organizationId: ORG_A, name: "Горячий цех" } });
  const ensure = async (name: string, tempMin: number, tempMax: number, type: string) =>
    (await db.equipment.findFirst({ where: { areaId: area.id, name } })) ??
    (await db.equipment.create({ data: { areaId: area.id, name, type, tempMin, tempMax } }));
  const fridge = await ensure("Холодильник QR E2E", 2, 6, "refrigerator");
  const freezer = await ensure("Морозилка QR E2E", -24, -18, "freezer");
  const template = await db.journalTemplate.findUniqueOrThrow({ where: { code: "cold_equipment_control" } });
  await db.journalDocument.updateMany({ where: { organizationId: ORG_A, templateId: template.id, status: "active" }, data: { status: "closed" } });
  const doc = await db.journalDocument.create({
    data: {
      organizationId: ORG_A,
      templateId: template.id,
      title: "E2E замеры два раза в день",
      dateFrom: day,
      dateTo: day,
      responsibleUserId: U.cookA.id,
      config: {
        equipment: [
          { id: "cold-fridge", sourceEquipmentId: fridge.id, name: fridge.name, min: 2, max: 6, readingMode: "twice" },
          { id: "cold-freezer", sourceEquipmentId: freezer.id, name: freezer.name, min: -24, max: -18 },
        ],
        skipWeekends: false,
      },
    },
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, U.managerA.email);

    // Ссылки плакатов — как их видит телефон.
    await page.goto(`${BASE}/settings/qr-posters?kind=equipment&origin=${encodeURIComponent(BASE)}`, { waitUntil: "load", timeout: 300_000 });
    const urlOf = async (id: string) => page.locator(`[data-qr-poster][data-qr-id="${id}"]`).getAttribute("data-qr-url");
    const fridgeUrl = await urlOf(fridge.id);
    const freezerUrl = await urlOf(freezer.id);
    check("плакаты холодильника и морозилки есть", Boolean(fridgeUrl) && Boolean(freezerUrl), { fridgeUrl, freezerUrl });
    const fridgeToken = new URL(fridgeUrl!).searchParams.get("token")!;
    const freezerToken = new URL(freezerUrl!).searchParams.get("token")!;
    const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const post = (url: string, data: unknown) => anonymous.request.post(`${BASE}${url}`, { data, timeout: 120_000 });

    // 1. Два замера в день: первый скан → 1-й замер, второй (другой сотрудник) → 2-й, третий → снова 2-й.
    const first = await post(`/api/equipment-fill/${fridge.id}`, { token: fridgeToken, employeeId: U.cookA.id, temperature: 4 });
    let temps = await dayTemperatures(doc.id, day);
    check("QR: первый скан за день — 1-й замер", first.ok() && temps.merged["cold-fridge"] === 4 && temps.merged["cold-fridge#2"] === undefined, { status: first.status(), temps });
    const second = await post(`/api/equipment-fill/${fridge.id}`, { token: fridgeToken, employeeId: U.managerA.id, temperature: 5 });
    temps = await dayTemperatures(doc.id, day);
    check("QR: второй скан (другой сотрудник) — 2-й замер, утренний цел", second.ok() && temps.merged["cold-fridge"] === 4 && temps.merged["cold-fridge#2"] === 5, { status: second.status(), temps });
    const third = await post(`/api/equipment-fill/${fridge.id}`, { token: fridgeToken, employeeId: U.cookA.id, temperature: 5.5 });
    temps = await dayTemperatures(doc.id, day);
    check("QR: третий скан обновляет последний замер, первый цел", third.ok() && temps.merged["cold-fridge"] === 4 && [5, 5.5].includes(temps.merged["cold-fridge#2"]), { status: third.status(), temps });

    // 2. Минус с телефона: у морозилки минус стоит сразу, кнопка переключает знак.
    const phonePage = await anonymous.newPage();
    await phonePage.goto(freezerUrl!, { waitUntil: "load", timeout: 300_000 });
    const tempInput = phonePage.locator('input[inputmode="decimal"]').first();
    await tempInput.waitFor({ timeout: 60_000 });
    check("морозилка: минус в поле стоит сразу", (await tempInput.inputValue()) === "-", await tempInput.inputValue());
    const minus = phonePage.getByRole("button", { name: "Минус: отрицательная температура" });
    check("морозилка: кнопка «−» нажата", (await minus.getAttribute("aria-pressed")) === "true");
    await tempInput.fill("-18");
    await minus.tap();
    check("кнопка «−» снимает минус", (await tempInput.inputValue()) === "18", await tempInput.inputValue());
    await minus.tap();
    check("кнопка «−» возвращает минус", (await tempInput.inputValue()) === "-18", await tempInput.inputValue());
    await phonePage.screenshot({ path: path.join(SHOTS, "freezer-minus.png") });
    const fridgePage = await anonymous.newPage();
    await fridgePage.goto(fridgeUrl!, { waitUntil: "load", timeout: 300_000 });
    const fridgeInput = fridgePage.locator('input[inputmode="decimal"]').first();
    await fridgeInput.waitFor({ timeout: 60_000 });
    check("холодильник с плюсовой нормой: поле пустое", (await fridgeInput.inputValue()) === "");
    const frozen = await post(`/api/equipment-fill/${freezer.id}`, { token: freezerToken, employeeId: U.cookA.id, temperature: -18 });
    temps = await dayTemperatures(doc.id, day);
    check("QR: отрицательная температура морозилки записана", frozen.ok() && temps.merged["cold-freezer"] === -18, { status: frozen.status(), temps });
    await anonymous.close();

    // 3. Журнал: строки по замерам, значения разных сотрудников видны вместе.
    await page.goto(`${BASE}/journals/cold_equipment_control/documents/${doc.id}`, { waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(3000);
    const guide = page.locator('[role="dialog"][aria-labelledby="fill-guide-title"]');
    if (await guide.isVisible().catch(() => false)) await guide.getByRole("button", { name: "Понятно" }).first().click().catch(() => null);
    const rowOf = (label: string) => page.locator("tbody tr", { hasText: "Холодильник QR E2E" }).filter({ hasText: label }).first();
    check("журнал: у холодильника строки «1-й замер» и «2-й замер»", (await rowOf("1-й замер").count()) === 1 && (await rowOf("2-й замер").count()) === 1);
    const firstValue = await rowOf("1-й замер").locator('input[type="number"]').first().inputValue();
    const secondValue = await rowOf("2-й замер").locator('input[type="number"]').first().inputValue();
    check("журнал: оба замера видны (слияние строк сотрудников)", firstValue === "4" && ["5", "5.5"].includes(secondValue), { firstValue, secondValue });
    const freezerRow = page.locator("tbody tr", { hasText: "Морозилка QR E2E" });
    check("журнал: у морозилки одна строка без подписи замера и −18", (await freezerRow.count()) === 1 && (await freezerRow.first().locator('input[type="number"]').first().inputValue()) === "-18");
    await page.screenshot({ path: path.join(SHOTS, "cold-two-readings.png") });

    // Правка 2-го замера в сетке.
    const secondInput = rowOf("2-й замер").locator('input[type="number"]').first();
    await secondInput.fill("3.5");
    await secondInput.blur();
    await page.waitForTimeout(2500);
    temps = await dayTemperatures(doc.id, day);
    check("журнал: правка 2-го замера сохраняется, 1-й не тронут", temps.merged["cold-fridge"] === 4 && Object.values(temps.merged).includes(3.5), temps);

    // 4. Печать: строки по замерам.
    const pdf = await ctx.request.get(`${BASE}/api/journal-documents/${doc.id}/pdf`, { timeout: 180_000 });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const parsed = await pdfjs.getDocument({ data: new Uint8Array(await pdf.body()), useSystemFonts: true }).promise;
    let text = "";
    for (let i = 1; i <= parsed.numPages; i += 1) {
      const content = await (await parsed.getPage(i)).getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    }
    text = text.replace(/\s+/g, " ");
    check("PDF: строки «1-й замер» и «2-й замер»", text.includes("1-й замер") && text.includes("2-й замер"), text.slice(0, 400));
    await ctx.close();
  } catch (error) {
    console.error("E2E ERROR", error);
    checks.push({ name: "e2e без исключений", ok: false, detail: String(error).slice(0, 800) });
  } finally {
    await browser.close();
    await db.journalDocument.delete({ where: { id: doc.id } }).catch(() => null);
    const passed = checks.filter((c) => c.ok).length;
    fs.writeFileSync(path.join(HERE, "cold-readings.json"), JSON.stringify(checks, null, 2));
    console.log(`\n${passed}/${checks.length} PASS`);
    await db.$disconnect();
    process.exit(passed === checks.length ? 0 : 1);
  }
}

main();
