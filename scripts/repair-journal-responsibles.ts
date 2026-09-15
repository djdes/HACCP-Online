/**
 * Ремонт журналов организации: «не те люди» и фикстуры старых дефолтов.
 *
 *   npx tsx scripts/repair-journal-responsibles.ts <email|orgId>            # только отчёт
 *   npx tsx scripts/repair-journal-responsibles.ts <email|orgId> --apply    # исправить
 *   npx tsx scripts/repair-journal-responsibles.ts <email|orgId> --apply --purge-samples
 *
 * Что ищет:
 *   • ответственные и проверяющие документов — из другой организации, ROOT,
 *     уволенные, аккаунт-заглушка «имя = почта» (если есть живые сотрудники);
 *   • ссылки на таких людей в конфиге документа и в слотах «Ответственные
 *     за журналы»;
 *   • записи журнала (`JournalDocumentEntry.employeeId`) на таких людей;
 *   • фикстуры старых дефолтов в конфиге: «Ромашка», «Бубнов», «Пельмени»,
 *     приходы «Ph средства», стоковые холодильники, имена в пустой строке
 *     бракеража;
 *   • документы-образцы, насеянные в реальную организацию (пара «активный +
 *     закрытый» без данных).
 *
 * Что делает `--apply` (и только это):
 *   • ответственного / проверяющего заменяет по тем же правилам, что при
 *     создании документа: сохранённый слот «Ответственные за журналы», если
 *     он жив, иначе подбор по ростеру, иначе пусто. Каскад на ВСЕ документы
 *     журнала не запускается — исправные документы не трогаем;
 *   • обнуляет плохие ссылки в конфиге и в слотах организации;
 *   • убирает фикстуры, которые не используются в строках документа;
 *   • удаляет пустые авто-сид-записи на чужих людей (данные с отметками
 *     не трогает — их показывает отчёт для ручного решения).
 * Документы удаляет только `--purge-samples`, и только образцы без данных.
 *
 * Базу берёт из DATABASE_URL_DIRECT || DATABASE_URL. Перед `--apply` на
 * проде — бэкап: pg_dump -t '"JournalDocument"' -t '"JournalDocumentEntry"'.
 */
import { db } from "../src/lib/db";
import { getPrimarySlotId, getSchemaForJournal, getVerifierSlotId } from "../src/lib/journal-responsible-schemas";
import { isPlaceholderStaffUser, rankRosterForSlot, type RosterUser } from "../src/lib/journal-roster";
import {
  classifyUserRef,
  detectConfigFixtures,
  stripBadConfigUserRefs,
  USER_REF_PROBLEM_LABELS,
  type RepairUser,
  type UserRefProblem,
} from "../src/lib/journal-repair";
import { isAutoSeededEntry } from "../src/lib/journal-entry-filters";

type Row = { документ: string; журнал: string; поле: string; проблема: string; действие: string };

function parseArgs() {
  const args = process.argv.slice(2);
  const target = args.find((arg) => !arg.startsWith("--"));
  return {
    target,
    apply: args.includes("--apply"),
    purgeSamples: args.includes("--purge-samples"),
  };
}

function short(id: string) {
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

function collectStrings(value: unknown, out: Set<string>, depth = 0) {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    const text = value.trim();
    if (text) out.add(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out, depth + 1);
    }
  }
}

async function resolveOrganizationId(target: string): Promise<string> {
  if (target.includes("@")) {
    const user = await db.user.findFirst({
      where: { email: { equals: target, mode: "insensitive" } },
      select: { organizationId: true },
    });
    if (!user) throw new Error(`Нет пользователя с почтой ${target}`);
    return user.organizationId;
  }
  return target;
}

async function main() {
  const { target, apply, purgeSamples } = parseArgs();
  if (!target) {
    console.error("Использование: npx tsx scripts/repair-journal-responsibles.ts <email|orgId> [--apply] [--purge-samples]");
    process.exit(1);
  }

  const organizationId = await resolveOrganizationId(target);
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, isDemo: true, journalResponsibleUsersJson: true },
  });
  if (!org) throw new Error(`Нет организации ${organizationId}`);

  console.log("═".repeat(78));
  console.log(`Организация: ${org.name} (${org.id})${org.isDemo ? " — ДЕМО" : ""}`);
  console.log(`Режим: ${apply ? "ИСПРАВЛЕНИЕ" : "только отчёт (dry-run)"}${purgeSamples ? " + удаление образцов" : ""}`);
  console.log("═".repeat(78));

  const documents = await db.journalDocument.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      config: true,
      responsibleUserId: true,
      responsibleTitle: true,
      verifierUserId: true,
      template: { select: { code: true, name: true } },
      entries: { select: { id: true, employeeId: true, data: true } },
    },
    orderBy: [{ template: { code: "asc" } }, { dateFrom: "asc" }],
  });

  // Все люди, на которых ссылаются документы, записи и слоты, + ростер.
  const slotMap = (org.journalResponsibleUsersJson ?? {}) as Record<string, Record<string, string | null>>;
  const referencedIds = new Set<string>();
  for (const doc of documents) {
    if (doc.responsibleUserId) referencedIds.add(doc.responsibleUserId);
    if (doc.verifierUserId) referencedIds.add(doc.verifierUserId);
    for (const entry of doc.entries) referencedIds.add(entry.employeeId);
    const config = doc.config as Record<string, unknown> | null;
    if (config && typeof config === "object") {
      for (const value of Object.values(config)) {
        if (typeof value === "string" && value.length >= 20) referencedIds.add(value);
      }
    }
  }
  for (const slots of Object.values(slotMap)) {
    for (const userId of Object.values(slots ?? {})) if (userId) referencedIds.add(userId);
  }

  const users = await db.user.findMany({
    where: { OR: [{ organizationId: org.id }, { id: { in: [...referencedIds] } }] },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      isActive: true,
      archivedAt: true,
      isRoot: true,
      positionTitle: true,
      jobPosition: { select: { name: true, categoryKey: true } },
    },
  });
  const usersById = new Map<string, RepairUser & (typeof users)[number]>(users.map((user) => [user.id, user]));
  const roster: RosterUser[] = users
    .filter((user) => user.organizationId === org.id && user.isActive && !user.archivedAt && !user.isRoot)
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isRoot: user.isRoot,
      positionTitle: user.positionTitle,
      jobPositionName: user.jobPosition?.name ?? null,
      jobPositionCategory: user.jobPosition?.categoryKey ?? null,
    }));
  const hasRealStaff = roster.some((user) => !isPlaceholderStaffUser(user));
  const problemOf = (userId: string | null | undefined): UserRefProblem | null =>
    classifyUserRef(userId, org.id, usersById, hasRealStaff);
  const isValidRosterUser = (userId: string | null | undefined) =>
    Boolean(userId) && roster.some((user) => user.id === userId) && problemOf(userId) === null;
  const labelOf = (userId: string) => {
    const user = usersById.get(userId);
    return user ? `${user.name} <${user.email}>` : short(userId);
  };
  const titleOf = (userId: string) => {
    const user = usersById.get(userId);
    return user?.jobPosition?.name || user?.positionTitle || null;
  };

  const coldEquipment = await db.equipment.findMany({
    where: { area: { organizationId: org.id } },
    select: { id: true, name: true, type: true, tempMin: true, tempMax: true },
  });
  const orgColdEquipment = coldEquipment
    .filter((item) => item.type === "refrigerator" || item.type === "freezer" || item.tempMin != null || item.tempMax != null)
    .map((item) => ({ sourceEquipmentId: item.id, name: item.name, min: item.tempMin, max: item.tempMax }));

  const report: Row[] = [];
  const counters = {
    documentsChecked: documents.length,
    responsibleFixed: 0,
    verifierFixed: 0,
    configRefsCleared: 0,
    fixturesCleaned: 0,
    seedEntriesDeleted: 0,
    entriesNeedManual: 0,
    slotsCleared: 0,
    samplesFound: 0,
    samplesDeleted: 0,
  };

  // ─── Слоты «Ответственные за журналы» ─────────────────────────────────
  const nextSlotMap: Record<string, Record<string, string | null>> = JSON.parse(JSON.stringify(slotMap));
  for (const [code, slots] of Object.entries(slotMap)) {
    for (const [slotId, userId] of Object.entries(slots ?? {})) {
      const problem = problemOf(userId);
      if (!problem || problem === "placeholder") continue;
      report.push({
        документ: "— настройки —",
        журнал: code,
        поле: `слот ${slotId}`,
        проблема: `${labelOf(userId!)}: ${USER_REF_PROBLEM_LABELS[problem]}`,
        действие: "очистить слот",
      });
      nextSlotMap[code][slotId] = null;
      counters.slotsCleared += 1;
    }
  }

  function replacementFor(code: string, kind: "filler" | "verifier"): string | null {
    const slotId = kind === "verifier" ? getVerifierSlotId(code) : getPrimarySlotId(code);
    const saved = nextSlotMap[code]?.[slotId];
    if (saved && isValidRosterUser(saved)) return saved;
    const schemaSlot = getSchemaForJournal(code).slots.find((slot) => slot.id === slotId);
    return rankRosterForSlot(roster, { kind, positionKeywords: schemaSlot?.positionKeywords })?.id ?? null;
  }

  // ─── Документы ────────────────────────────────────────────────────────
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const seedEntryIdsToDelete: string[] = [];

  for (const doc of documents) {
    const code = doc.template.code;
    const docLabel = `${doc.title} [${doc.status}] ${short(doc.id)}`;
    const data: Record<string, unknown> = {};

    const responsibleProblem = problemOf(doc.responsibleUserId);
    if (responsibleProblem) {
      const next = replacementFor(code, "filler");
      report.push({
        документ: docLabel,
        журнал: code,
        поле: "ответственный",
        проблема: `${labelOf(doc.responsibleUserId!)}: ${USER_REF_PROBLEM_LABELS[responsibleProblem]}`,
        действие: next ? `→ ${labelOf(next)}` : "→ не назначен",
      });
      data.responsibleUserId = next;
      data.responsibleTitle = next ? titleOf(next) ?? doc.responsibleTitle : doc.responsibleTitle;
      counters.responsibleFixed += 1;
    }

    const verifierProblem = problemOf(doc.verifierUserId);
    if (verifierProblem) {
      const next = replacementFor(code, "verifier");
      report.push({
        документ: docLabel,
        журнал: code,
        поле: "проверяющий",
        проблема: `${labelOf(doc.verifierUserId!)}: ${USER_REF_PROBLEM_LABELS[verifierProblem]}`,
        действие: next ? `→ ${labelOf(next)}` : "→ не назначен",
      });
      data.verifierUserId = next;
      counters.verifierFixed += 1;
    }

    let config: unknown = doc.config;
    const stripped = stripBadConfigUserRefs(config, (userId) => {
      const problem = problemOf(userId);
      return problem !== null && problem !== "placeholder";
    });
    if (stripped.config) {
      report.push({
        документ: docLabel,
        журнал: code,
        поле: "конфиг",
        проблема: `чужие ссылки: ${stripped.removed.join(", ")}`,
        действие: "обнулить",
      });
      config = stripped.config;
      counters.configRefsCleared += stripped.removed.length;
    }

    const usedValues = new Set<string>();
    const configRecord = config as Record<string, unknown> | null;
    if (configRecord && Array.isArray(configRecord.rows)) collectStrings(configRecord.rows, usedValues);
    const equipmentIdsWithReadings = new Set<string>();
    for (const entry of doc.entries) {
      const temperatures = (entry.data as { temperatures?: Record<string, unknown> } | null)?.temperatures;
      if (temperatures && typeof temperatures === "object") {
        for (const [equipmentId, value] of Object.entries(temperatures)) {
          if (value !== null && value !== undefined && value !== "") equipmentIdsWithReadings.add(equipmentId);
        }
      }
    }
    const fixtures = detectConfigFixtures(code, config, {
      usedValues,
      equipmentIdsWithReadings,
      orgColdEquipment,
    });
    if (fixtures.findings.length > 0) {
      report.push({
        документ: docLabel,
        журнал: code,
        поле: "конфиг",
        проблема: `фикстуры: ${fixtures.findings.join("; ")}`,
        действие: fixtures.config ? "убрать" : "оставить (есть данные)",
      });
      if (fixtures.config) {
        config = fixtures.config;
        counters.fixturesCleaned += 1;
      }
    }
    if (config !== doc.config) data.config = config;

    for (const entry of doc.entries) {
      const problem = problemOf(entry.employeeId);
      if (!problem || problem === "placeholder" || problem === "archived") continue;
      if (isAutoSeededEntry(entry.data)) {
        seedEntryIdsToDelete.push(entry.id);
      } else {
        counters.entriesNeedManual += 1;
        report.push({
          документ: docLabel,
          журнал: code,
          поле: "запись",
          проблема: `${labelOf(entry.employeeId)}: ${USER_REF_PROBLEM_LABELS[problem]}`,
          действие: "вручную (в записи есть данные)",
        });
      }
    }

    if (Object.keys(data).length > 0) updates.push({ id: doc.id, data });
  }
  counters.seedEntriesDeleted = seedEntryIdsToDelete.length;

  // ─── Документы-образцы ────────────────────────────────────────────────
  // Пара «активный + закрытый» одного журнала с одинаковым названием,
  // созданная сеятелем в один момент, без записей и без строк в конфиге.
  const sampleIds: string[] = [];
  const byTemplate = new Map<string, typeof documents>();
  for (const doc of documents) {
    const list = byTemplate.get(doc.template.code) ?? [];
    list.push(doc);
    byTemplate.set(doc.template.code, list);
  }
  const isEmptyDocument = (doc: (typeof documents)[number]) => {
    const realEntries = doc.entries.filter((entry) => !isAutoSeededEntry(entry.data));
    const config = doc.config as Record<string, unknown> | null;
    const rows = config && Array.isArray(config.rows) ? config.rows.length : 0;
    const receipts = config && Array.isArray(config.receipts)
      ? (config.receipts as Array<{ id?: string }>).filter((row) => !["rec-1", "rec-2"].includes(String(row.id))).length
      : 0;
    return realEntries.length === 0 && rows === 0 && receipts === 0;
  };
  if (!org.isDemo) {
    for (const docs of byTemplate.values()) {
      for (const active of docs.filter((doc) => doc.status === "active")) {
        const twin = docs.find(
          (doc) =>
            doc.status === "closed" &&
            doc.title === active.title &&
            Math.abs(doc.createdAt.getTime() - active.createdAt.getTime()) < 10_000
        );
        if (!twin || !isEmptyDocument(active) || !isEmptyDocument(twin)) continue;
        for (const doc of [active, twin]) {
          if (sampleIds.includes(doc.id)) continue;
          sampleIds.push(doc.id);
          report.push({
            документ: `${doc.title} [${doc.status}] ${short(doc.id)}`,
            журнал: doc.template.code,
            поле: "документ",
            проблема: "похоже на образец, насеянный страницей журнала (пустая пара)",
            действие: purgeSamples ? "удалить" : "оставить (нужен --purge-samples)",
          });
        }
      }
    }
  }
  counters.samplesFound = sampleIds.length;

  // ─── Отчёт ────────────────────────────────────────────────────────────
  if (report.length === 0) {
    console.log("\nПроблем не найдено.");
  } else {
    console.log("");
    console.table(report);
  }

  if (apply) {
    for (const update of updates) {
      await db.journalDocument.update({ where: { id: update.id }, data: update.data as never });
    }
    if (seedEntryIdsToDelete.length > 0) {
      await db.journalDocumentEntry.deleteMany({ where: { id: { in: seedEntryIdsToDelete } } });
    }
    if (counters.slotsCleared > 0) {
      await db.organization.update({
        where: { id: org.id },
        data: { journalResponsibleUsersJson: nextSlotMap as never },
      });
    }
    if (purgeSamples && sampleIds.length > 0) {
      const deleted = await db.journalDocument.deleteMany({
        where: { id: { in: sampleIds }, organizationId: org.id },
      });
      counters.samplesDeleted = deleted.count;
    }
  }

  console.log(apply ? "\nИсправлено:" : "\nНайдено (исправится при --apply):");
  for (const [key, value] of Object.entries(counters)) console.log(`  ${key}: ${value}`);
  if (!apply && report.length > 0) {
    console.log("\nЭто отчёт. Чтобы исправить: добавьте --apply (сначала сделайте бэкап).");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
