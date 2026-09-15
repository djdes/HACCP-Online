// e2e Задачи 1: создание документов, выбор ответственного, чужие id,
// шапка/PDF без «Тест», отсутствие фикстур, демо-гейт, cron и пересоздание.
// Запуск (dev на 3020 с wesetup_e2e): npx tsx .agent/tasks/journal-responsibles-org-2026-09/e2e/create-docs.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type APIRequestContext, type Browser, type BrowserContext } from "playwright";

import { db } from "./db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SHOTS = path.join(HERE, "..", "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const state = JSON.parse(fs.readFileSync(path.join(HERE, "state.json"), "utf8"));
const U = state.users as Record<string, { id: string; email: string; name: string }>;

const CODES = [
  "hygiene",
  "climate_control",
  "cold_equipment_control",
  "cleaning",
  "uv_lamp_runtime",
  "disinfectant_usage",
  "finished_product",
  "perishable_rejection",
] as const;

const FIXTURES = /Ромашка|Бубнов|Пельмени|2023-12-01|2025-02-13|Ph средство|cold-equipment-default-/;

type Check = { name: string; ok: boolean; detail?: unknown };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""}`);
}

function monthBounds() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { dateFrom: `${y}-${pad(m + 1)}-01`, dateTo: `${y}-${pad(m + 1)}-${pad(last)}` };
}

async function login(browser: Browser, email: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 120_000 });
  for (let i = 0; i < 30; i += 1) {
    await page.fill("#email", email);
    await page.fill("#password", state.password);
    if ((await page.inputValue("#email")) === email) break;
    await page.waitForTimeout(300);
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
  await page.close();
  return context;
}

async function createDoc(api: APIRequestContext, body: Record<string, unknown>) {
  const response = await api.post(`${BASE}/api/journal-documents`, {
    data: { ...monthBounds(), force: true, ...body },
    timeout: 180_000,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status(), json };
}

async function pdfText(api: APIRequestContext, documentId: string): Promise<string> {
  const response = await api.get(`${BASE}/api/journal-documents/${documentId}/pdf`, { timeout: 180_000 });
  if (!response.ok()) return `HTTP ${response.status()}`;
  const data = new Uint8Array(await response.body());
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
  }
  return text;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const created: Record<string, { auto?: string; explicit?: string }> = {};
  try {
    const manager = await login(browser, U.managerA.email);
    const api = manager.request;

    // ── Создание: без выбора, с явным выбором, с чужими id ─────────────
    for (const code of CODES) {
      const auto = await createDoc(api, { templateCode: code, title: `E2E ${code} авто` });
      check(`${code}: создание без выбора → 201`, auto.status === 201, auto.json);
      const explicit = await createDoc(api, {
        templateCode: code,
        title: `E2E ${code} явный`,
        responsibleUserId: U.cleanerA.id,
        ...(code === "hygiene" ? { verifierUserId: U.headA.id } : {}),
      });
      check(`${code}: создание с явным ответственным → 201`, explicit.status === 201, explicit.json);
      created[code] = { auto: auto.json?.document?.id, explicit: explicit.json?.document?.id };

      if (explicit.json?.document) {
        check(
          `${code}: сохранён выбранный ответственный`,
          explicit.json.document.responsibleUserId === U.cleanerA.id,
          explicit.json.document.responsibleUserId
        );
        check(
          `${code}: должность в шапке — должность выбранного`,
          explicit.json.document.responsibleTitle === "Уборщица",
          explicit.json.document.responsibleTitle
        );
      }
      if (code === "hygiene" && explicit.json?.document) {
        check("hygiene: сохранён выбранный проверяющий", explicit.json.document.verifierUserId === U.headA.id, explicit.json.document.verifierUserId);
      }
    }

    for (const [label, id] of [
      ["из другой организации", U.cookB.id],
      ["ROOT", state.root.id],
      ["архивный", U.archivedA.id],
    ] as const) {
      const bad = await createDoc(api, { templateCode: "hygiene", title: "E2E плохой", responsibleUserId: id });
      check(
        `чужой ответственный (${label}) → 400 responsible-not-in-org`,
        bad.status === 400 && bad.json?.code === "responsible-not-in-org",
        { status: bad.status, json: bad.json }
      );
    }
    const badVerifier = await createDoc(api, { templateCode: "hygiene", title: "E2E плохой проверяющий", verifierUserId: U.managerB.id });
    check("чужой проверяющий → 400", badVerifier.status === 400, badVerifier.json);

    // ── Выбор только должности: человек из этой должности ─────────────
    const byTitle = await createDoc(api, { templateCode: "climate_control", title: "E2E по должности", responsibleTitle: "Повар" });
    check("только должность «Повар» → ответственный Повар", byTitle.json?.document?.responsibleUserId === U.cookA.id, byTitle.json?.document);

    // ── PATCH без responsibleUserId не меняет ответственного ──────────
    const hygieneId = created.hygiene.explicit!;
    const hygieneDoc = await db.journalDocument.findUnique({ where: { id: hygieneId }, select: { config: true } });
    const patch = await api.patch(`${BASE}/api/journal-documents/${hygieneId}`, {
      data: { config: hygieneDoc?.config ?? {} },
    });
    const afterPatch = await db.journalDocument.findUnique({ where: { id: hygieneId }, select: { responsibleUserId: true } });
    check("PATCH конфига без ответственного → ответственный прежний", patch.ok() && afterPatch?.responsibleUserId === U.cleanerA.id, afterPatch);

    // Документ без ответственного: сохранение прежнего конфига (в нём
    // ответственный записан) не назначает ответственного.
    const unassigned = await createDoc(api, { templateCode: "hygiene", title: "E2E без ответственного", responsibleUserId: U.cookA.id });
    const unassignedId = unassigned.json?.document?.id as string;
    await db.journalDocument.update({ where: { id: unassignedId }, data: { responsibleUserId: null } });
    const unassignedConfig = await db.journalDocument.findUnique({ where: { id: unassignedId }, select: { config: true } });
    const unassignedPatch = await api.patch(`${BASE}/api/journal-documents/${unassignedId}`, {
      data: { config: unassignedConfig?.config ?? {} },
    });
    const unassignedAfter = await db.journalDocument.findUnique({ where: { id: unassignedId }, select: { responsibleUserId: true } });
    check("PATCH прежнего конфига документа без ответственного → ответственного нет", unassignedPatch.ok() && unassignedAfter?.responsibleUserId === null, unassignedAfter);

    // Диалог настроек реестра выбирает ответственного внутри конфига —
    // выбор доходит до документа.
    const complaint = await createDoc(api, { templateCode: "complaint_register", title: "E2E жалобы", responsibleUserId: U.cookA.id });
    const complaintId = complaint.json?.document?.id as string;
    const complaintConfig = await db.journalDocument.findUnique({ where: { id: complaintId }, select: { config: true } });
    const complaintPatch = await api.patch(`${BASE}/api/journal-documents/${complaintId}`, {
      data: { config: { ...((complaintConfig?.config as Record<string, unknown>) ?? {}), defaultResponsibleUserId: U.headA.id } },
    });
    const complaintAfter = await db.journalDocument.findUnique({ where: { id: complaintId }, select: { responsibleUserId: true } });
    check("выбор ответственного в настройках реестра (в конфиге) → ответственный документа", complaint.status === 201 && complaintPatch.ok() && complaintAfter?.responsibleUserId === U.headA.id, { status: complaint.status, after: complaintAfter });

    const coldId = created.cold_equipment_control.auto!;
    const coldPatch = await api.patch(`${BASE}/api/journal-documents/${coldId}`, {
      data: { config: { equipment: [], skipWeekends: false } },
    });
    const coldAfter = await db.journalDocument.findUnique({ where: { id: coldId }, select: { config: true } });
    check("холодильники: пустой список после сохранения остаётся пустым", coldPatch.ok() && JSON.stringify(coldAfter?.config).includes('"equipment":[]'), coldAfter?.config);

    const patchForeign = await api.patch(`${BASE}/api/journal-documents/${hygieneId}`, {
      data: { responsibleUserId: U.cookB.id },
    });
    check("PATCH с чужим ответственным → 400", patchForeign.status() === 400, await patchForeign.json().catch(() => null));

    // Смена ответственного через PATCH — в шапке должность из карточки.
    const toHead = await api.patch(`${BASE}/api/journal-documents/${hygieneId}`, {
      data: { responsibleUserId: U.headA.id },
    });
    const afterHead = await db.journalDocument.findUnique({ where: { id: hygieneId }, select: { responsibleUserId: true, responsibleTitle: true } });
    check(
      "PATCH смены ответственного → должность из карточки сотрудника",
      toHead.ok() && afterHead?.responsibleUserId === U.headA.id && afterHead?.responsibleTitle === "Заведующая производством",
      afterHead
    );

    // Уволенный ответственный не блокирует сохранение ячеек: клиенты шлют
    // текущего ответственного при каждом сохранении.
    await db.journalDocument.update({ where: { id: hygieneId }, data: { responsibleUserId: U.archivedA.id } });
    const archivedConfig = await db.journalDocument.findUnique({ where: { id: hygieneId }, select: { config: true } });
    const keepArchived = await api.patch(`${BASE}/api/journal-documents/${hygieneId}`, {
      data: { config: archivedConfig?.config ?? {}, responsibleUserId: U.archivedA.id },
    });
    const afterArchived = await db.journalDocument.findUnique({ where: { id: hygieneId }, select: { responsibleUserId: true } });
    check(
      "сохранение с прежним (уволенным) ответственным → 200, ответственный прежний",
      keepArchived.ok() && afterArchived?.responsibleUserId === U.archivedA.id,
      { status: keepArchived.status(), after: afterArchived }
    );
    await db.journalDocument.update({ where: { id: hygieneId }, data: { responsibleUserId: U.cleanerA.id } });

    // ── Страницы документа, Mini App, PDF ─────────────────────────────
    const page = await manager.newPage();
    const settle = () => page.waitForTimeout(2500);
    for (const code of ["hygiene", "finished_product", "perishable_rejection", "disinfectant_usage", "cold_equipment_control"] as const) {
      const id = created[code].auto!;
      await page.goto(`${BASE}/journals/${code}/documents/${id}`, { waitUntil: "load", timeout: 300_000 });
      await settle();
      const html = await page.content();
      check(`${code}: страница документа без «Тест»`, !/ООО\s*["«]Тест/.test(html), null);
      check(`${code}: страница документа без фикстур`, !FIXTURES.test(await page.locator("main").innerText().catch(() => html)), null);
      await page.screenshot({ path: path.join(SHOTS, `site-${code}.png`), fullPage: false });

      const text = await pdfText(api, id);
      check(`${code}: PDF с названием организации и без «Тест»`, text.includes("Альфа") && !/Тест/.test(text), text.slice(0, 200));
    }
    await page.goto(`${BASE}/mini/documents/${created.hygiene.auto}`, { waitUntil: "load", timeout: 300_000 });
    await page.screenshot({ path: path.join(SHOTS, "mini-hygiene.png"), fullPage: false });
    check("Mini App документ без «Тест»", !/ООО\s*["«]Тест/.test(await page.content()), page.url());

    // ── Входной контроль: документ из диалога без строк-образцов ─────
    const incomingBefore = await db.journalDocument.findMany({
      where: { organizationId: state.orgA, template: { code: "incoming_control" } },
      select: { id: true },
    });
    await page.goto(`${BASE}/journals/incoming_control`, { waitUntil: "load", timeout: 300_000 });
    await settle();
    // «Как заполнить?» открывается сам при первом визите журнала — закрываем.
    const fillGuide = page.locator('[role="dialog"][aria-labelledby="fill-guide-title"]');
    if (await fillGuide.isVisible().catch(() => false)) {
      await fillGuide.getByRole("button", { name: "Понятно" }).first().click().catch(() => page.keyboard.press("Escape"));
      await fillGuide.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => null);
    }
    await page.getByRole("button", { name: "Создать документ" }).first().click();
    const createDialog = page.getByRole("dialog");
    await createDialog.waitFor({ timeout: 60_000 });
    await createDialog.getByRole("button", { name: "Создать", exact: true }).click();
    await page.waitForURL(/\/journals\/incoming_control\/documents\//, { timeout: 180_000 }).catch(() => null);
    const incomingCreated = await db.journalDocument.findFirst({
      where: {
        organizationId: state.orgA,
        template: { code: "incoming_control" },
        id: { notIn: incomingBefore.map((doc) => doc.id) },
      },
      select: { id: true, responsibleUserId: true, config: true },
    });
    const incomingConfig = (incomingCreated?.config ?? {}) as { rows?: unknown[]; defaultResponsibleUserId?: string | null };
    check("входной контроль: документ из диалога создан", Boolean(incomingCreated), page.url());
    check(
      "входной контроль: новый документ без строк-образцов",
      Array.isArray(incomingConfig.rows) && incomingConfig.rows.length === 0,
      incomingConfig.rows?.length
    );
    check(
      "входной контроль: ответственный — сотрудник A, не аккаунт «имя = почта»",
      incomingCreated?.responsibleUserId !== U.ownerA.id &&
        incomingConfig.defaultResponsibleUserId !== U.ownerA.id &&
        (incomingCreated?.responsibleUserId == null || [U.managerA.id, U.headA.id, U.cookA.id, U.cleanerA.id].includes(incomingCreated.responsibleUserId)),
      { responsible: incomingCreated?.responsibleUserId, config: incomingConfig.defaultResponsibleUserId }
    );

    // ── Демо-гейт: страницы списков не сеют документы ────────────────
    // pest_control: образцы раньше создавал сам клиент после загрузки.
    const listCodes = ["disinfectant_usage", "sanitary_day_control", "equipment_cleaning", "med_books", "perishable_rejection", "pest_control"];
    const before = await db.journalDocument.count({ where: { organizationId: state.orgA } });
    for (const code of listCodes) {
      await page.goto(`${BASE}/journals/${code}`, { waitUntil: "load", timeout: 300_000 });
      await settle();
    }
    await page.waitForTimeout(5000);
    const after = await db.journalDocument.count({ where: { organizationId: state.orgA } });
    check("страницы журналов реальной организации не создают образцов", before === after, { before, after });

    // ── Настройки ответственных: ROOT и архивных нет ─────────────────
    await page.goto(`${BASE}/settings/journal-responsibles`, { waitUntil: "load", timeout: 300_000 });
    const settingsHtml = await page.content();
    check("настройки ответственных без ROOT и архивных", !settingsHtml.includes(state.root.email) && !settingsHtml.includes("Архивный Сотрудник"), null);
    await page.screenshot({ path: path.join(SHOTS, "settings-journal-responsibles.png"), fullPage: false });

    // ── Пересоздание документов ───────────────────────────────────────
    await db.organization.update({ where: { id: state.orgA }, data: { disabledJournalCodes: [] } });
    const recreate = await api.post(`${BASE}/api/settings/journal-responsibles/recreate-documents`, { timeout: 600_000 });
    check("пересоздание документов → 200", recreate.ok(), await recreate.json().catch(() => recreate.status()));

    // ── Cron автосоздания ─────────────────────────────────────────────
    await db.journalDocument.deleteMany({ where: { organizationId: state.orgA, status: "active", template: { code: { in: [...CODES] } }, title: { not: { startsWith: "E2E" } } } });
    await db.organization.update({ where: { id: state.orgA }, data: { autoJournalCodes: [...CODES] } });
    const cron = await api.get(`${BASE}/api/cron/auto-create-journals?secret=e2e-cron-secret`, { timeout: 600_000 });
    check("cron автосоздания → 200", cron.ok(), await cron.json().catch(() => cron.status()));

    await manager.close();

    // ── ROOT в организации A ─────────────────────────────────────────
    const root = await login(browser, state.root.email);
    const impersonate = await root.request.post(`${BASE}/api/root/impersonate`, { data: { organizationId: state.orgA } });
    check("ROOT входит в организацию A", impersonate.ok(), await impersonate.json().catch(() => null));
    const rootAuto = await createDoc(root.request, { templateCode: "hygiene", title: "E2E ROOT авто" });
    check("ROOT: создание без выбора → 201", rootAuto.status === 201, rootAuto.json);
    check(
      "ROOT: ответственный — сотрудник A, не ROOT",
      rootAuto.json?.document && rootAuto.json.document.responsibleUserId !== state.root.id,
      rootAuto.json?.document?.responsibleUserId
    );
    const rootExplicit = await createDoc(root.request, { templateCode: "perishable_rejection", title: "E2E ROOT явный", responsibleUserId: U.cookA.id });
    check("ROOT: явный ответственный сохранён", rootExplicit.json?.document?.responsibleUserId === U.cookA.id, rootExplicit.json);
    const rootForeign = await createDoc(root.request, { templateCode: "hygiene", title: "E2E ROOT чужой", responsibleUserId: state.root.id });
    check("ROOT: себя ответственным поставить нельзя → 400", rootForeign.status === 400, rootForeign.json);
    await root.close();
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(HERE, "create-docs.json"), JSON.stringify({ created, checks }, null, 2));
  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
