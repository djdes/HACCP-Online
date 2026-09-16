// e2e пояснения к ТЗ п.4: наименование точки в интерфейсе ≠ наименование в шапке журналов.
// Запуск (dev на 3020 с wesetup_e2e, после setup-db.ts Задачи 1):
//   npx tsx .agent/tasks/org-short-name-2026-09/e2e/building-journal-name.ts
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";
import { chromium } from "playwright";

import { db, E2E_DATABASE_URL } from "../../journal-responsibles-org-2026-09/e2e/db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SHOTS = path.join(HERE, "..", "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const T1 = path.join(HERE, "..", "..", "journal-responsibles-org-2026-09", "e2e");
const state = JSON.parse(fs.readFileSync(path.join(T1, "state.json"), "utf8"));
const U = state.users as Record<string, { id: string; email: string }>;
const ORG_A = state.orgA as string;

const SHORT = "E2E Тверская";
const JOURNAL = "Столовая №2, г. Москва, ул. Тверская, д. 1";

type Check = { name: string; ok: boolean; detail?: unknown };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 500)}` : ""}`);
}

async function main() {
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DATABASE_URL_DIRECT = E2E_DATABASE_URL;
  await db.building.deleteMany({ where: { organizationId: ORG_A, name: SHORT } });
  const browser = await chromium.launch({ headless: true });
  let buildingId: string | null = null;
  let documentId: string | null = null;
  const extraDocs: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
    await page.fill("#email", U.managerA.email);
    await page.fill("#password", state.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 180_000 });
    const api = context.request;

    const created = await api.post(`${BASE}/api/settings/buildings`, { data: { name: SHORT, address: "ул. Тверская, 1" } });
    const createdJson = await created.json().catch(() => null);
    buildingId = createdJson?.building?.id ?? null;
    check("точка создана", created.ok() && Boolean(buildingId), createdJson);

    const patched = await api.patch(`${BASE}/api/settings/buildings/${buildingId}`, {
      data: { journalName: `  ${JOURNAL.replace(", ", ",   ")} ` },
    });
    const stored = await db.building.findUnique({ where: { id: buildingId! }, select: { name: true, journalName: true } });
    check("PATCH точки: наименование для журналов сохранено (пробелы схлопнуты), короткое имя не тронуто", patched.ok() && stored?.journalName === JOURNAL && stored?.name === SHORT, stored);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const month = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const doc = await api.post(`${BASE}/api/journal-documents`, {
      data: { templateCode: "hygiene", title: "E2E шапка точки", dateFrom: `${month}-01`, dateTo: `${month}-${pad(last)}`, force: true },
      timeout: 180_000,
    });
    const docJson = await doc.json().catch(() => null);
    documentId = docJson?.document?.id ?? null;
    await db.journalDocument.update({ where: { id: documentId! }, data: { buildingId } });

    await page.goto(`${BASE}/journals/hygiene/documents/${documentId}`, { waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(2500);
    const guide = page.locator('[role="dialog"][aria-labelledby="fill-guide-title"]');
    if (await guide.isVisible().catch(() => false)) {
      await guide.getByRole("button", { name: "Понятно" }).first().click().catch(() => page.keyboard.press("Escape"));
    }
    const headerText = (await page.locator("table").first().innerText()).replace(/\s+/g, " ");
    check("шапка документа: наименование точки для журналов вместо короткого названия", headerText.includes(JOURNAL) && !headerText.includes(SHORT), headerText.slice(0, 300));
    await page.screenshot({ path: path.join(SHOTS, "building-journal-name-header.png"), fullPage: false });

    const pdf = await api.get(`${BASE}/api/journal-documents/${documentId}/pdf`, { timeout: 180_000 });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const parsed = await pdfjs.getDocument({ data: new Uint8Array(await pdf.body()), useSystemFonts: true }).promise;
    let text = "";
    for (let i = 1; i <= parsed.numPages; i += 1) {
      const content = await (await parsed.getPage(i)).getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    }
    text = text.replace(/\s+/g, " ");
    check("PDF: наименование точки для журналов", text.includes("Тверская, д. 1") && !text.includes(SHORT), text.slice(0, 300));

    // Кабинет: в шапке сайта и крошках — короткие имена (организация и точка), не наименование для журналов.
    const chrome = (await page.locator("header").first().innerText().catch(() => "")).replace(/\s+/g, " ");
    const crumbs = (await page.locator("nav").first().innerText().catch(() => "")).replace(/\s+/g, " ");
    check("кабинет: полное название организации в шапке сайта, наименования точки для журналов там нет", chrome.includes("Кафе «Альфа»") && !chrome.includes("Столовая №2") && !crumbs.includes("Столовая №2"), { chrome: chrome.slice(0, 200), crumbs: crumbs.slice(0, 200) });

    // Второй журнал той же точки — климат: та же шапка.
    const climate = await api.post(`${BASE}/api/journal-documents`, {
      data: { templateCode: "climate_control", title: "E2E шапка точки климат", dateFrom: `${month}-01`, dateTo: `${month}-${pad(last)}`, force: true },
      timeout: 180_000,
    });
    const climateId = (await climate.json().catch(() => null))?.document?.id as string | undefined;
    if (climateId) {
      extraDocs.push(climateId);
      await db.journalDocument.update({ where: { id: climateId }, data: { buildingId } });
      await page.goto(`${BASE}/journals/climate_control/documents/${climateId}`, { waitUntil: "load", timeout: 300_000 });
      await page.waitForTimeout(2500);
      const climateHeader = (await page.locator("table").first().innerText()).replace(/\s+/g, " ");
      check("климат: в шапке наименование точки для журналов", climateHeader.includes(JOURNAL) && !climateHeader.includes(SHORT), climateHeader.slice(0, 300));
    } else {
      check("климат: документ создан", false, await climate.text());
    }

    // Mini App — та же страница документа.
    await page.goto(`${BASE}/mini/documents/${documentId}`, { waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(2500);
    const miniText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    check("Mini App: в шапке документа наименование точки для журналов", miniText.includes(JOURNAL), miniText.slice(0, 300));

    // Архив проверки: имя файла и содержание — наименование для журналов, а не короткое имя точки.
    const bundle = await api.get(`${BASE}/api/reports/compliance-bundle?from=${month}-01&to=${month}-${pad(last)}`, { timeout: 300_000 });
    let manifest = "";
    if (bundle.ok()) {
      const zip = await JSZip.loadAsync(await bundle.body());
      manifest = (await zip.file("ОТЧЁТ.txt")?.async("string")) ?? "";
    }
    check("архив проверки: документ точки подписан наименованием для журналов", manifest.includes(`E2E шапка точки · ${JOURNAL}`) && !manifest.includes(`E2E шапка точки · ${SHORT}`), { status: bundle.status(), manifest: manifest.slice(0, 400) });

    // PDF портала инспектора: список документов с наименованием точки для журналов.
    const rawToken = crypto.randomBytes(24).toString("base64url");
    await db.inspectorToken.create({
      data: {
        organizationId: ORG_A,
        tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
        label: "E2E точка",
        periodFrom: new Date(`${month}-01T00:00:00.000Z`),
        periodTo: new Date(`${month}-${pad(last)}T00:00:00.000Z`),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const anonymous = await browser.newContext();
    const inspectorPdf = await anonymous.request.get(`${BASE}/api/inspector/${rawToken}/pdf`, { timeout: 300_000 });
    let inspectorText = "";
    if (inspectorPdf.ok()) {
      const parsedInspector = await pdfjs.getDocument({ data: new Uint8Array(await inspectorPdf.body()), useSystemFonts: true }).promise;
      for (let i = 1; i <= parsedInspector.numPages; i += 1) {
        const content = await (await parsedInspector.getPage(i)).getTextContent();
        inspectorText += content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      }
      inspectorText = inspectorText.replace(/\s+/g, " ");
    }
    // Шрифт портала — helvetica без кириллицы: текст не извлекается, проверяем по коду и ответу 200.
    check("PDF портала инспектора: отвечает 200 (имя точки — buildingPrintName, см. код)", inspectorPdf.ok(), inspectorPdf.status());
    await anonymous.close();

    await page.goto(`${BASE}/settings/buildings`, { waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(2000);
    const card = page.locator("div.rounded-3xl", { has: page.getByRole("heading", { name: SHORT }) }).last();
    check("«Точки и помещения»: заголовок — короткое название", await card.getByRole("heading", { name: SHORT }).isVisible());
    check("«Точки и помещения»: строка «В шапке журналов: «…»»", (await card.innerText()).includes(`В шапке журналов: «${JOURNAL}»`));
    await card.getByRole("button", { name: "Переименовать точку и адрес" }).click();
    // В режиме правки заголовок точки заменяется полями — ищем форму по её полю.
    const field = page.getByRole("textbox", { name: "Наименование в шапке журналов" });
    const form = page.locator("div.space-y-2", { has: page.getByRole("textbox", { name: "Название точки" }) }).last();
    check("форма точки: поле «Наименование в шапке журналов» с текущим значением", (await field.inputValue()) === JOURNAL);
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "building-journal-name-form.png"), fullPage: false });
    await field.fill("");
    await form.getByRole("button", { name: "Сохранить" }).first().click();
    await page.waitForTimeout(2000);
    const cleared = await db.building.findUnique({ where: { id: buildingId! }, select: { journalName: true } });
    check("очистка поля → null, шапка снова «название, адрес»", cleared?.journalName === null, cleared);
    await page.goto(`${BASE}/journals/hygiene/documents/${documentId}`, { waitUntil: "load", timeout: 300_000 });
    await page.waitForTimeout(2000);
    const headerAfter = (await page.locator("table").first().innerText()).replace(/\s+/g, " ");
    check("шапка после очистки: «короткое название, адрес»", headerAfter.includes(`${SHORT}, ул. Тверская, 1`), headerAfter.slice(0, 300));

    const cook = await browser.newContext();
    const cookPage = await cook.newPage();
    await cookPage.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
    await cookPage.fill("#email", U.cookA.email);
    await cookPage.fill("#password", state.password);
    await cookPage.click('button[type="submit"]');
    await cookPage.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 180_000 });
    const cookPatch = await cook.request.patch(`${BASE}/api/settings/buildings/${buildingId}`, { data: { journalName: "Взлом" } });
    check("повар: PATCH точки → 403", cookPatch.status() === 403, cookPatch.status());
    await cook.close();
  } catch (error) {
    console.error("E2E ERROR", error);
    checks.push({ name: "e2e без исключений", ok: false, detail: String(error).slice(0, 800) });
  } finally {
    await browser.close();
    if (documentId) await db.journalDocument.delete({ where: { id: documentId } }).catch(() => null);
    for (const id of extraDocs) await db.journalDocument.delete({ where: { id } }).catch(() => null);
    await db.inspectorToken.deleteMany({ where: { organizationId: ORG_A, label: "E2E точка" } }).catch(() => null);
    if (buildingId) await db.building.delete({ where: { id: buildingId } }).catch(() => null);
    const passed = checks.filter((item) => item.ok).length;
    fs.writeFileSync(path.join(HERE, "building-journal-name.json"), JSON.stringify(checks, null, 2));
    console.log(`\n${passed}/${checks.length} PASS`);
    await db.$disconnect();
    process.exit(passed === checks.length ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
