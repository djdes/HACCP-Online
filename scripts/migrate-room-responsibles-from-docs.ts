/**
 * 2026-09-04 — разовый идемпотентный перенос закреплений зон из
 * документов журнала уборки в помещения.
 *
 * ЗАЧЕМ. До 2026-09-04 «кто убирает зону» жило в каждом документе
 * (`config.cleanerByRoomId`), а «кто проверяет зону» — в
 * `config.verifierByRoomId` (без UI). Теперь единственное место
 * закрепления — карточка помещения (`Room.cleanerUserIds` /
 * `Room.verifierUserIds`), общая для всех документов. Legacy-поля в
 * документе по-прежнему читаются как fallback, но чтобы менеджер увидел
 * свои закрепления в карточках помещений, переносим их один раз.
 *
 * ЧТО ДЕЛАЕТ. Для каждой организации: активные rooms-mode документы
 * уборки (новые первыми); для каждого помещения из `selectedRoomIds`
 * с непустым `cleanerByRoomId[roomId]` / `verifierByRoomId[roomId]` и
 * ПУСТЫМ соответствующим массивом в Room — записывает id (только
 * активных, не архивных сотрудников). Помещения, где массив уже
 * заполнен, не трогает — карточка помещения приоритетнее.
 *
 * Запуск (dry-run по умолчанию):
 *   npx tsx scripts/migrate-room-responsibles-from-docs.ts
 *   npx tsx scripts/migrate-room-responsibles-from-docs.ts --apply
 */
import { db } from "@/lib/db";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  normalizeCleaningDocumentConfig,
  type CleaningDocumentConfig,
} from "@/lib/cleaning-document";

const APPLY = process.argv.includes("--apply");

type Planned = {
  roomId: string;
  roomName: string;
  cleanerUserIds: string[] | null;
  verifierUserIds: string[] | null;
  fromDocumentId: string;
};

async function main() {
  const orgs = await db.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let totalRooms = 0;
  for (const org of orgs) {
    const [rooms, docs, activeUsers] = await Promise.all([
      db.room.findMany({
        where: { building: { organizationId: org.id } },
        select: { id: true, name: true, cleanerUserIds: true, verifierUserIds: true },
      }),
      db.journalDocument.findMany({
        where: {
          organizationId: org.id,
          status: "active",
          template: { code: CLEANING_DOCUMENT_TEMPLATE_CODE },
        },
        orderBy: { dateFrom: "desc" },
        select: { id: true, config: true },
      }),
      db.user.findMany({
        where: { organizationId: org.id, isActive: true, archivedAt: null },
        select: { id: true },
      }),
    ]);
    if (rooms.length === 0 || docs.length === 0) continue;
    const active = new Set(activeUsers.map((u) => u.id));
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const planned = new Map<string, Planned>();

    for (const doc of docs) {
      const config = normalizeCleaningDocumentConfig(doc.config) as CleaningDocumentConfig;
      if (config.cleaningMode !== "rooms") continue;
      for (const roomId of config.selectedRoomIds ?? []) {
        const room = roomById.get(roomId);
        if (!room) continue;
        const entry: Planned = planned.get(roomId) ?? {
          roomId,
          roomName: room.name,
          cleanerUserIds: null,
          verifierUserIds: null,
          fromDocumentId: doc.id,
        };
        const cleaners = (config.cleanerByRoomId?.[roomId] ?? []).filter((id) => active.has(id));
        if (
          entry.cleanerUserIds === null &&
          room.cleanerUserIds.length === 0 &&
          cleaners.length > 0
        ) {
          entry.cleanerUserIds = Array.from(new Set(cleaners));
        }
        const verifiers = (config.verifierByRoomId?.[roomId] ?? []).filter((id) => active.has(id));
        if (
          entry.verifierUserIds === null &&
          room.verifierUserIds.length === 0 &&
          verifiers.length > 0
        ) {
          entry.verifierUserIds = Array.from(new Set(verifiers));
        }
        if (entry.cleanerUserIds !== null || entry.verifierUserIds !== null) {
          planned.set(roomId, entry);
        }
      }
    }

    if (planned.size === 0) continue;
    console.log(`\n${org.name} (${org.id}): помещений к обновлению — ${planned.size}`);
    for (const p of planned.values()) {
      totalRooms += 1;
      console.log(
        `  • ${p.roomName}: уборщики ${p.cleanerUserIds?.join(", ") ?? "—"}; проверяющие ${
          p.verifierUserIds?.join(", ") ?? "—"
        } (из документа ${p.fromDocumentId})`,
      );
      if (!APPLY) continue;
      await db.room.update({
        where: { id: p.roomId },
        data: {
          ...(p.cleanerUserIds ? { cleanerUserIds: p.cleanerUserIds } : {}),
          ...(p.verifierUserIds ? { verifierUserIds: p.verifierUserIds } : {}),
        },
      });
    }
  }

  console.log(
    `\n${APPLY ? "Применено" : "Dry-run"}: помещений ${totalRooms}. ${
      APPLY ? "" : "Запустите с --apply, чтобы записать."
    }`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
