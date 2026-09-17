// e2e staff-autofill-today-2026-09: «Здоровье» и «Гигиенический» не заполняются наперёд.
// Запуск (dev на 3020 с wesetup_e2e, после setup-db.ts Задачи 1):
//   npx tsx .agent/tasks/staff-autofill-today-2026-09/e2e/autofill-today.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type APIRequestContext, type Browser, type BrowserContext } from "playwright";

import { db, E2E_DATABASE_URL } from "../../journal-responsibles-org-2026-09/e2e/db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const T1 = path.join(HERE, "..", "..", "journal-responsibles-org-2026-09", "e2e");
const state = JSON.parse(fs.readFileSync(path.join(T1, "state.json"), "utf8"));
const U = state.users as Record<string, { id: string; email: string }>;
const ORG_A = state.orgA as string;

const TODAY = new Date().toISOString().slice(0, 10);

type Check = { name: string; ok: boolean; detail?: unknown };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 500)}` : ""}`);
}

async function login(browser: Browser, email: string): Promise<BrowserContext> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
  await page.fill("#email", email);
  await page.fill("#password", state.password);
  await page.waitForLoadState("networkidle").catch(() => null);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.click('button[type="submit"]').catch(() => null);
    const left = await page
      .waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (left) break;
    if (attempt === 2) throw new Error("login: форма не отправилась");
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
    await page.fill("#email", email);
    await page.fill("#password", state.password);
    await page.waitForTimeout(1500);
  }
  await page.close();
  return context;
}

function monthBounds() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { dateFrom: `${y}-${pad(m + 1)}-01`, dateTo: `${y}-${pad(m + 1)}-${pad(last)}`, futureDays: last - now.getUTCDate() };
}

async function createDoc(api: APIRequestContext, templateCode: string, title: string): Promise<string> {
  const response = await api.post(`${BASE}/api/journal-documents`, {
    data: { ...monthBounds(), force: true, templateCode, title },
    timeout: 180_000,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok() || !json?.document?.id) throw new Error(`create ${templateCode}: ${response.status()} ${JSON.stringify(json)}`);
  return json.document.id as string;
}

type Stat = { total: number; pastFilled: number; pastEmpty: number; futureFilled: number; futureEmpty: number };

/** Сводка по ячейкам сотрудника: заполнена ли ячейка и в какой половине периода она лежит. */
async function stats(documentId: string, employeeId?: string): Promise<Stat> {
  const entries = await db.journalDocumentEntry.findMany({
    where: { documentId, ...(employeeId ? { employeeId } : {}) },
    select: { date: true, data: true },
  });
  const stat: Stat = { total: entries.length, pastFilled: 0, pastEmpty: 0, futureFilled: 0, futureEmpty: 0 };
  for (const entry of entries) {
    const key = entry.date.toISOString().slice(0, 10);
    const data = (entry.data ?? {}) as Record<string, unknown>;
    const filled = Object.keys(data).some((k) => k !== "_autoSeeded");
    if (key > TODAY) filled ? (stat.futureFilled += 1) : (stat.futureEmpty += 1);
    else filled ? (stat.pastFilled += 1) : (stat.pastEmpty += 1);
  }
  return stat;
}

async function main() {
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DATABASE_URL_DIRECT = E2E_DATABASE_URL;
  const { futureDays } = monthBounds();
  const browser = await chromium.launch({ headless: true });
  const created: string[] = [];
  try {
    const manager = await login(browser, U.managerA.email);
    const api = manager.request;
    const staff = (id: string, body: Record<string, unknown>) =>
      api.post(`${BASE}/api/journal-documents/${id}/staff`, { data: body, timeout: 180_000 });

    for (const [code, title] of [
      ["hygiene", "E2E автозаполнение гигиена"],
      ["health_check", "E2E автозаполнение здоровье"],
    ] as const) {
      const id = await createDoc(api, code, title);
      created.push(id);
      // Чистый документ: без строк, тумблер автозаполнения включён.
      await db.journalDocumentEntry.deleteMany({ where: { documentId: id } });
      const toggled = await api.patch(`${BASE}/api/journal-documents/${id}`, { data: { autoFill: true } });
      check(`${code}: тумблер автозаполнения включён`, toggled.ok(), toggled.status());

      // Добавление одного сотрудника.
      const add = await staff(id, { action: "add_employee", employeeId: U.cookA.id });
      const addJson = await add.json().catch(() => null);
      const one = await stats(id, U.cookA.id);
      check(
        `${code}: добавление сотрудника — строки на весь период, будущие дни пустые (${futureDays} дн.)`,
        add.ok() && one.total > 0 && one.futureFilled === 0 && one.futureEmpty === futureDays,
        { status: add.status(), addJson, one }
      );
      check(`${code}: добавление сотрудника — дни до сегодня включительно заполнены`, one.pastFilled > 0 && one.pastEmpty === 0, one);
      check(`${code}: ответ содержит created и filled`, typeof addJson?.created === "number" && addJson?.filled === one.pastFilled, addJson);

      // «Заполнить всех из списка».
      const all = await staff(id, { action: "fill_from_list", category: "all" });
      const allStat = await stats(id);
      check(`${code}: «заполнить всех» — будущих заполненных ячеек нет, прошлые заполнены`, all.ok() && allStat.futureFilled === 0 && allStat.pastEmpty === 0 && allStat.pastFilled > one.pastFilled, allStat);

      // Тумблер: apply_auto_fill на документе с пустыми ячейками.
      await db.journalDocumentEntry.updateMany({ where: { documentId: id }, data: { data: {} } });
      const apply = await staff(id, { action: "apply_auto_fill" });
      const applyStat = await stats(id);
      check(`${code}: включение тумблера заполняет только до сегодня`, apply.ok() && applyStat.futureFilled === 0 && applyStat.pastEmpty === 0 && applyStat.pastFilled > 0, { status: apply.status(), applyStat });

      // Cron: только сегодняшний день, будущее не трогает.
      await db.journalDocumentEntry.updateMany({ where: { documentId: id }, data: { data: {} } });
      const cron = await api.get(`${BASE}/api/cron/auto-fill-journals`, {
        headers: { authorization: "Bearer e2e-cron-secret" },
        timeout: 300_000,
      });
      const cronStat = await stats(id);
      const todayEntries = await db.journalDocumentEntry.count({
        where: { documentId: id, date: new Date(`${TODAY}T00:00:00.000Z`), NOT: { data: { equals: {} } } },
      });
      check(`${code}: cron заполнил сегодня и не тронул будущее`, cron.ok() && cronStat.futureFilled === 0 && todayEntries > 0, { status: cron.status(), cronStat, todayEntries });

      // График: у повара сегодня выходной → гигиена ставит «выходной», здоровье оставляет ячейку пустой.
      const cookBefore = await db.user.findUnique({ where: { id: U.cookA.id }, select: { weeklyDaysOff: true } });
      const todayIdx = (new Date(`${TODAY}T00:00:00.000Z`).getUTCDay() + 6) % 7;
      await db.user.update({ where: { id: U.cookA.id }, data: { weeklyDaysOff: [todayIdx] } });
      await db.journalDocumentEntry.updateMany({ where: { documentId: id }, data: { data: {} } });
      const dayOff = await staff(id, { action: "apply_auto_fill" });
      const cookToday = await db.journalDocumentEntry.findFirst({ where: { documentId: id, employeeId: U.cookA.id, date: new Date(`${TODAY}T00:00:00.000Z`) }, select: { data: true } });
      const otherToday = await db.journalDocumentEntry.count({ where: { documentId: id, date: new Date(`${TODAY}T00:00:00.000Z`), NOT: { employeeId: U.cookA.id }, AND: { NOT: { data: { equals: {} } } } } });
      const cookData = (cookToday?.data ?? {}) as Record<string, unknown>;
      check(
        `${code}: выходной по графику — ${code === "hygiene" ? "статус «выходной»" : "ячейка пустая"}, остальные заполнены`,
        dayOff.ok() && (code === "hygiene" ? cookData.status === "day_off" : Object.keys(cookData).length === 0) && otherToday > 0,
        { status: dayOff.status(), cookData, otherToday }
      );
      await db.user.update({ where: { id: U.cookA.id }, data: { weeklyDaysOff: cookBefore?.weeklyDaysOff ?? [] } });
    }

    // Права: повар не может добавлять сотрудников.
    const cook = await login(browser, U.cookA.email);
    const forbidden = await cook.request.post(`${BASE}/api/journal-documents/${created[0]}/staff`, {
      data: { action: "add_employee", employeeId: U.cookA.id },
    });
    check("повар: добавление сотрудника → 403", forbidden.status() === 403, forbidden.status());
    await cook.close();
    await manager.close();
  } catch (error) {
    console.error("E2E ERROR", error);
    checks.push({ name: "e2e без исключений", ok: false, detail: String(error).slice(0, 800) });
  } finally {
    await browser.close();
    for (const id of created) await db.journalDocument.delete({ where: { id } }).catch(() => null);
    const passed = checks.filter((item) => item.ok).length;
    fs.writeFileSync(path.join(HERE, "autofill-today.json"), JSON.stringify(checks, null, 2));
    console.log(`\n${passed}/${checks.length} PASS`);
    await db.$disconnect();
    process.exit(passed === checks.length ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
