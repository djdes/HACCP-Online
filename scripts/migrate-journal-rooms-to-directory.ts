/**
 * 2026-09-04 — разовая идемпотентная привязка строк журналов климата и
 * графика ген. уборок к единому справочнику помещений (Room).
 *
 * ЗАЧЕМ. До 2026-09-04 климат хранил помещения в `config.rooms` (свои
 * нормы, связь с датчиками только по имени), график ген. уборок — в
 * `config.rows` (свободный текст). Теперь строки связаны с Room через
 * `roomId`: имя и нормы берутся из карточки помещения. Ключи строк
 * (`id`) НЕ меняются — замеры и линки TasksFlow живы.
 *
 * ЧТО ДЕЛАЕТ. Для каждой организации: активные документы климата и
 * графика ген. уборок; для строк без `roomId` ищет Room с тем же
 * названием (без регистра) → пишет `roomId`. Для климата, если у Room
 * нормы не заданы, переносит нормы строки в `Room.climateNorms`.
 * С флагом `--create` строки без совпадения создают Room в первом
 * здании организации (kind "other"); без флага — только отчёт.
 *
 * Запуск (dry-run по умолчанию):
 *   npx tsx scripts/migrate-journal-rooms-to-directory.ts
 *   npx tsx scripts/migrate-journal-rooms-to-directory.ts --apply [--create]
 */
import { db } from "@/lib/db";
import {
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  normalizeClimateDocumentConfig,
  normalizeClimateRoomNorms,
} from "@/lib/climate-document";
import {
  SANITATION_DAY_TEMPLATE_CODE,
  normalizeSanitationDayConfig,
} from "@/lib/sanitation-day-document";
import { toPrismaJsonValue } from "@/lib/journal-entry-write";

const APPLY = process.argv.includes("--apply");
const CREATE = process.argv.includes("--create");

type RoomRef = { id: string; name: string; climateNorms: unknown };

function key(name: string) {
  return name.trim().toLowerCase();
}

async function ensureRoom(
  orgId: string,
  rooms: RoomRef[],
  name: string,
  climateNorms: unknown,
): Promise<RoomRef | null> {
  const found = rooms.find((r) => key(r.name) === key(name));
  if (found) return found;
  if (!CREATE) return null;
  const building = await db.building.findFirst({
    where: { organizationId: orgId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!building) return null;
  if (!APPLY) {
    const stub: RoomRef = { id: `(new)`, name: name.trim(), climateNorms };
    rooms.push(stub);
    return stub;
  }
  const created = await db.room.create({
    data: {
      buildingId: building.id,
      name: name.trim(),
      kind: "other",
      ...(climateNorms ? { climateNorms: toPrismaJsonValue(climateNorms) } : {}),
    },
    select: { id: true, name: true, climateNorms: true },
  });
  rooms.push(created);
  return created;
}

async function main() {
  const orgs = await db.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  let linked = 0;
  let unmatched = 0;

  for (const org of orgs) {
    const rooms: RoomRef[] = await db.room.findMany({
      where: { building: { organizationId: org.id } },
      select: { id: true, name: true, climateNorms: true },
    });
    const docs = await db.journalDocument.findMany({
      where: {
        organizationId: org.id,
        status: "active",
        template: { code: { in: [CLIMATE_DOCUMENT_TEMPLATE_CODE, SANITATION_DAY_TEMPLATE_CODE] } },
      },
      select: { id: true, title: true, config: true, template: { select: { code: true } } },
    });
    if (docs.length === 0) continue;
    let orgHeaderPrinted = false;
    const header = () => {
      if (orgHeaderPrinted) return;
      orgHeaderPrinted = true;
      console.log(`\n${org.name} (${org.id})`);
    };

    for (const doc of docs) {
      if (doc.template.code === CLIMATE_DOCUMENT_TEMPLATE_CODE) {
        const config = normalizeClimateDocumentConfig(doc.config);
        let changed = false;
        for (const row of config.rooms) {
          if (row.roomId) continue;
          const norms = { temperature: row.temperature, humidity: row.humidity };
          const room = await ensureRoom(org.id, rooms, row.name, norms);
          header();
          if (!room) {
            unmatched += 1;
            console.log(`  ✗ климат «${doc.title}»: строка «${row.name}» — нет помещения${CREATE ? "/здания" : " (--create создаст)"}`);
            continue;
          }
          linked += 1;
          console.log(`  • климат «${doc.title}»: «${row.name}» → Room ${room.id} (${room.name})`);
          row.roomId = room.id;
          changed = true;
          if (APPLY && room.id !== "(new)" && !normalizeClimateRoomNorms(room.climateNorms)) {
            await db.room.update({
              where: { id: room.id },
              data: { climateNorms: toPrismaJsonValue(norms) },
            });
            room.climateNorms = norms;
          }
        }
        if (changed && APPLY) {
          await db.journalDocument.update({
            where: { id: doc.id },
            data: { config: toPrismaJsonValue(config) },
          });
        }
      } else {
        const config = normalizeSanitationDayConfig(doc.config);
        let changed = false;
        for (const row of config.rows) {
          if (row.roomId) continue;
          if (!row.roomName.trim()) continue;
          const room = await ensureRoom(org.id, rooms, row.roomName, null);
          header();
          if (!room) {
            unmatched += 1;
            console.log(`  ✗ ген. уборки «${doc.title}»: строка «${row.roomName}» — нет помещения${CREATE ? "/здания" : " (--create создаст)"}`);
            continue;
          }
          linked += 1;
          console.log(`  • ген. уборки «${doc.title}»: «${row.roomName}» → Room ${room.id} (${room.name})`);
          row.roomId = room.id;
          changed = true;
        }
        if (changed && APPLY) {
          await db.journalDocument.update({
            where: { id: doc.id },
            data: { config: toPrismaJsonValue(config) },
          });
        }
      }
    }
  }

  console.log(
    `\n${APPLY ? "Применено" : "Dry-run"}: связано строк ${linked}, без совпадения ${unmatched}.${
      APPLY ? "" : " Запустите с --apply, чтобы записать; --create — создавать недостающие помещения."
    }`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
