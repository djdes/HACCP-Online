/**
 * C6 аудита журналов — одноразовая идемпотентная чистка `config.rooms`
 * в документах журнала уборки.
 *
 * ЗАЧЕМ. Помещения уборки живут в таблице `Room` (/settings/buildings),
 * но создание документа до правки C1 сеяло четыре blueprint-строки
 * («гостевая зона», «помещение мойки», «горячий цех/кухня», «Бар»).
 * Клиент рисует ОБЪЕДИНЕНИЕ `config.rooms ∪ Room`, поэтому в матрице
 * появлялись дубли: «Горячий цех/кухня» (blueprint) рядом с реальным
 * «Горячий цех» из Buildings. План Т/Г при этом проставлялся
 * blueprint-строкам, а справочник шагов уборки печатался пустым.
 *
 * ЧТО ДЕЛАЕТ. Для каждой организации, у которой есть хотя бы один Room,
 * находит cleaning-документы, чей `config.rooms` — это НЕТРОНУТЫЙ
 * blueprint-набор (имена из дефолтного набора, пустые scope и detergent,
 * нет areaId), и переводит документ на Room: `rooms = []`,
 * `referenceTable = []`, `cleaningMode = "rooms"`, `selectedRoomIds` =
 * все Room организации, после чего пересчитывает план по расписанию Room.
 *
 * ЧЕГО НЕ ДЕЛАЕТ. Документы, где менеджер что-то ввёл руками (свои имена
 * помещений, scope, detergent или привязка к Area), НЕ трогает — там
 * config.rooms несёт данные, которых в Room нет.
 *
 * Запуск (dry-run по умолчанию):
 *   npx tsx scripts/migrate-cleaning-config-rooms.ts
 *   npx tsx scripts/migrate-cleaning-config-rooms.ts --apply
 */
import { db } from "@/lib/db";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  applyRoomScheduleToMatrix,
  applyRoomsToCleaningConfig,
  normalizeCleaningDocumentConfig,
  toRoomScheduleMap,
  type CleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { buildDateKeys } from "@/lib/hygiene-document";

/** Имена стартового набора — по ним узнаём нетронутый blueprint. */
const BLUEPRINT_NAMES = new Set([
  "гостевая зона",
  "помещение мойки",
  "горячий цех/кухня",
  "бар",
]);

type UnknownRecord = Record<string, unknown>;

function isPristineBlueprintRooms(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const room = item as UnknownRecord;
    const name = typeof room.name === "string" ? room.name.trim().toLowerCase() : "";
    if (!BLUEPRINT_NAMES.has(name)) return false;
    if (room.areaId) return false;
    if (typeof room.detergent === "string" && room.detergent.trim()) return false;
    const emptyScope = (scope: unknown) => !Array.isArray(scope) || scope.length === 0;
    return emptyScope(room.currentScope) && emptyScope(room.generalScope);
  });
}

async function main() {
  const apply = process.argv.includes("--apply");

  const template = await db.journalTemplate.findUnique({
    where: { code: CLEANING_DOCUMENT_TEMPLATE_CODE },
    select: { id: true },
  });
  if (!template) {
    console.log("Шаблон cleaning не найден — нечего мигрировать.");
    return;
  }

  const documents = await db.journalDocument.findMany({
    where: { templateId: template.id },
    select: {
      id: true,
      organizationId: true,
      title: true,
      status: true,
      dateFrom: true,
      dateTo: true,
      config: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const roomsByOrg = new Map<string, Awaited<ReturnType<typeof loadRooms>>>();
  async function loadRooms(organizationId: string) {
    return db.room.findMany({
      where: { building: { organizationId } },
      select: {
        id: true,
        currentDays: true,
        generalDays: true,
        currentScheduleType: true,
        generalScheduleType: true,
        currentMonthDays: true,
        generalMonthDays: true,
      },
      orderBy: [{ buildingId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  let touched = 0;
  let skipped = 0;

  for (const doc of documents) {
    const config = (doc.config ?? {}) as UnknownRecord;
    if (!isPristineBlueprintRooms(config.rooms)) {
      skipped += 1;
      continue;
    }
    if (!roomsByOrg.has(doc.organizationId)) {
      roomsByOrg.set(doc.organizationId, await loadRooms(doc.organizationId));
    }
    const rooms = roomsByOrg.get(doc.organizationId) ?? [];
    if (rooms.length === 0) {
      // Организация ещё не завела помещения — blueprint'ы остаются
      // единственным, что можно показать в матрице.
      skipped += 1;
      continue;
    }

    const roomAware = applyRoomsToCleaningConfig(
      config,
      rooms.map((room) => room.id),
    );
    const normalized = normalizeCleaningDocumentConfig(roomAware) as CleaningDocumentConfig;
    const planned = applyRoomScheduleToMatrix(
      normalized,
      buildDateKeys(doc.dateFrom, doc.dateTo),
      "fill-empty",
      toRoomScheduleMap(rooms),
    );

    touched += 1;
    console.log(
      `${apply ? "МИГРИРУЮ" : "нашёл"}: ${doc.id} · ${doc.title} · ${doc.status} · помещений в Room: ${rooms.length}`,
    );
    if (apply) {
      await db.journalDocument.update({
        where: { id: doc.id },
        data: { config: planned as never },
      });
    }
  }

  console.log(
    `\nВсего cleaning-документов: ${documents.length}. ${apply ? "Изменено" : "Кандидатов"}: ${touched}. Пропущено: ${skipped}.`,
  );
  if (!apply && touched > 0) {
    console.log("Это dry-run. Для записи запустите с флагом --apply.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
