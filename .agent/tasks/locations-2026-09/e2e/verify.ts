/* eslint-disable no-console */
// e2e точек на dev 3020: шапка, фильтр документов, настройки, Mini App,
// ограничение сотрудника точками, чужая точка → 403.
//   npx tsx .agent/tasks/locations-2026-09/e2e/verify.ts
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3020";
const DIR = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09");
const OUT = path.join(DIR, "shots");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e/state.json"), "utf8"));
const results: Record<string, unknown> = {};
fs.mkdirSync(OUT, { recursive: true });

async function dropDevOverlay(page: Page) {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
}

async function activeCookie(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies(BASE);
  return cookies.find((c) => c.name === "wesetup.building")?.value ?? null;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });

    // --- AC3: пилюля точки в шапке, переключение ---
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const pill = page.locator('[data-tour="location-switcher"]');
    await pill.waitFor({ state: "visible", timeout: 60_000 });
    await dropDevOverlay(page);
    results.pillInitial = (await pill.innerText()).trim();
    await page.screenshot({ path: path.join(OUT, "01-header-pill.png") });
    await pill.click();
    const openMenu = page.locator('[role="menu"][data-state="open"]');
    try {
      await openMenu.waitFor({ state: "visible", timeout: 5_000 });
    } catch {
      await pill.click();
      await openMenu.waitFor({ state: "visible", timeout: 10_000 });
    }
    const items = openMenu.locator('[role="menuitem"]');
    results.menuItems = (await items.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
    await page.screenshot({ path: path.join(OUT, "02-location-menu.png") });
    await items.filter({ hasText: "E2E Точка Б" }).first().click();
    await page.waitForTimeout(3000);
    results.cookieAfterB = await activeCookie(page);
    results.pillAfterB = (await page.locator('[data-tour="location-switcher"]').innerText()).trim();

    // --- AC4: список документов — только точка Б + общие ---
    const listB = await page.request.get(`${BASE}/api/journal-documents?templateCode=hygiene&status=active`);
    const docsB = (await listB.json()) as { documents: Array<{ id: string; title: string; buildingId: string | null }> };
    results.docsAtB = docsB.documents.filter((d) => d.title.startsWith("E2E")).map((d) => d.title);
    results.docsAtBAllVisibleOk = docsB.documents.every((d) => d.buildingId === null || d.buildingId === state.buildingB);
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const bodyB = await page.evaluate(() => document.body.innerText);
    results.pageShowsB = bodyB.includes("E2E точка Б");
    results.pageHidesA = !bodyB.includes("E2E точка А");
    await page.screenshot({ path: path.join(OUT, "03-list-at-B.png") });

    // Переключаем на А через API (как это делает Mini App) и проверяем список.
    const sw = await page.request.post(`${BASE}/api/me/active-building`, { data: { buildingId: state.buildingA } });
    results.switchToAStatus = sw.status();
    const listA = await page.request.get(`${BASE}/api/journal-documents?templateCode=hygiene&status=active`);
    const docsA = (await listA.json()) as { documents: Array<{ id: string; title: string; buildingId: string | null }> };
    results.docsAtA = docsA.documents.filter((d) => d.title.startsWith("E2E")).map((d) => d.title);

    // --- AC4: шапка документа с точкой и адресом ---
    await page.goto(`${BASE}/journals/hygiene/documents/${state.docA}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const docBody = await page.evaluate(() => document.body.innerText);
    results.docHeaderHasBuilding = docBody.includes("E2E Точка А, ул. Ленина, 5");
    await page.screenshot({ path: path.join(OUT, "04-document-header.png") });

    // --- AC12: чужая точка → 403 ---
    const bad = await page.request.post(`${BASE}/api/me/active-building`, { data: { buildingId: "nope" } });
    results.foreignBuildingStatus = bad.status();

    // --- AC7: настройки точек ---
    await page.goto(`${BASE}/settings/buildings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 60_000 });
    results.settingsTitle = (await page.locator("h1").first().innerText()).trim();
    const toggle = page.locator('button[role="switch"][aria-label="Вести журналы отдельно по точкам"]');
    results.toggleVisible = await toggle.isVisible();
    results.toggleChecked = await toggle.getAttribute("aria-checked");
    await page.screenshot({ path: path.join(OUT, "05-settings-buildings.png") });

    // --- AC10: Mini App ---
    const home = await page.request.get(`${BASE}/api/mini/home`);
    const homeJson = (await home.json()) as { location?: { canSwitch: boolean; activeBuildingId: string | null; buildings: Array<{ name: string }> } };
    results.miniLocation = homeJson.location
      ? { canSwitch: homeJson.location.canSwitch, active: homeJson.location.activeBuildingId, names: homeJson.location.buildings.map((b) => b.name) }
      : null;
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`${BASE}/mini/me`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(3000);
    await dropDevOverlay(page);
    const meBody = await page.evaluate(() => document.body.innerText);
    results.miniMeHasSwitcher = meBody.includes("E2E Точка А") && meBody.includes("E2E Точка Б");
    await page.screenshot({ path: path.join(OUT, "06-mini-me.png") });

    // --- AC8/AC2: ограничение сотрудника точкой Б ---
    const restrict = await page.request.put(`${BASE}/api/users/${creds.id}`, { data: { buildingIds: [state.buildingB] } });
    results.restrictStatus = restrict.status();
    const homeR = await page.request.get(`${BASE}/api/mini/home`);
    const homeRJson = (await homeR.json()) as { location?: { canSwitch: boolean; activeBuildingId: string | null; buildings: Array<{ name: string }> } };
    results.restrictedLocation = homeRJson.location
      ? { canSwitch: homeRJson.location.canSwitch, active: homeRJson.location.activeBuildingId === state.buildingB ? "B" : homeRJson.location.activeBuildingId, names: homeRJson.location.buildings.map((b) => b.name) }
      : null;
    const denied = await page.request.post(`${BASE}/api/me/active-building`, { data: { buildingId: state.buildingA } });
    results.restrictedSwitchToAStatus = denied.status();
    const listR = await page.request.get(`${BASE}/api/journal-documents?templateCode=hygiene&status=active`);
    const docsR = (await listR.json()) as { documents: Array<{ title: string }> };
    results.docsRestricted = docsR.documents.filter((d) => d.title.startsWith("E2E")).map((d) => d.title);
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    results.pillHiddenWhenRestricted = (await page.locator('[data-tour="location-switcher"]').count()) === 0;
    await page.screenshot({ path: path.join(OUT, "07-restricted-no-pill.png") });
    const reset = await page.request.put(`${BASE}/api/users/${creds.id}`, { data: { buildingIds: [] } });
    results.resetStatus = reset.status();
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(DIR, "e2e/results.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
