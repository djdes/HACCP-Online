/* eslint-disable no-console */
// Хвост проверки: AC6 (климат) и AC8 (Mini App). Строки «Тест QR …» в
// холодильном документе уже созданы основным прогоном.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { verifyQrFillToken } from "@/lib/qr-fill-token";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ROOT = path.resolve(process.cwd(), ".agent/tasks/equipment-qr-modal-2026-09");
const OUT = path.join(ROOT, "shots");
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
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(OUT, `${n}.png`) });
const DIALOG = '[role="dialog"]';

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

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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

    // ---- AC6: климат
    await goto(page, `/journals/climate_control/documents/${state.climateDoc}`);
    if ((await page.locator('button:has-text("E2E Склад QR")').count()) === 0) {
      await page.getByRole("button", { name: "Добавить помещение" }).first().click();
      const picker = page.locator(DIALOG).filter({ hasText: "Добавить помещение" });
      await picker.waitFor({ state: "visible", timeout: 30_000 });
      await picker.locator('button:has-text("E2E Склад QR")').first().click();
      await picker.waitFor({ state: "hidden", timeout: 60_000 });
      await page.waitForTimeout(2000);
    }
    // После добавления из справочника карточка помещения открывается сама
    // (onCreated) только для НОВОГО; для выбранного — просто строка. Закроем
    // возможный диалог на всякий случай.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const roomBtn = page.locator('button:has-text("E2E Склад QR")').first();
    await roomBtn.waitFor({ state: "visible", timeout: 60_000 });
    results.ac6_nameButtons = await page.locator('button:has-text("E2E Склад QR")').count();
    await shot(page, "07-climate-rows");
    await roomBtn.click();
    const roomDialog = page.locator(DIALOG).filter({ hasText: "Редактирование помещения" });
    await roomDialog.waitFor({ state: "visible", timeout: 30_000 });
    const roomQr = roomDialog.locator('[data-qr-fill-preview="room"]');
    await roomQr.locator("svg").first().waitFor({ state: "visible", timeout: 60_000 });
    await roomQr.scrollIntoViewIfNeeded();
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
    // Онбординг-тур Mini App (z-60) перекрывает экран — закрываем.
    for (let i = 0; i < 3; i += 1) {
      const tour = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: "задачи на сегодня" });
      if ((await tour.count()) === 0) break;
      const close = tour.locator("button").first();
      await close.click().catch(() => {});
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }
    results.ac8_mini = {
      url: page.url(),
      pencilButtons: await page.locator('button[aria-label^="Изменить Тест QR"]').count(),
      tableNameButtons: await page.locator('[data-grid-label] button:has-text("Тест QR")').count(),
    };
    await shot(page, "09-mini-cards");
    const miniPencil = page.locator('button[aria-label="Изменить Тест QR А"]').first();
    if (await miniPencil.count()) {
      await miniPencil.click();
      const miniDialog = page.locator(DIALOG).filter({ hasText: "Редактирование оборудования" });
      await miniDialog.waitFor({ state: "visible", timeout: 30_000 });
      const svg = miniDialog.locator('[data-qr-fill-preview="equipment"] svg').first();
      await svg.waitFor({ state: "visible", timeout: 60_000 });
      await svg.scrollIntoViewIfNeeded();
      results.ac8_miniDialogQr = true;
      await shot(page, "10-mini-dialog-qr");
    }
  } catch (error) {
    errors.push(`fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    await shot(page, "99-failure-tail").catch(() => {});
  } finally {
    results.errors = errors;
    fs.writeFileSync(path.join(ROOT, "e2e/results-tail.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
  process.exit(errors.some((e) => e.startsWith("fatal")) ? 1 : 0);
}
void main();
