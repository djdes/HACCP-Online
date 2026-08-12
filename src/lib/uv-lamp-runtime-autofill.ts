/**
 * Автозаполнение журнала учёта работы УФ бактерицидной установки.
 *
 * Точки входа:
 *   - POST /api/journal-documents/[id]/uv-runtime (action=apply_auto_fill)
 *   - POST /api/cron/auto-fill-journals (ежедневно, только сегодня)
 *
 * Строка = один день (уникальность по documentId+employeeId+date).
 * Значения берём из спецификации установки (типовое время включения +
 * типовая длительность сеанса). Пишем только в пустые строки, поэтому
 * повторный прогон не меняет ничего.
 */
import type { PrismaClient } from "@prisma/client";
import { toDateKey } from "@/lib/hygiene-document";
import {
  buildUvRuntimeAutoFillEntryData,
  isUvRuntimeEntryDataEmpty,
  normalizeUvRuntimeEntryData,
  type UvSpecification,
} from "@/lib/uv-lamp-runtime-document";

type EntryDb = Pick<PrismaClient, "journalDocumentEntry">;

export type UvAutoFillEntry = {
  id: string;
  employeeId: string;
  date: Date;
  data: unknown;
};

export async function applyUvRuntimeAutoFill(
  db: EntryDb,
  params: {
    documentId: string;
    spec: UvSpecification;
    responsibleUserId: string;
    dateKeys: string[];
    entries: UvAutoFillEntry[];
  }
): Promise<{ created: number; updated: number }> {
  const { documentId, spec, responsibleUserId, dateKeys, entries } = params;
  if (dateKeys.length === 0) return { created: 0, updated: 0 };

  const data = buildUvRuntimeAutoFillEntryData(spec);
  const byDate = new Map(entries.map((entry) => [toDateKey(entry.date), entry]));

  const rowsToCreate = dateKeys
    .filter((dateKey) => !byDate.has(dateKey))
    .map((dateKey) => ({
      documentId,
      employeeId: responsibleUserId,
      date: new Date(`${dateKey}T00:00:00.000Z`),
      data,
    }));

  const created =
    rowsToCreate.length > 0
      ? (
          await db.journalDocumentEntry.createMany({
            data: rowsToCreate,
            skipDuplicates: true,
          })
        ).count
      : 0;

  const rowsToUpdate = dateKeys
    .map((dateKey) => byDate.get(dateKey))
    .filter(
      (entry): entry is UvAutoFillEntry =>
        Boolean(entry) &&
        isUvRuntimeEntryDataEmpty(normalizeUvRuntimeEntryData(entry!.data))
    );

  await Promise.all(
    rowsToUpdate.map((entry) =>
      db.journalDocumentEntry.update({
        where: { id: entry.id },
        data: { data },
      })
    )
  );

  return { created, updated: rowsToUpdate.length };
}
