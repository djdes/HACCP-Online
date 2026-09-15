// e2e Задачи 4: колонки таблиц бракеража готовой продукции и скоропорта — скрыть/показать/переименовать
// в «Настройках журнала» и в меню заголовка, «Применить ко всем документам», таблица/карточки/диалог/PDF,
// наследование общего набора новым документом, сохранность данных скрытой колонки, TasksFlow, права.
// Запуск (dev на 3020 с wesetup_e2e, после setup-db.ts Задачи 1):
//   npx tsx .agent/tasks/journal-columns-2026-09/e2e/columns.ts
import fs from "node:fs";
import path from "node:path";
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

async function openDoc(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load", timeout: 300_000 });
  await page.waitForTimeout(2500);
  const guide = page.locator('[role="dialog"][aria-labelledby="fill-guide-title"]');
  if (await guide.isVisible().catch(() => false)) {
    await guide.getByRole("button", { name: "Понятно" }).first().click().catch(() => page.keyboard.press("Escape"));
    await guide.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => null);
  }
}

async function pdfText(api: APIRequestContext, id: string): Promise<string> {
  const response = await api.get(`${BASE}/api/journal-documents/${id}/pdf`, { timeout: 180_000 });
  if (!response.ok()) return `HTTP ${response.status()}`;
  const data = new Uint8Array(await response.body());
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
  }
  return text.replace(/\s+/g, " ");
}

async function createDoc(api: APIRequestContext, templateCode: string, title: string, config?: Record<string, unknown>) {
  const response = await api.post(`${BASE}/api/journal-documents`, {
    data: { ...monthBounds(), force: true, templateCode, title, ...(config ? { config } : {}) },
    timeout: 180_000,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok() || !json?.document?.id) throw new Error(`create ${templateCode}: ${response.status()} ${JSON.stringify(json)}`);
  return json.document.id as string;
}

async function docConfig(id: string) {
  const doc = await db.journalDocument.findUnique({ where: { id }, select: { config: true } });
  return (doc?.config ?? {}) as Record<string, unknown>;
}

const headTexts = async (page: Page) =>
  (await page.locator("thead th").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);

async function main() {
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DATABASE_URL_DIRECT = E2E_DATABASE_URL;
  await db.organization.update({ where: { id: ORG_A }, data: { journalColumnsJson: {} } });
  const browser = await chromium.launch({ headless: true });
  try {
    const manager = await login(browser, U.managerA.email);
    const api = manager.request;
    const page = await manager.newPage();

    // ── Бракераж готовой продукции ──────────────────────────────────────
    const legacyFinished = await createDoc(api, "finished_product", "E2E колонки старый");
    const finished = await createDoc(api, "finished_product", "E2E колонки");
    await openDoc(page, `${BASE}/journals/finished_product/documents/${legacyFinished}`);
    const legacyHead = await headTexts(page);
    const legacyCfg = await docConfig(legacyFinished);
    check(
      "документ без набора колонок выглядит как раньше (флаги по умолчанию: T°C и курьер есть, кислорода нет)",
      legacyCfg.columns === undefined &&
        legacyHead.some((text) => text.includes("T°C внутри продукта")) &&
        legacyHead.some((text) => text.includes("Время передачи блюд курьеру")) &&
        !legacyHead.some((text) => text.includes("Остаточный уровень кислорода")) &&
        legacyHead.some((text) => text.includes("Ответственный исполнитель")),
      { legacyHead, columns: legacyCfg.columns }
    );

    // Строка с данными — чтобы проверить карточки, PDF и сохранность при скрытии.
    const baseCfg = await docConfig(finished);
    await api.patch(`${BASE}/api/journal-documents/${finished}`, {
      data: {
        config: {
          ...baseCfg,
          rows: [
            {
              id: "e2e-row-1",
              productionDateTime: "2026-09-15 10:00",
              rejectionTime: "2026-09-15 10:30",
              productName: "Борщ",
              organoleptic: "Соответствует",
              productTemp: "72",
              releasePermissionTime: "2026-09-15 11:00",
              responsiblePerson: "Иван Повар",
              inspectorName: "Анна Заведующая",
            },
          ],
        },
      },
    });

    await openDoc(page, `${BASE}/journals/finished_product/documents/${finished}`);
    await page.getByRole("button", { name: "Настройки журнала" }).first().click();
    const settings = page.getByRole("dialog").filter({ hasText: "Колонки таблицы" }).first();
    await settings.waitFor({ timeout: 30_000 });
    check(
      "настройки: обязательная колонка — переключатель недоступен",
      await settings.getByRole("checkbox", { name: "Скрыть колонку «Время снятия бракеража»" }).isDisabled()
    );
    await settings.getByRole("checkbox", { name: "Показать колонку «Остаточный уровень кислорода, % об.»" }).click();
    const nameRow = settings.locator("div", { hasText: "Наименование блюд (изделий)" }).filter({ has: page.getByRole("button", { name: "Переименовать колонку" }) }).last();
    await nameRow.getByRole("button", { name: "Переименовать колонку" }).click();
    await settings.getByRole("textbox", { name: "Название колонки" }).fill("Блюдо");
    await settings.getByRole("textbox", { name: "Название колонки" }).press("Enter");
    await page.screenshot({ path: path.join(SHOTS, "finished-settings-columns.png"), fullPage: false });
    await settings.getByRole("button", { name: "Сохранить" }).last().click();
    await page.waitForTimeout(2500);
    const afterSettings = await docConfig(finished);
    const afterColumns = afterSettings.columns as { hidden: string[]; labels: Record<string, string> } | undefined;
    check(
      "настройки: набор колонок сохранён (кислород показан, «Блюдо», флаг showOxygenLevel)",
      Boolean(afterColumns) && !afterColumns!.hidden.includes("oxygen") && afterColumns!.labels.name === "Блюдо" && afterSettings.showOxygenLevel === true,
      { columns: afterColumns, showOxygenLevel: afterSettings.showOxygenLevel }
    );

    await openDoc(page, `${BASE}/journals/finished_product/documents/${finished}`);
    let head = await headTexts(page);
    check("таблица: «Блюдо» и кислород в шапке", head.includes("Блюдо") && head.some((text) => text.includes("Остаточный уровень кислорода")), head);

    // Меню заголовка: скрыть «Ответственный исполнитель».
    await page.locator("thead th", { hasText: "Ответственный исполнитель" }).first().click({ button: "right" });
    const menu = page.getByRole("menu").first();
    await menu.waitFor({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SHOTS, "finished-header-menu.png"), fullPage: false });
    await menu.getByRole("menuitem", { name: "Скрыть колонку" }).click();
    await page.waitForTimeout(2500);
    const afterHide = (await docConfig(finished)).columns as { hidden: string[] } | undefined;
    check("меню заголовка: «Скрыть колонку» сохраняется в документ", Boolean(afterHide?.hidden.includes("responsible")), afterHide);
    await openDoc(page, `${BASE}/journals/finished_product/documents/${finished}`);
    head = await headTexts(page);
    check("таблица: скрытой колонки нет", !head.some((text) => text.includes("Ответственный исполнитель")), head);
    const rowsAfterHide = (await docConfig(finished)).rows as Array<{ responsiblePerson?: string }>;
    check("данные скрытой колонки остались в строке", rowsAfterHide?.[0]?.responsiblePerson === "Иван Повар", rowsAfterHide?.[0]);

    const pdf = await pdfText(api, finished);
    check("PDF: «Блюдо» есть, скрытой колонки нет", pdf.includes("Блюдо") && !pdf.includes("Ответственный исполнитель"), pdf.slice(0, 400));

    // Карточки на телефоне.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await manager.storageState() });
    const phonePage = await phone.newPage();
    await openDoc(phonePage, `${BASE}/journals/finished_product/documents/${finished}`);
    // Редактируемая карточка открывает диалог строки (поля карточки раскрываются только в режиме чтения).
    check("телефон: вид «Карточки» доступен", (await phonePage.getByRole("tab", { name: /Карточки/ }).count()) > 0);
    await phonePage.screenshot({ path: path.join(SHOTS, "finished-cards.png"), fullPage: false });
    await phonePage.getByText("№1 · Борщ").first().click();
    const phoneDialog = phonePage.getByRole("dialog").last();
    await phoneDialog.waitFor({ timeout: 30_000 });
    await phonePage.waitForTimeout(800);
    const phoneDialogText = await phoneDialog.innerText().catch(() => "");
    check(
      "телефон: диалог строки из карточки — без скрытой колонки, с показанным кислородом",
      !phoneDialogText.includes("Ответственный исполнитель") && phoneDialogText.includes("Остаточный уровень кислорода"),
      phoneDialogText.slice(0, 600)
    );
    await phonePage.screenshot({ path: path.join(SHOTS, "finished-phone-row-dialog.png"), fullPage: false });
    await phone.close();

    // «Применить ко всем документам» из настроек.
    await openDoc(page, `${BASE}/journals/finished_product/documents/${finished}`);
    await page.getByRole("button", { name: "Настройки журнала" }).first().click();
    await page.getByRole("button", { name: "Применить ко всем документам…" }).first().click();
    const apply = page.locator('[role="dialog"][aria-labelledby="confirm-dialog-title"]');
    await apply.waitFor({ timeout: 15_000 });
    await apply.getByText("Все документы журнала").click();
    await page.screenshot({ path: path.join(SHOTS, "finished-apply-all.png"), fullPage: false });
    await apply.getByRole("button", { name: "Применить" }).click();
    const toastOk = await page.locator("[data-sonner-toast]", { hasText: "Обновлено:" }).first().waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    check("«Применить ко всем»: тост «Обновлено: N документов»", toastOk);
    const legacyAfter = await docConfig(legacyFinished);
    const legacyAfterColumns = legacyAfter.columns as { hidden: string[]; labels: Record<string, string> } | undefined;
    check(
      "«Применить ко всем»: второй документ получил набор",
      Boolean(legacyAfterColumns?.hidden.includes("responsible")) && legacyAfterColumns?.labels.name === "Блюдо" && legacyAfter.showOxygenLevel === true,
      legacyAfterColumns
    );
    const org = await db.organization.findUnique({ where: { id: ORG_A }, select: { journalColumnsJson: true } });
    const orgFinished = (org?.journalColumnsJson as Record<string, { hidden: string[] }> | null)?.finished_product;
    check("«Применить ко всем»: набор стал общим для организации", Boolean(orgFinished?.hidden.includes("responsible")), org?.journalColumnsJson);

    const newer = await createDoc(api, "finished_product", "E2E колонки новый");
    const newerColumns = (await docConfig(newer)).columns as { hidden: string[]; labels: Record<string, string> } | undefined;
    check("новый документ получает общий набор", Boolean(newerColumns?.hidden.includes("responsible")) && newerColumns?.labels.name === "Блюдо", newerColumns);

    // ── Бракераж скоропорта ─────────────────────────────────────────────
    const perishable = await createDoc(api, "perishable_rejection", "E2E колонки скоропорт");
    const perishableCfg = await docConfig(perishable);
    await api.patch(`${BASE}/api/journal-documents/${perishable}`, {
      data: {
        config: {
          ...perishableCfg,
          rows: [
            {
              id: "e2e-per-1",
              arrivalDate: "2026-09-15",
              arrivalTime: "09:00",
              productName: "Сметана",
              documentNumber: "ВСД-77",
              organolepticResult: "compliant",
              responsiblePerson: "Иван Повар",
              note: "",
            },
          ],
        },
      },
    });
    await openDoc(page, `${BASE}/journals/perishable_rejection/documents/${perishable}`);
    await page.locator("thead th", { hasText: "Номер документа" }).first().click({ button: "right" });
    await page.getByRole("menu").first().getByRole("menuitem", { name: "Скрыть колонку" }).click();
    await page.waitForTimeout(2000);
    await page.locator("thead th", { hasText: "Наименование" }).first().click({ button: "right" });
    await page.getByRole("menu").first().getByRole("menuitem", { name: "Переименовать" }).click();
    const rename = page.locator('[role="dialog"][aria-labelledby="confirm-dialog-title"]');
    await rename.getByRole("textbox", { name: "Название колонки" }).fill("Продукт");
    await rename.getByRole("button", { name: "Сохранить" }).click();
    await page.waitForTimeout(2500);
    const perAfter = await docConfig(perishable);
    const perColumns = perAfter.columns as { hidden: string[]; labels: Record<string, string> } | undefined;
    check(
      "скоропорт: скрыт «Номер документа», переименовано «Продукт»",
      Boolean(perColumns?.hidden.includes("document")) && perColumns?.labels.product === "Продукт",
      perColumns
    );
    await openDoc(page, `${BASE}/journals/perishable_rejection/documents/${perishable}`);
    const perHead = await headTexts(page);
    check("скоропорт: шапка таблицы по набору", perHead.includes("Продукт") && !perHead.some((text) => text.includes("Номер документа")), perHead);
    // Первая tbody-строка на странице — шапка бланка (3 ячейки); берём строку данных.
    const visibleCells = await page.locator("tbody tr", { hasText: "Сметана" }).first().locator("td:visible").count();
    check("скоропорт: ячейки строки совпадают с колонками (чекбокс + 10)", visibleCells === 11, visibleCells);
    await page.screenshot({ path: path.join(SHOTS, "perishable-columns.png"), fullPage: false });
    const perPdf = await pdfText(api, perishable);
    check("скоропорт PDF: «Продукт» есть, «Номер документа» нет", perPdf.includes("Продукт") && !perPdf.includes("Номер документа"), perPdf.slice(0, 400));
    const perRows = perAfter.rows as Array<{ documentNumber?: string }>;
    check("скоропорт: номер документа в строке сохранился", perRows?.[0]?.documentNumber === "ВСД-77", perRows?.[0]);

    // Диалог строки: поле скрытой колонки не показывается.
    await page.getByRole("button", { name: "Добавить запись" }).first().click().catch(() => null);
    await page.waitForTimeout(1000);
    const addDialog = page.getByRole("dialog").last();
    const docField = addDialog.getByText("Номер документа", { exact: true });
    check("скоропорт: в диалоге строки нет поля скрытой колонки", !(await docField.isVisible().catch(() => false)));
    await page.keyboard.press("Escape");

    // TasksFlow: запись строки не теряет набор колонок.
    const { getAdapter } = await import("../../../../src/lib/tasksflow-adapters/index");
    const tf = await getAdapter("perishable_rejection")!.applyRemoteCompletion({
      documentId: perishable,
      rowKey: `employee-${U.cookA.id}`,
      completed: true,
      todayKey: new Date().toISOString().slice(0, 10),
      values: { productName: "Молоко" },
    });
    const perTf = (await docConfig(perishable)).columns as { hidden: string[] } | undefined;
    check("TasksFlow: запись строки сохраняет набор колонок", tf === true && Boolean(perTf?.hidden.includes("document")), { tf, perTf });

    // ── Права ───────────────────────────────────────────────────────────
    const cook = await login(browser, U.cookA.email);
    const cookPut = await cook.request.put(`${BASE}/api/settings/journal-columns/finished_product`, {
      data: { columns: { hidden: [], labels: {} }, applyTo: "all" },
    });
    check("повар: PUT /api/settings/journal-columns → 403", cookPut.status() === 403, cookPut.status());
    await cook.close();
    const unknown = await api.put(`${BASE}/api/settings/journal-columns/hygiene`, { data: { columns: { hidden: [], labels: {} }, applyTo: "all" } });
    check("журнал без реестра колонок → 404", unknown.status() === 404, unknown.status());

    await manager.close();
  } catch (error) {
    console.error("E2E ERROR", error);
    checks.push({ name: "e2e прошёл без исключений", ok: false, detail: String(error).slice(0, 800) });
  } finally {
    await browser.close();
    const passed = checks.filter((item) => item.ok).length;
    fs.writeFileSync(path.join(HERE, "columns.json"), JSON.stringify(checks, null, 2));
    console.log(`\n${passed}/${checks.length} PASS`);
    await db.organization.update({ where: { id: ORG_A }, data: { journalColumnsJson: {} } }).catch(() => null);
    await db.$disconnect();
    process.exit(passed === checks.length ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
