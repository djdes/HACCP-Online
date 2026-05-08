/**
 * Cleaning unification 2026-05-08: при изменении Room.currentScope или
 * Room.generalScope в БД — автоматически синкаем в JournalChecklistItem
 * (org-уровень, journalCode='cleaning', roomId, category='current'|'general').
 * Эти items потом подгружаются в TF task-fill flow через
 * /api/task-fill/[taskId]/checklist (фильтрация по category по матрице
 * сегодня — T или G).
 *
 * Логика: транзакционно archive предыдущих category=current/general
 * для этой пары (org, roomId) + insert новых.
 *
 * Вызывается из:
 *   • PATCH /api/settings/rooms/[id] — когда правят Room в настройках
 *     или в журнале через write-through (см. submitRoom в
 *     cleaning-document-client.tsx).
 *   • Backwards-compat shim в /api/journals/cleaning/documents/[id]/
 *     room-scopes — старый endpoint остаётся, но дёргает этот же helper.
 */
import { db } from "@/lib/db";

const CAT_CURRENT = "current" as const;
const CAT_GENERAL = "general" as const;

function clean(lines: string[] | undefined): string[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .slice(0, 50);
}

export type SyncRoomChecklistArgs = {
  organizationId: string;
  roomId: string;
  currentScope?: string[];
  generalScope?: string[];
  /** ID пользователя который пишет (для createdByUserId). null допустимо
   *  для системных вызовов (cron, seed). */
  createdByUserId?: string | null;
};

export async function syncRoomChecklistItems(
  args: SyncRoomChecklistArgs,
): Promise<{ currentCount: number; generalCount: number }> {
  // Sync = either current or general field passed (or both). Если оба
  // undefined — ничего не делаем (caller просто не трогал scope).
  if (args.currentScope === undefined && args.generalScope === undefined) {
    return { currentCount: 0, generalCount: 0 };
  }

  const cleanedCurrent =
    args.currentScope !== undefined ? clean(args.currentScope) : null;
  const cleanedGeneral =
    args.generalScope !== undefined ? clean(args.generalScope) : null;

  await db.$transaction(async (tx) => {
    // Архивируем только те categorы которые сейчас обновляем.
    const categoriesToArchive: ("current" | "general")[] = [];
    if (cleanedCurrent !== null) categoriesToArchive.push(CAT_CURRENT);
    if (cleanedGeneral !== null) categoriesToArchive.push(CAT_GENERAL);
    if (categoriesToArchive.length > 0) {
      await tx.journalChecklistItem.updateMany({
        where: {
          organizationId: args.organizationId,
          journalCode: "cleaning",
          roomId: args.roomId,
          category: { in: categoriesToArchive },
          archivedAt: null,
        },
        data: { archivedAt: new Date() },
      });
    }

    if (cleanedCurrent !== null && cleanedCurrent.length > 0) {
      await tx.journalChecklistItem.createMany({
        data: cleanedCurrent.map((label, index) => ({
          organizationId: args.organizationId,
          journalCode: "cleaning",
          roomId: args.roomId,
          label,
          sortOrder: index * 10,
          required: false,
          frequency: "daily",
          category: CAT_CURRENT,
          createdByUserId: args.createdByUserId ?? null,
        })),
      });
    }
    if (cleanedGeneral !== null && cleanedGeneral.length > 0) {
      await tx.journalChecklistItem.createMany({
        data: cleanedGeneral.map((label, index) => ({
          organizationId: args.organizationId,
          journalCode: "cleaning",
          roomId: args.roomId,
          label,
          sortOrder: 1000 + index * 10,
          required: false,
          frequency: "daily",
          category: CAT_GENERAL,
          createdByUserId: args.createdByUserId ?? null,
        })),
      });
    }
  });

  return {
    currentCount: cleanedCurrent?.length ?? 0,
    generalCount: cleanedGeneral?.length ?? 0,
  };
}
