// e2e Задачи 2: сокращённое название организации — поле настроек и партнёрский PATCH,
// шапка документа на сайте и в Mini App, PDF, архив проверки, портал инспектора,
// правка шапки прямо в документе (организация / название / периодичность), перенос при сохранении.
// Запуск (dev на 3020 с wesetup_e2e, после setup-db.ts Задачи 1):
//   npx tsx .agent/tasks/org-short-name-2026-09/e2e/header-name.ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { chromium, type APIRequestContext, type Browser, type BrowserContext, type Page } from "playwright";

import { db, E2E_DATABASE_URL } from "../../journal-responsibles-org-2026-09/e2e/db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SHOTS = path.join(HERE, "..", "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const T1 = path.join(HERE, "..", "..", "journal-responsibles-org-2026-09", "e2e");
const state = JSON.parse(fs.readFileSync(path.join(T1, "state.json"), "utf8"));
const U = state.users as Record<string, { id: string; email: string; name: string }>;
const ORG_A = state.orgA as string;

const SHORT = "Альфа · журналы";
const DOC_ONLY = "Альфа, цех 1";
const ALL_FROM_HEADER = "Альфа (все журналы)";
const ALL_AGAIN = "Альфа (общее)";
const TITLE = "Гигиенический журнал цеха 1";
const PERIODICITY = "Ежедневно перед сменой и после неё";

type Check = { name: string; ok: boolean; detail?: unknown };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 500)}` : ""}`);
}

function monthBounds() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { dateFrom: `${y}-${pad(m + 1)}-01`, dateTo: `${y}-${pad(m + 1)}-${pad(last)}` };
}

async function login(browser: Browser, email: string, viewport = { width: 1440, height: 900 }): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
  for (let i = 0; i < 30; i += 1) {
    await page.fill("#email", email);
    await page.fill("#password", state.password);
    if ((await page.inputValue("#email")) === email) break;
    await page.waitForTimeout(300);
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 180_000 });
  await page.close();
  return context;
}

async function pdfText(api: APIRequestContext, url: string): Promise<string> {
  const response = await api.get(url, { timeout: 180_000 });
  if (!response.ok()) return `HTTP ${response.status()}`;
  const data = new Uint8Array(await response.body());
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
  }
  // Ячейки шапки переносят длинный текст на строки — сравниваем без лишних пробелов.
  return text.replace(/\s+/g, " ");
}

async function createDoc(api: APIRequestContext, templateCode: string, title: string) {
  const response = await api.post(`${BASE}/api/journal-documents`, {
    data: { ...monthBounds(), force: true, templateCode, title },
    timeout: 180_000,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok() || !json?.document?.id) throw new Error(`create ${templateCode}: ${response.status()} ${JSON.stringify(json)}`);
  return json.document.id as string;
}

const HEADER_PENCILS =
  'button[aria-label="Изменить название организации"], button[aria-label="Изменить название документа"], button[aria-label="Изменить периодичность контроля"]';
const CONFIRM_DIALOG = '[role="dialog"][aria-labelledby="confirm-dialog-title"]';

async function openDoc(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load", timeout: 300_000 });
  await page.waitForTimeout(2500);
  // «Как заполнить?» открывается сам при первом визите журнала — закрываем.
  const guide = page.locator('[role="dialog"][aria-labelledby="fill-guide-title"]');
  if (await guide.isVisible().catch(() => false)) {
    await guide.getByRole("button", { name: "Понятно" }).first().click().catch(() => page.keyboard.press("Escape"));
    await guide.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => null);
  }
}

/** Текст ячейки организации бумажной шапки (td rowspan=2). */
async function headerOrgText(page: Page): Promise<string> {
  const cell = page.locator('td[rowspan="2"]').first();
  return ((await cell.innerText({ timeout: 60_000 }).catch(() => "")) || "").trim();
}

async function orgConfig(id: string) {
  const doc = await db.journalDocument.findUnique({ where: { id }, select: { config: true, status: true } });
  return (doc?.config ?? {}) as Record<string, unknown>;
}

async function waitToast(page: Page, text: string) {
  return page
    .locator("[data-sonner-toast]", { hasText: text })
    .first()
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
}

async function editHeaderText(page: Page, label: string, value: string, submit: "enter" | "blur") {
  const cell = page.locator(`button[aria-label="${label}"]`).first();
  await cell.scrollIntoViewIfNeeded();
  const parentCell = cell.locator("xpath=ancestor::td[1]");
  await parentCell.hover();
  await cell.click();
  const input = page.locator(`textarea[aria-label="${label}"]`).first();
  await input.waitFor({ timeout: 15_000 });
  await input.fill(value);
  if (submit === "enter") await input.press("Enter");
  else await page.locator("body").click({ position: { x: 5, y: 5 } });
}

async function main() {
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DATABASE_URL_DIRECT = E2E_DATABASE_URL;
  const browser = await chromium.launch({ headless: true });
  let partnerId: string | null = null;
  try {
    // Чистое состояние организации A для этого прогона.
    await db.organization.update({
      where: { id: ORG_A },
      data: {
        journalShortName: null,
        legalProfileJson: {
          inn: "7700000001",
          nameShort: "ООО «АЛЬФА»",
          nameFull: "ООО «Кафе «Альфа»»",
          okvedsExtra: [],
          founders: [],
          phones: [],
          emails: [],
        },
        presetCapabilitiesJson: {
          head_chef: ["journals.view", "journals.manage", "staff.view", "tasks.verify", "stats.view", "mini.tasks"],
        },
      },
    });

    const manager = await login(browser, U.managerA.email);
    const api = manager.request;
    const page = await manager.newPage();

    // ── AC1: поле в настройках организации ──────────────────────────────
    await openDoc(page, `${BASE}/settings/organization`);
    const field = page.locator('input[maxlength="120"]').first();
    check("настройки: поле «Сокращённое название для журналов» есть", await page.getByText("Сокращённое название для журналов").first().isVisible());
    const egrulButton = page.getByRole("button", { name: /Взять из ЕГРЮЛ: ООО «АЛЬФА»/ });
    check("настройки: кнопка «Взять из ЕГРЮЛ: …» при nameShort", await egrulButton.isVisible().catch(() => false));
    await egrulButton.click();
    check("настройки: «Взять из ЕГРЮЛ» подставляет краткое название", (await field.inputValue()) === "ООО «АЛЬФА»", await field.inputValue());
    await field.fill(SHORT);
    check(
      "настройки: предпросмотр «В шапке журналов» — введённое название",
      await page.getByText(`«${SHORT}»`).first().isVisible().catch(() => false)
    );
    await page.screenshot({ path: path.join(SHOTS, "settings-short-name.png"), fullPage: false });
    await page.getByRole("button", { name: "Сохранить" }).first().click();
    check("настройки: сохранение — тост «Сохранено»", await waitToast(page, "Сохранено"));
    const afterSave = await db.organization.findUnique({ where: { id: ORG_A }, select: { journalShortName: true } });
    check("настройки: journalShortName сохранено", afterSave?.journalShortName === SHORT, afterSave);

    const clear = await api.patch(`${BASE}/api/settings/organization`, { data: { journalShortName: "   " } });
    const afterClear = await db.organization.findUnique({ where: { id: ORG_A }, select: { journalShortName: true } });
    check("API: пустое сокращённое название очищается в null", clear.ok() && afterClear?.journalShortName === null, afterClear);
    await api.patch(`${BASE}/api/settings/organization`, { data: { journalShortName: SHORT } });

    // Партнёр правит поле с карточки клиента.
    await db.partner.deleteMany({ where: { slug: "e2e-short-name-partner" } });
    const partner = await db.partner.create({
      data: {
        slug: "e2e-short-name-partner",
        code: "E2ESHN",
        status: "active",
        type: "consultant",
        companyName: "E2E Сопровождение",
        inn: "7707083893",
        city: "Москва",
        phone: "+79990000001",
        contactEmail: "e2e-short-name-partner@e2e.local",
        termsAcceptedAt: new Date(),
        onboardingDoneAt: new Date(),
        applicantUserId: U.managerB.id,
        applicantOrganizationId: state.orgB,
        members: { create: { userId: U.managerB.id, role: "owner" } },
        clients: { create: { organizationId: ORG_A, accessLevel: "edit", source: "manual" } },
      },
      select: { id: true },
    });
    partnerId = partner.id;
    const partnerContext = await login(browser, U.managerB.email);
    const partnerSet = await partnerContext.request.patch(`${BASE}/api/partner/clients/${ORG_A}`, {
      data: { journalShortName: "Альфа (партнёр)" },
    });
    const afterPartner = await db.organization.findUnique({ where: { id: ORG_A }, select: { journalShortName: true } });
    check("партнёр: PATCH /api/partner/clients/[orgId] сохраняет название", partnerSet.ok() && afterPartner?.journalShortName === "Альфа (партнёр)", { status: partnerSet.status(), afterPartner });
    const partnerClear = await partnerContext.request.patch(`${BASE}/api/partner/clients/${ORG_A}`, { data: { journalShortName: "" } });
    const afterPartnerClear = await db.organization.findUnique({ where: { id: ORG_A }, select: { journalShortName: true } });
    check("партнёр: пустое значение очищает название", partnerClear.ok() && afterPartnerClear?.journalShortName === null, afterPartnerClear);
    await partnerContext.close();
    await api.patch(`${BASE}/api/settings/organization`, { data: { journalShortName: SHORT } });

    // ── AC3: шапка, Mini App, PDF, архив, портал инспектора ────────────────
    const ids = {
      hygiene: await createDoc(api, "hygiene", "E2E шапка гигиена"),
      climate: await createDoc(api, "climate_control", "E2E шапка климат"),
      finished: await createDoc(api, "finished_product", "E2E шапка бракераж"),
      complaint: await createDoc(api, "complaint_register", "E2E шапка жалобы"),
    };
    for (const [code, id] of [
      ["hygiene", ids.hygiene],
      ["climate_control", ids.climate],
      ["finished_product", ids.finished],
    ] as const) {
      await openDoc(page, `${BASE}/journals/${code}/documents/${id}`);
      const text = await headerOrgText(page);
      check(`${code}: в шапке сокращённое название`, text.includes(SHORT), text);
      const pdf = await pdfText(api, `${BASE}/api/journal-documents/${id}/pdf`);
      check(`${code}: PDF с сокращённым названием`, pdf.includes(SHORT), pdf.slice(0, 200));
    }
    await openDoc(page, `${BASE}/mini/documents/${ids.hygiene}`);
    check("Mini App: в шапке сокращённое название", (await headerOrgText(page)).includes(SHORT));
    check("Mini App: карандаш правки шапки есть", (await page.locator('button[aria-label="Изменить название организации"]').count()) > 0);
    await page.screenshot({ path: path.join(SHOTS, "mini-header.png"), fullPage: false });

    const { dateFrom, dateTo } = monthBounds();
    const bundle = await api.get(`${BASE}/api/reports/compliance-bundle?from=${dateFrom}&to=${dateTo}`, { timeout: 300_000 });
    let manifest = "";
    if (bundle.ok()) {
      const zip = await JSZip.loadAsync(await bundle.body());
      manifest = (await zip.file("ОТЧЁТ.txt")?.async("string")) ?? "";
    }
    check("архив проверки: в ОТЧЁТ.txt сокращённое название", manifest.includes(`Организация: ${SHORT}`), { status: bundle.status(), manifest: manifest.slice(0, 200) });

    const rawToken = crypto.randomBytes(24).toString("base64url");
    await db.inspectorToken.create({
      data: {
        organizationId: ORG_A,
        tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
        label: "E2E шапка",
        periodFrom: new Date(`${dateFrom}T00:00:00.000Z`),
        periodTo: new Date(`${dateTo}T00:00:00.000Z`),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const anonymous = await browser.newContext();
    const inspectorResponse = await anonymous.request.get(`${BASE}/inspector/${rawToken}`, { timeout: 300_000 });
    const inspectorHtml = await inspectorResponse.text();
    check("портал инспектора: сокращённое название", inspectorResponse.ok() && inspectorHtml.includes(SHORT), inspectorResponse.status());
    await anonymous.close();

    const reportPdf = await api.get(`${BASE}/api/reports/pdf?template=hygiene&from=${dateFrom}&to=${dateTo}`, { timeout: 300_000 });
    check("отчёт /api/reports/pdf формируется (название — из базы)", reportPdf.ok(), reportPdf.status());

    const paper = await pdfText(api, `${BASE}/api/settings/journals/paper/ot_intro/pdf`);
    check("бумажный бланк: сокращённое название", paper.includes(SHORT), paper.slice(0, 160));

    await openDoc(page, `${BASE}/dashboard`);
    const dashboardHtml = await page.content();
    check("кабинет: полное название организации на месте", dashboardHtml.includes("Кафе «Альфа»"));

    // ── AC4: правка названия организации в шапке ─────────────────────────
    await openDoc(page, `${BASE}/journals/hygiene/documents/${ids.hygiene}`);
    const pencil = page.locator('button[aria-label="Изменить название организации"]').first();
    await page.locator('td[rowspan="2"]').first().hover();
    check("шапка: карандаш по наведению", await pencil.isVisible());
    await page.screenshot({ path: path.join(SHOTS, "header-hover-pencil.png"), fullPage: false });
    await page.emulateMedia({ media: "print" });
    check("шапка: в печати карандаша нет", !(await pencil.isVisible()));
    await page.emulateMedia({ media: "screen" });

    await editHeaderText(page, "Изменить название организации", DOC_ONLY, "enter");
    const dialog = page.locator(CONFIRM_DIALOG);
    await dialog.waitFor({ timeout: 15_000 });
    check("шапка: диалог «Где поменять название?»", await dialog.getByText("Где поменять название?").isVisible());
    await page.screenshot({ path: path.join(SHOTS, "header-scope-dialog.png"), fullPage: false });
    await dialog.locator('input[value="document"]').check();
    await dialog.getByRole("button", { name: "Сохранить" }).click();
    check("шапка «только здесь»: тост", await waitToast(page, "только в этом документе"));
    check("шапка «только здесь»: config.headerOrgName", (await orgConfig(ids.hygiene)).headerOrgName === DOC_ONLY, await orgConfig(ids.hygiene));
    await openDoc(page, `${BASE}/journals/hygiene/documents/${ids.hygiene}`);
    check("шапка «только здесь»: документ показывает своё название", (await headerOrgText(page)).includes(DOC_ONLY));
    await openDoc(page, `${BASE}/journals/climate_control/documents/${ids.climate}`);
    check("шапка «только здесь»: другой журнал не изменился", (await headerOrgText(page)).includes(SHORT));

    await editHeaderText(page, "Изменить название организации", ALL_FROM_HEADER, "enter");
    await dialog.waitFor({ timeout: 15_000 });
    check("шапка: по умолчанию выбрано «Во всех журналах»", await dialog.locator('input[value="organization"]').isChecked());
    await dialog.getByRole("button", { name: "Сохранить" }).click();
    check("шапка «во всех»: тост", await waitToast(page, "шапке всех журналов"));
    const orgAfterAll = await db.organization.findUnique({ where: { id: ORG_A }, select: { journalShortName: true } });
    check("шапка «во всех»: Organization.journalShortName", orgAfterAll?.journalShortName === ALL_FROM_HEADER, orgAfterAll);
    await openDoc(page, `${BASE}/journals/finished_product/documents/${ids.finished}`);
    check("шапка «во всех»: третий журнал показывает новое название", (await headerOrgText(page)).includes(ALL_FROM_HEADER));
    await openDoc(page, `${BASE}/journals/hygiene/documents/${ids.hygiene}`);
    check("шапка «во всех»: документ со своим названием сохранил его", (await headerOrgText(page)).includes(DOC_ONLY));

    await editHeaderText(page, "Изменить название организации", ALL_AGAIN, "enter");
    await dialog.waitFor({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "Сохранить" }).click();
    await waitToast(page, "шапке всех журналов");
    const hygieneAfterAll = await orgConfig(ids.hygiene);
    check("«во всех» из документа со своим названием: своё снято", !hygieneAfterAll.headerOrgName, hygieneAfterAll.headerOrgName);
    await openDoc(page, `${BASE}/journals/hygiene/documents/${ids.hygiene}`);
    check("«во всех» из документа со своим названием: показано общее", (await headerOrgText(page)).includes(ALL_AGAIN));

    // ── AC6: название документа и периодичность ───────────────────────────
    await editHeaderText(page, "Изменить название документа", TITLE, "enter");
    check("название документа: тост", await waitToast(page, "Название документа изменено"));
    check("название документа: config.headerTitle", (await orgConfig(ids.hygiene)).headerTitle === TITLE, (await orgConfig(ids.hygiene)).headerTitle);
    await openDoc(page, `${BASE}/journals/hygiene/documents/${ids.hygiene}`);
    const headerHtml = (await page.locator("table").first().innerText().catch(() => "")).toLowerCase();
    check("название документа: в шапке новое", headerHtml.includes(TITLE.toLowerCase()), headerHtml.slice(0, 300));
    const pdfWithTitle = await pdfText(api, `${BASE}/api/journal-documents/${ids.hygiene}/pdf`);
    check("название документа: в PDF", pdfWithTitle.toUpperCase().includes(TITLE.toUpperCase()), pdfWithTitle.slice(0, 300));

    await editHeaderText(page, "Изменить периодичность контроля", PERIODICITY, "blur");
    check("периодичность: тост", await waitToast(page, "Периодичность контроля обновлена"));
    check("периодичность: config.controlPeriodicity", (await orgConfig(ids.hygiene)).controlPeriodicity === PERIODICITY, (await orgConfig(ids.hygiene)).controlPeriodicity);

    // Название документа из шапки — и в собственных штампах PDF этих журналов.
    for (const [code, custom] of [
      ["cleaning_ventilation_checklist", "Свой бланк вентиляции"],
      ["sanitary_day_control", "Свой бланк санитарного дня"],
    ] as const) {
      const id = await createDoc(api, code, `E2E шапка ${code}`);
      const titled = await api.patch(`${BASE}/api/journal-documents/${id}`, { data: { headerTitle: custom } });
      const text = await pdfText(api, `${BASE}/api/journal-documents/${id}/pdf`);
      check(
        `${code}: название документа из шапки в PDF`,
        titled.ok() && text.toUpperCase().includes(custom.toUpperCase()),
        text.slice(0, 300)
      );
    }

    // Бумажный бланк на экране показывает то же название, что и его PDF.
    const orgNow = await db.organization.findUnique({ where: { id: ORG_A }, select: { journalShortName: true } });
    await openDoc(page, `${BASE}/settings/journals/paper/ot_intro`);
    const paperScreen = await page.locator("main").innerText().catch(() => "");
    check(
      "бумажный бланк на экране: сокращённое название",
      Boolean(orgNow?.journalShortName) && paperScreen.includes(orgNow!.journalShortName!),
      { journalShortName: orgNow?.journalShortName, screen: paperScreen.slice(0, 200) }
    );

    // ── AC5: перенос при сохранении строк и при записи из TasksFlow ───────
    const docOverride = await api.patch(`${BASE}/api/journal-documents/${ids.hygiene}`, { data: { headerOrgName: DOC_ONLY } });
    check("PATCH headerOrgName (только этот документ)", docOverride.ok());
    const cfg = await orgConfig(ids.hygiene);
    const withoutHeader = { ...cfg };
    delete withoutHeader.headerOrgName;
    delete withoutHeader.headerTitle;
    delete withoutHeader.controlPeriodicity;
    const rowsSave = await api.patch(`${BASE}/api/journal-documents/${ids.hygiene}`, { data: { config: withoutHeader } });
    const afterRows = await orgConfig(ids.hygiene);
    check(
      "сохранение строк без полей шапки: название, заголовок и периодичность на месте",
      rowsSave.ok() && afterRows.headerOrgName === DOC_ONLY && afterRows.headerTitle === TITLE && afterRows.controlPeriodicity === PERIODICITY,
      { headerOrgName: afterRows.headerOrgName, headerTitle: afterRows.headerTitle, controlPeriodicity: afterRows.controlPeriodicity }
    );
    const staleSave = await api.patch(`${BASE}/api/journal-documents/${ids.hygiene}`, {
      data: { config: { ...withoutHeader, headerOrgName: "УСТАРЕВШЕЕ", headerTitle: "УСТАРЕВШЕЕ" } },
    });
    const afterStale = await orgConfig(ids.hygiene);
    check("устаревшая копия конфига клиента не перетирает шапку", staleSave.ok() && afterStale.headerOrgName === DOC_ONLY && afterStale.headerTitle === TITLE, afterStale.headerOrgName);

    await api.patch(`${BASE}/api/journal-documents/${ids.complaint}`, { data: { headerOrgName: "Альфа, жалобы", headerTitle: "Жалобы гостей" } });
    const { getAdapter } = await import("../../../../src/lib/tasksflow-adapters/index");
    const todayKey = new Date().toISOString().slice(0, 10);
    const tf = await getAdapter("complaint_register")!.applyRemoteCompletion({
      documentId: ids.complaint,
      rowKey: `employee-${U.cookA.id}`,
      completed: true,
      todayKey,
      values: { applicantName: "Гость", complaintContent: "Холодный суп" },
    });
    const complaintCfg = await orgConfig(ids.complaint);
    check(
      "запись конфига из TasksFlow (нормализатор журнала) не стирает шапку",
      tf === true && complaintCfg.headerOrgName === "Альфа, жалобы" && complaintCfg.headerTitle === "Жалобы гостей" && Array.isArray(complaintCfg.rows) && (complaintCfg.rows as unknown[]).length === 1,
      { tf, headerOrgName: complaintCfg.headerOrgName, headerTitle: complaintCfg.headerTitle }
    );

    // ── Права: без управления журналами карандаша нет; без администратора — только «здесь» ──
    const cook = await login(browser, U.cookA.email);
    const cookPage = await cook.newPage();
    await openDoc(cookPage, `${BASE}/journals/climate_control/documents/${ids.climate}`);
    check("повар: карандашей в шапке нет", (await cookPage.locator(HEADER_PENCILS).count()) === 0, cookPage.url());
    const cookOrgPatch = await cook.request.patch(`${BASE}/api/settings/organization`, { data: { journalShortName: "Взлом" } });
    check("повар: PATCH /api/settings/organization → 403", cookOrgPatch.status() === 403, cookOrgPatch.status());
    await cook.close();

    const head = await login(browser, U.headA.email);
    const headPage = await head.newPage();
    await openDoc(headPage, `${BASE}/journals/climate_control/documents/${ids.climate}`);
    const headPencil = headPage.locator('button[aria-label="Изменить название организации"]').first();
    check("заведующая с правом на журналы: карандаш есть", (await headPencil.count()) > 0);
    if ((await headPencil.count()) > 0) {
      await editHeaderText(headPage, "Изменить название организации", "Альфа (заведующая)", "enter");
      const headDialog = headPage.locator(CONFIRM_DIALOG);
      await headDialog.waitFor({ timeout: 15_000 });
      check("заведующая: «Во всех журналах» недоступно", await headDialog.locator('input[value="organization"]').isDisabled());
      check("заведующая: выбрано «Только в этом документе»", await headDialog.locator('input[value="document"]').isChecked());
      await headPage.screenshot({ path: path.join(SHOTS, "header-scope-dialog-head.png"), fullPage: false });
      await headDialog.getByRole("button", { name: "Отмена" }).click();
    }
    await head.close();

    // Закрытый документ — шапка только для чтения.
    await api.patch(`${BASE}/api/journal-documents/${ids.finished}`, { data: { status: "closed" } });
    await openDoc(page, `${BASE}/journals/finished_product/documents/${ids.finished}`);
    check("закрытый документ: карандашей нет", (await page.locator(HEADER_PENCILS).count()) === 0);

    await manager.close();
  } finally {
    await browser.close();
    if (partnerId) await db.partner.delete({ where: { id: partnerId } }).catch(() => null);
    await db.inspectorToken.deleteMany({ where: { organizationId: ORG_A, label: "E2E шапка" } }).catch(() => null);
    await db.organization.update({ where: { id: ORG_A }, data: { presetCapabilitiesJson: {} } }).catch(() => null);
    const passed = checks.filter((item) => item.ok).length;
    fs.writeFileSync(path.join(HERE, "header-name.json"), JSON.stringify(checks, null, 2));
    console.log(`\n${passed}/${checks.length} PASS`);
    await db.$disconnect();
    process.exit(passed === checks.length ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
