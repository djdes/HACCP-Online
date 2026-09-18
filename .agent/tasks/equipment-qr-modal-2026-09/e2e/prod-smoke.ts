/* eslint-disable no-console */
// Read-only smoke на проде после деплоя: ничего не создаём и не сохраняем.
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://wesetup.ru";
const ROOT = path.resolve(process.cwd(), ".agent/tasks/equipment-qr-modal-2026-09");
const OUT = path.join(ROOT, "shots");
const creds = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json"), "utf8")
) as { email: string; password: string };
const COLD_DOC = "cmu3e8tav00gqd7tspsb35swv";
const results: Record<string, unknown> = {};
const errors: string[] = [];
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(OUT, `prod-${n}.png`) });

async function settle(page: Page) {
  await page.waitForTimeout(1500);
  const later = page.getByRole("button", { name: /Напомнить позже/ });
  if (await later.count()) await later.first().click().catch(() => {});
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
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 90_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 });

    await page.goto(`${BASE}/journals/cold_equipment_control/documents/${COLD_DOC}`, { waitUntil: "load", timeout: 90_000 });
    await settle(page);
    await page.locator("[data-journal-grid]").first().waitFor({ state: "visible", timeout: 60_000 });
    results.rowButtons = await page.locator("[data-grid-label] button").count();
    // Открываем окно «Добавить» и закрываем без сохранения — видим подсказку про QR.
    await page.getByRole("button", { name: "Добавить", exact: true }).first().click();
    const dialog = page.locator('[role="dialog"]').filter({ hasText: "Добавление оборудования" });
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    results.addDialogHint = (await dialog.getByText("получит QR-код").count()) > 0;
    results.presetPrefilled = await dialog.locator("#equipment-min").inputValue();
    await shot(page, "01-add-dialog");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 15_000 });

    for (const [name, url] of [
      ["sheet", "/settings/qr-posters?kind=equipment&layout=sheet"],
      ["poster", "/settings/qr-posters?kind=rooms"],
    ] as const) {
      await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 90_000 });
      await settle(page);
      results[`page_${name}`] = {
        url: page.url(),
        h1: await page.locator("h1").first().innerText().catch(() => null),
        layoutTabs: await page.getByRole("tab").allInnerTexts(),
        posters: await page.locator("article[data-qr-poster]").count(),
      };
      await shot(page, `02-${name}`);
    }
    await page.goto(`${BASE}/settings/equipment/qr-sheet`, { waitUntil: "commit", timeout: 90_000 });
    await page.waitForURL((u) => u.pathname === "/settings/qr-posters", { timeout: 60_000 });
    results.redirect = page.url();

    const api = await page.request.get(`${BASE}/api/qr-fill/equipment/does-not-exist`);
    results.apiMissing = api.status();
    const apiBad = await page.request.get(`${BASE}/api/qr-fill/other/x`);
    results.apiBadKind = apiBad.status();
  } catch (error) {
    errors.push(`fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    await shot(page, "99-failure").catch(() => {});
  } finally {
    results.errors = errors;
    fs.writeFileSync(path.join(ROOT, "e2e/prod-smoke.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
  process.exit(errors.some((e) => e.startsWith("fatal")) ? 1 : 0);
}
void main();
