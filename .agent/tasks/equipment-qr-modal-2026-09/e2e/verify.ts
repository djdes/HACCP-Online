/* eslint-disable no-console */
// Локальная проверка AC1–AC8 на dev-сервере 3020 (БД — туннель в прод,
// организация «Кафе „Тестовое 1“»). Креды — из creds.json соседней задачи.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { verifyQrFillToken } from "@/lib/qr-fill-token";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ROOT = path.resolve(process.cwd(), ".agent/tasks/equipment-qr-modal-2026-09");
const OUT = path.join(ROOT, "shots");
fs.mkdirSync(OUT, { recursive: true });
const creds = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json"), "utf8")
) as { email: string; password: string };
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/state.json"), "utf8")) as {
  coldDoc: string;
  climateDoc: string;
  roomId: string;
};

const results: Record<string, unknown> = {};
const errors: string[] = [];
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: false });

async function settle(page: Page) {
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
  });
  const later = page.getByRole("button", { name: /Напомнить позже/ });
  if (await later.count()) await later.first().click().catch(() => {});
}

async function goto(page: Page, url: string) {
  await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 180_000 });
  await settle(page);
}

const DIALOG = '[role="dialog"]';

async function addEquipmentRow(page: Page, name: string, presetLabel: string) {
  await page.getByRole("button", { name: "Добавить", exact: true }).first().click();
  const dialog = page.locator(DIALOG).filter({ hasText: "Добавление оборудования" });
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  await dialog.locator("#equipment-name").fill(name);
  await dialog.locator("label", { hasText: presetLabel }).first().click();
  await dialog.getByRole("button", { name: "Добавить" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  await page.locator(`[data-grid-label] button:has-text("${name}")`).first().waitFor({ state: "visible", timeout: 60_000 });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls += 1;
    };
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`http ${r.status()} ${r.url().slice(0, 140)}`);
  });
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });
    results.login = page.url();

    // ---- AC2: строка из журнала → справочник + QR
    await goto(page, `/journals/cold_equipment_control/documents/${state.coldDoc}`);
    await page.locator("[data-journal-grid]").first().waitFor({ state: "visible", timeout: 120_000 });
    await addEquipmentRow(page, "Тест QR А", "Холодильное");
    await addEquipmentRow(page, "Тест QR Б", "Морозильное");
    await shot(page, "01-cold-rows");

    const list1 = await (await page.request.get(`${BASE}/api/equipment`)).json();
    const eqA = (list1.equipment as Array<Record<string, unknown>>).find((e) => e.name === "Тест QR А");
    const eqB = (list1.equipment as Array<Record<string, unknown>>).find((e) => e.name === "Тест QR Б");
    results.ac2_directoryCreated = {
      a: eqA ? { type: eqA.type, tempMin: eqA.tempMin, tempMax: eqA.tempMax, area: (eqA.area as { name: string }).name } : null,
      b: eqB ? { type: eqB.type, tempMin: eqB.tempMin, tempMax: eqB.tempMax } : null,
    };

    // ---- AC1 + AC3: клик по названию → диалог с QR; правка нормы → справочник
    await page.locator('[data-grid-label] button:has-text("Тест QR А")').first().click();
    const edit = page.locator(DIALOG).filter({ hasText: "Редактирование оборудования" });
    await edit.waitFor({ state: "visible", timeout: 30_000 });
    const qrBox = edit.locator('[data-qr-fill-preview="equipment"]');
    await qrBox.locator("svg").first().waitFor({ state: "visible", timeout: 60_000 });
    await shot(page, "02-cold-dialog-qr");
    const posterHref = await qrBox.locator('a:has-text("Плакат A4")').getAttribute("href");
    const stickerHref = await qrBox.locator('a:has-text("Наклейка")').getAttribute("href");
    results.ac3_links = { posterHref, stickerHref };
    const equipmentId = String(eqA?.id ?? "");
    const qrApi = await (await page.request.get(`${BASE}/api/qr-fill/equipment/${equipmentId}`)).json();
    const qrUrl = new URL(String(qrApi.poster?.url ?? "http://x/"));
    const token = qrUrl.searchParams.get("token") ?? "";
    const verified = verifyQrFillToken(token);
    const fillPage = await page.request.get(qrUrl.href.replace(qrUrl.origin, BASE));
    const fillHtml = await fillPage.text();
    results.ac3_qr = {
      path: qrUrl.pathname,
      fillPageStatus: fillPage.status(),
      fillPageAccepted: !fillHtml.includes("Ссылка недействительна") && fillHtml.includes("Тест QR А"),
      tokenOk: verified.ok,
      tokenKind: verified.ok ? verified.kind : null,
      tokenId: verified.ok ? verified.id : null,
      hasSvg: typeof qrApi.poster?.svg === "string" && qrApi.poster.svg.includes("<svg"),
      norms: qrApi.poster?.norms,
      expiresAt: qrApi.poster?.expiresAt,
    };

    await edit.locator("#equipment-max").fill("7");
    await edit.getByRole("button", { name: "Сохранить" }).click();
    await edit.waitFor({ state: "hidden", timeout: 30_000 });
    await page.waitForTimeout(1500);
    const list2 = await (await page.request.get(`${BASE}/api/equipment`)).json();
    const eqA2 = (list2.equipment as Array<Record<string, unknown>>).find((e) => e.id === equipmentId);
    results.ac1_directorySynced = { tempMax: eqA2?.tempMax, name: eqA2?.name };
    results.ac1_rowLabel = await page.locator('[data-grid-label] button:has-text("Тест QR А")').first().innerText();

    // ---- AC5: чекбоксы → «QR-коды» → лист наклеек
    const rowA = page.locator("tr", { has: page.locator('[data-grid-label] button:has-text("Тест QR А")') });
    const rowB = page.locator("tr", { has: page.locator('[data-grid-label] button:has-text("Тест QR Б")') });
    await rowA.locator('[data-grid-check] button[role="checkbox"]').click();
    await rowB.locator('[data-grid-check] button[role="checkbox"]').click();
    const bar = page.getByRole("region", { name: "Действия над выбранными строками" });
    await bar.waitFor({ state: "visible", timeout: 15_000 });
    results.ac5_barText = (await bar.innerText()).replace(/\s+/g, " ");
    await shot(page, "03-cold-selection-bar");
    await bar.getByRole("button", { name: /QR-коды/ }).click();
    await page.waitForURL((u) => u.pathname === "/settings/qr-posters", { timeout: 120_000 });
    await page.waitForTimeout(1500);
    results.ac5_url = page.url();
    results.ac5_stickers = await page.locator("article[data-qr-poster]").count();
    results.ac5_stickerTitles = await page.locator("article[data-qr-poster] .qr-sticker-title").allInnerTexts();
    await shot(page, "04-sheet-screen");
    await page.emulateMedia({ media: "print" });
    results.ac5_printGrid = await page.evaluate(() => {
      const grid = document.querySelector(".qr-sheet-grid") as HTMLElement | null;
      const sticker = document.querySelector(".qr-sticker") as HTMLElement | null;
      return grid && sticker
        ? {
            columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
            stickerHeightPx: Math.round(sticker.getBoundingClientRect().height),
            breakInside: getComputedStyle(sticker).breakInside,
          }
        : null;
    });
    await page.screenshot({ path: path.join(OUT, "05-sheet-print.png"), fullPage: true });
    await page.emulateMedia({ media: "screen" });

    // ---- AC4: autoprint
    await goto(page, `${stickerHref}`);
    await page.waitForTimeout(1500);
    results.ac4_autoprint = {
      url: page.url(),
      posters: await page.locator("article[data-qr-poster]").count(),
      printCalls: await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls),
    };
    await goto(page, `${posterHref}`);
    await page.waitForTimeout(1500);
    results.ac4_poster = {
      posters: await page.locator("article[data-qr-poster].qr-poster").count(),
      printCalls: await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls),
    };
    await shot(page, "06-poster-autoprint");

    // ---- AC7: старый адрес
    await page.goto(`${BASE}/settings/equipment/qr-sheet`, { waitUntil: "commit", timeout: 180_000 });
    await page.waitForURL((u) => u.pathname === "/settings/qr-posters", { timeout: 120_000 });
    results.ac7_redirect = page.url();
    await settle(page);

    // ---- AC6: климат — помещение из справочника → карточка с QR
    await goto(page, `/journals/climate_control/documents/${state.climateDoc}`);
    await page.getByRole("button", { name: "Добавить помещение" }).first().click();
    const picker = page.locator(DIALOG).filter({ hasText: "Добавить помещение" });
    await picker.waitFor({ state: "visible", timeout: 30_000 });
    await picker.locator('button:has-text("E2E Склад QR")').first().click();
    await picker.waitFor({ state: "hidden", timeout: 30_000 });
    await page.waitForTimeout(1500);
    const roomBtn = page.locator('button:has-text("E2E Склад QR")').first();
    await roomBtn.waitFor({ state: "visible", timeout: 60_000 });
    await shot(page, "07-climate-rows");
    await roomBtn.click();
    const roomDialog = page.locator(DIALOG).filter({ hasText: "Редактирование помещения" });
    await roomDialog.waitFor({ state: "visible", timeout: 30_000 });
    const roomQr = roomDialog.locator('[data-qr-fill-preview="room"]');
    await roomQr.locator("svg").first().waitFor({ state: "visible", timeout: 60_000 });
    await shot(page, "08-climate-room-qr");
    const roomApi = await (await page.request.get(`${BASE}/api/qr-fill/room/${state.roomId}`)).json();
    const roomUrl = new URL(String(roomApi.poster?.url ?? "http://x/"));
    const roomVerified = verifyQrFillToken(roomUrl.searchParams.get("token") ?? "");
    const roomFill = await page.request.get(roomUrl.href.replace(roomUrl.origin, BASE));
    results.ac6_room = {
      path: roomUrl.pathname,
      fillPageStatus: roomFill.status(),
      fillPageAccepted: !(await roomFill.text()).includes("Ссылка недействительна"),
      tokenOk: roomVerified.ok,
      kind: roomVerified.ok ? roomVerified.kind : null,
      norms: roomApi.poster?.norms,
      posterHref: await roomQr.locator('a:has-text("Плакат A4")').getAttribute("href"),
    };
    await page.keyboard.press("Escape");

    // ---- AC8: Mini App — тот же клиент
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, `/mini/documents/${state.coldDoc}`);
    await page.waitForTimeout(2500);
    results.ac8_mini = {
      url: page.url(),
      pencilButtons: await page.locator('button[aria-label^="Изменить Тест QR"]').count(),
      tableNameButtons: await page.locator('[data-grid-label] button:has-text("Тест QR")').count(),
    };
    const miniPencil = page.locator('button[aria-label="Изменить Тест QR А"]').first();
    if (await miniPencil.count()) {
      await miniPencil.click();
      const miniDialog = page.locator(DIALOG).filter({ hasText: "Редактирование оборудования" });
      await miniDialog.waitFor({ state: "visible", timeout: 30_000 });
      await miniDialog.locator('[data-qr-fill-preview="equipment"] svg').first().waitFor({ state: "visible", timeout: 60_000 });
      results.ac8_miniDialogQr = true;
      await shot(page, "09-mini-dialog-qr");
    }
  } catch (error) {
    errors.push(`fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    await shot(page, "99-failure").catch(() => {});
  } finally {
    results.errors = errors;
    fs.writeFileSync(path.join(ROOT, "e2e/results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
  process.exit(errors.some((e) => e.startsWith("fatal")) ? 1 : 0);
}

void main();
