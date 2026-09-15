// e2e Задачи 1: проверка базы после create-docs.ts (включая cron и
// пересоздание), чужой сотрудник в TasksFlow-адаптерах, скрипт ремонта.
// Запуск: npx tsx .agent/tasks/journal-responsibles-org-2026-09/e2e/verify-docs.ts
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { db, E2E_DATABASE_URL } from "./db";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const state = JSON.parse(fs.readFileSync(path.join(HERE, "state.json"), "utf8"));
const U = state.users as Record<string, { id: string; email: string; name: string }>;
const FIXTURES = /Ромашка|Бубнов|Пельмени|2023-12-01|2025-02-13|Ph средство|cold-equipment-default-/;

type Check = { name: string; ok: boolean; detail?: unknown };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 600)}` : ""}`);
}

async function main() {
  const orgA = state.orgA as string;
  const roster = new Set([U.managerA.id, U.headA.id, U.cookA.id, U.cleanerA.id, U.ownerA.id]);
  const realStaff = new Set([U.managerA.id, U.headA.id, U.cookA.id, U.cleanerA.id]);

  const docs = await db.journalDocument.findMany({
    where: { organizationId: orgA },
    select: {
      id: true,
      title: true,
      status: true,
      responsibleUserId: true,
      verifierUserId: true,
      config: true,
      template: { select: { code: true } },
      entries: { select: { employeeId: true } },
    },
  });
  check("в организации A есть документы (создание + пересоздание + cron)", docs.length > 30, docs.length);

  const badResponsible = docs.filter((doc) => doc.responsibleUserId && !roster.has(doc.responsibleUserId));
  check("ответственные всех документов — сотрудники A", badResponsible.length === 0, badResponsible.map((doc) => [doc.template.code, doc.title, doc.responsibleUserId]));
  const placeholderResponsible = docs.filter((doc) => doc.responsibleUserId === U.ownerA.id);
  check("аккаунт «имя = почта» не стал ответственным ни одного документа", placeholderResponsible.length === 0, placeholderResponsible.map((doc) => [doc.template.code, doc.title]));
  const badVerifier = docs.filter((doc) => doc.verifierUserId && !realStaff.has(doc.verifierUserId));
  check("проверяющие — живые сотрудники A (не ROOT, не заглушка)", badVerifier.length === 0, badVerifier.map((doc) => [doc.template.code, doc.verifierUserId]));
  const badEntries = docs.flatMap((doc) => doc.entries.filter((entry) => !roster.has(entry.employeeId)).map((entry) => [doc.template.code, entry.employeeId]));
  check("записи журналов — только на сотрудников A", badEntries.length === 0, badEntries);
  const withFixtures = docs.filter((doc) => FIXTURES.test(JSON.stringify(doc.config ?? {})));
  check("в конфигах документов A нет фикстур", withFixtures.length === 0, withFixtures.map((doc) => [doc.template.code, doc.title]));
  const recreated = docs.filter((doc) => !doc.title.startsWith("E2E"));
  check("пересоздание/cron создали документы без «E2E» в названии", recreated.length > 0, recreated.length);

  // ── TasksFlow: сотрудник другой организации в rowKey ─────────────────
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  process.env.DATABASE_URL_DIRECT = E2E_DATABASE_URL;
  const { hygieneAdapter } = await import("../../../../src/lib/tasksflow-adapters/hygiene");
  const { perishableRejectionAdapter } = await import("../../../../src/lib/tasksflow-adapters/perishable-rejection");
  const hygieneDoc = docs.find((doc) => doc.template.code === "hygiene" && doc.status === "active")!;
  const perishableDoc = docs.find((doc) => doc.template.code === "perishable_rejection" && doc.status === "active")!;
  const todayKey = new Date().toISOString().slice(0, 10);
  const foreignHygiene = await hygieneAdapter.applyRemoteCompletion({
    documentId: hygieneDoc.id,
    rowKey: `employee-${U.cookB.id}`,
    completed: true,
    todayKey,
    values: { status: "healthy" },
  });
  check("hygiene: applyRemoteCompletion с сотрудником B → false", foreignHygiene === false, foreignHygiene);
  const foreignPerishable = await perishableRejectionAdapter.applyRemoteCompletion({
    documentId: perishableDoc.id,
    rowKey: `employee-${U.cookB.id}`,
    completed: true,
    todayKey,
    values: { productName: "Сметана" },
  });
  check("perishable: applyRemoteCompletion с сотрудником B → false", foreignPerishable === false, foreignPerishable);
  const ownHygiene = await hygieneAdapter.applyRemoteCompletion({
    documentId: hygieneDoc.id,
    rowKey: `employee-${U.cookA.id}`,
    completed: true,
    todayKey,
    values: { status: "healthy" },
  });
  check("hygiene: applyRemoteCompletion со своим сотрудником → true", ownHygiene === true, ownHygiene);
  const foreignEntry = await db.journalDocumentEntry.count({ where: { documentId: hygieneDoc.id, employeeId: U.cookB.id } });
  check("hygiene: запись на сотрудника B не создана", foreignEntry === 0, foreignEntry);

  // Общий адаптер (журналы без своего адаптера) и журнал жалоб: id из
  // rowKey тоже сверяется с организацией документа.
  const { getAdapter } = await import("../../../../src/lib/tasksflow-adapters/index");
  for (const code of ["med_books", "fryer_oil", "complaint_register"] as const) {
    const template = await db.journalTemplate.findUnique({ where: { code }, select: { id: true } });
    if (!template) {
      check(`${code}: шаблон есть в базе`, false, code);
      continue;
    }
    const existing = docs.find((doc) => doc.template.code === code && doc.status === "active");
    const documentId =
      existing?.id ??
      (
        await db.journalDocument.create({
          data: {
            organizationId: orgA,
            templateId: template.id,
            title: `E2E TF ${code}`,
            dateFrom: new Date(`${todayKey}T00:00:00.000Z`),
            dateTo: new Date(`${todayKey}T00:00:00.000Z`),
            status: "active",
            config: {},
          },
          select: { id: true },
        })
      ).id;
    const before = await db.journalDocument.findUnique({ where: { id: documentId }, select: { config: true } });
    const adapter = getAdapter(code)!;
    const foreign = await adapter.applyRemoteCompletion({
      documentId,
      rowKey: `employee-${U.cookB.id}`,
      completed: true,
      todayKey,
      values: { comment: "чужой сотрудник", applicantName: "Иванов" },
    });
    const foreignEntries = await db.journalDocumentEntry.count({ where: { documentId, employeeId: U.cookB.id } });
    const after = await db.journalDocument.findUnique({ where: { id: documentId }, select: { config: true } });
    check(
      `${code}: applyRemoteCompletion с сотрудником B → false, ничего не записано`,
      foreign === false && foreignEntries === 0 && JSON.stringify(before?.config) === JSON.stringify(after?.config),
      { foreign, foreignEntries }
    );
  }

  // ── Скрипт ремонта на испорченных данных ─────────────────────────────
  const template = await db.journalTemplate.findUniqueOrThrow({ where: { code: "perishable_rejection" } });
  const coldTemplate = await db.journalTemplate.findUniqueOrThrow({ where: { code: "cold_equipment_control" } });
  const disinfectantTemplate = await db.journalTemplate.findUniqueOrThrow({ where: { code: "disinfectant_usage" } });
  const now = new Date();
  const broken = await db.journalDocument.create({
    data: {
      organizationId: orgA,
      templateId: template.id,
      title: "REPAIR сломанный скоропорт",
      dateFrom: now,
      dateTo: now,
      responsibleUserId: U.cookB.id,
      verifierUserId: state.root.id,
      config: {
        rows: [],
        productLists: [{ id: "l1", name: "Изделия", items: ["Пельмени", "Сметана 20 %"] }],
        manufacturers: ['ООО "Ромашка"'],
        suppliers: ["ИП Бубнов Б.Б."],
        showNote: true,
        defaultResponsibleUserId: U.managerB.id,
      },
    },
  });
  const brokenCold = await db.journalDocument.create({
    data: {
      organizationId: orgA,
      templateId: coldTemplate.id,
      title: "REPAIR стоковые холодильники",
      dateFrom: now,
      dateTo: now,
      responsibleUserId: U.ownerA.id,
      config: {
        equipment: [
          { id: "cold-equipment-default-0", sourceEquipmentId: null, name: "Холодильная камера", min: 2, max: 4 },
          { id: "cold-equipment-default-1", sourceEquipmentId: null, name: "Морозильный ларь", min: -20, max: -18 },
        ],
        skipWeekends: false,
      },
    },
  });
  const sampleActive = await db.journalDocument.create({
    data: { organizationId: orgA, templateId: disinfectantTemplate.id, title: "Образец дезсредств", status: "active", dateFrom: now, dateTo: now, config: {} },
  });
  const sampleClosed = await db.journalDocument.create({
    data: { organizationId: orgA, templateId: disinfectantTemplate.id, title: "Образец дезсредств", status: "closed", dateFrom: now, dateTo: now, config: {} },
  });
  await db.journalDocumentEntry.create({
    data: { documentId: broken.id, employeeId: U.cookB.id, date: now, data: { _autoSeeded: true } },
  });

  const script = path.join(process.cwd(), "scripts", "repair-journal-responsibles.ts");
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DATABASE_URL_DIRECT: E2E_DATABASE_URL, NODE_ENV: "test" };
  const run = (args: string[]) =>
    execFileSync(process.execPath, ["--import", "tsx", script, orgA, ...args], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  const dryRun = run([]);
  fs.writeFileSync(path.join(HERE, "..", "raw", "repair-dry-run.txt"), dryRun);
  check("ремонт dry-run: видит чужого ответственного", dryRun.includes("REPAIR сломанный скоропорт") && dryRun.includes("из другой организации"), null);
  check("ремонт dry-run: видит ROOT-проверяющего", dryRun.includes("ROOT"), null);
  check("ремонт dry-run: видит фикстуры и стоковые холодильники", dryRun.includes("Ромашка") && dryRun.includes("стоковые холодильники"), null);
  check("ремонт dry-run: видит пару-образец", dryRun.includes("похоже на образец"), null);
  const untouched = await db.journalDocument.findUnique({ where: { id: broken.id }, select: { responsibleUserId: true } });
  check("ремонт dry-run ничего не меняет", untouched?.responsibleUserId === U.cookB.id, untouched);

  const applied = run(["--apply", "--purge-samples"]);
  fs.writeFileSync(path.join(HERE, "..", "raw", "repair-apply.txt"), applied);
  const fixed = await db.journalDocument.findUnique({ where: { id: broken.id }, select: { responsibleUserId: true, verifierUserId: true, config: true } });
  check("ремонт --apply: ответственный — сотрудник A", Boolean(fixed?.responsibleUserId && roster.has(fixed.responsibleUserId) && fixed.responsibleUserId !== U.ownerA.id), fixed?.responsibleUserId);
  check("ремонт --apply: проверяющий — не ROOT", fixed?.verifierUserId !== state.root.id && (!fixed?.verifierUserId || realStaff.has(fixed.verifierUserId)), fixed?.verifierUserId);
  const fixedConfig = JSON.stringify(fixed?.config ?? {});
  check("ремонт --apply: фикстуры убраны, данные организации оставлены", !/Ромашка|Бубнов|Пельмени/.test(fixedConfig) && fixedConfig.includes("Сметана 20 %"), fixedConfig);
  check("ремонт --apply: чужая ссылка в конфиге обнулена", !fixedConfig.includes(U.managerB.id), fixedConfig);
  const coldFixed = await db.journalDocument.findUnique({ where: { id: brokenCold.id }, select: { responsibleUserId: true, config: true } });
  check("ремонт --apply: заглушка «имя = почта» заменена", coldFixed?.responsibleUserId !== U.ownerA.id && Boolean(coldFixed?.responsibleUserId), coldFixed?.responsibleUserId);
  check("ремонт --apply: стоковые холодильники убраны", !JSON.stringify(coldFixed?.config).includes("cold-equipment-default-"), coldFixed?.config);
  const seedLeft = await db.journalDocumentEntry.count({ where: { documentId: broken.id, employeeId: U.cookB.id } });
  check("ремонт --apply: пустая авто-запись на чужого удалена", seedLeft === 0, seedLeft);
  const samplesLeft = await db.journalDocument.count({ where: { id: { in: [sampleActive.id, sampleClosed.id] } } });
  check("ремонт --purge-samples: пара-образец удалена", samplesLeft === 0, samplesLeft);

  const rerun = run([]);
  fs.writeFileSync(path.join(HERE, "..", "raw", "repair-rerun.txt"), rerun);
  check("ремонт повторно: проблем по исправленным документам нет", !rerun.includes("REPAIR сломанный скоропорт") && !rerun.includes("REPAIR стоковые"), null);

  fs.writeFileSync(path.join(HERE, "verify-docs.json"), JSON.stringify({ checks }, null, 2));
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
