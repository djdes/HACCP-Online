/**
 * Race-siblings cleanup для журнала уборки (Фаза 1 спека
 * 2026-05-09-wesetup-tasksflow-integration-design.md).
 *
 * Когда worker закрывает race-задачу в TasksFlow, sibling-задачи на ту
 * же комнату у других уборщиков должны исчезнуть (П-2). Wesetup
 * получает webhook от TF (POST /api/integrations/tasksflow/complete),
 * вызывает `markSiblingsAsClaimedByOther`, которая:
 *   1. Парсит rowKey закрывшейся задачи, извлекает roomId.
 *   2. Находит TasksFlowTaskLink с тем же documentId и rowKey-prefix
 *      `room::<roomId>::cleaner::*`, исключая текущий taskId.
 *   3. Для каждой sibling — INSERT в TasksFlowOutbox с
 *      action="markClaimedByOther" (Фаза 1: cron делает DELETE через TF API,
 *      Фаза 2.1: переключим на PATCH со статусом claimed_by_other).
 */

import { Prisma, TasksFlowOutboxStatus } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Извлекает `roomId` из rowKey формата `room::<roomId>::cleaner::<userId>`.
 * Для любого другого формата (pairs-mode rowKey, control-row, override-cell,
 * room-only rowKey, пустая строка, неправильное число `::`-частей,
 * пустые roomId или userId) → null.
 *
 * Контракт совпадает с `parseRoomsModeRowKey` в tasksflow-adapters/cleaning.ts —
 * любая несостыковка между двумя парсерами = баг (фантомные siblings cleanup).
 */
export function extractRoomIdFromCleanerRowKey(rowKey: string): string | null {
  const parts = rowKey.split("::");
  if (parts.length !== 4) return null;
  if (parts[0] !== "room") return null;
  if (parts[2] !== "cleaner") return null;
  if (!parts[1]) return null;
  if (!parts[3]) return null;
  return parts[1];
}

export type MarkSiblingsArgs = {
  /** Wesetup organization ID. */
  organizationId: string;
  /** TasksFlowIntegration ID — нужно для FK в outbox. */
  integrationId: string;
  /** ID документа журнала уборки (JournalDocument.id). */
  journalDocumentId: string;
  /** rowKey закрытой задачи: "room::<roomId>::cleaner::<userId>". */
  closedRowKey: string;
  /** TasksFlow taskId который только что закрыли — исключаем из siblings. */
  excludeTaskId: number;
  /** Имя сотрудника который закрыл (для UI sibling'а: «Сделал: Иван»). */
  claimedByName: string;
  /** TasksFlow workerId сотрудника который закрыл. */
  claimedByWorkerId: number;
};

export type MarkSiblingsResult = {
  marked: number;
  skipped: number;
  reason?: string;
};

/**
 * Находит sibling-задачи на ту же комнату что и закрытая задача, и
 * добавляет outbox-команды на их «закрытие» в TasksFlow.
 *
 * Возвращает количество маркированных siblings и причину пропуска
 * (если closedRowKey не race-mode формата).
 *
 * Idempotent — при повторном вызове с тем же excludeTaskId siblings
 * могут уже быть в outbox со status=delivered. На повторе мы добавим
 * новые outbox-записи только для siblings которые ещё в active. Чтобы
 * избежать дубль-команд: idempotencyKey строится детерминистично из
 * (excludeTaskId, siblingTaskId).
 */
export async function markSiblingsAsClaimedByOther(
  args: MarkSiblingsArgs,
): Promise<MarkSiblingsResult> {
  const roomId = extractRoomIdFromCleanerRowKey(args.closedRowKey);
  if (!roomId) {
    return { marked: 0, skipped: 0, reason: "not_race_mode_rowkey" };
  }

  if (!Number.isInteger(args.excludeTaskId) || args.excludeTaskId <= 0) {
    return { marked: 0, skipped: 0, reason: "invalid_exclude_task_id" };
  }
  if (!Number.isInteger(args.claimedByWorkerId) || args.claimedByWorkerId < 0) {
    // claimedByWorkerId === 0 разрешаем как «неизвестный» (Phase 1 fallback —
    // webhook не присылает workerId). Но отрицательное значит баг.
    return { marked: 0, skipped: 0, reason: "invalid_worker_id" };
  }
  const claimedByName = args.claimedByName.trim();
  // claimedByName может быть пустым в Phase 1 (webhook не присылает имя).
  // Не reject'им, но ниже подставим "другой уборщик" в statusText если пусто.

  const roomPrefix = `room::${roomId}::cleaner::`;

  console.info("[siblings-cleanup] start", {
    excludeTaskId: args.excludeTaskId,
    documentId: args.journalDocumentId,
    roomId,
  });

  const siblings = await db.tasksFlowTaskLink.findMany({
    where: {
      integrationId: args.integrationId,
      journalDocumentId: args.journalDocumentId,
      rowKey: { startsWith: roomPrefix },
      tasksflowTaskId: { not: args.excludeTaskId },
      remoteStatus: { in: ["active", "pending", "in_progress"] },
    },
    select: {
      id: true,
      tasksflowTaskId: true,
      rowKey: true,
    },
  });

  console.info("[siblings-cleanup] candidates", {
    excludeTaskId: args.excludeTaskId,
    count: siblings.length,
  });

  if (siblings.length === 0) {
    return { marked: 0, skipped: 0 };
  }

  let marked = 0;
  let skipped = 0;
  for (const sibling of siblings) {
    // Детерминистичный ключ — повторный вызов не создаст дубль outbox-записи.
    const idempotencyKey = `siblings::${args.excludeTaskId}::${sibling.tasksflowTaskId}`;

    try {
      await db.tasksFlowOutbox.create({
        data: {
          integrationId: args.integrationId,
          organizationId: args.organizationId,
          idempotencyKey,
          action: "markClaimedByOther",
          payload: {
            taskId: sibling.tasksflowTaskId,
            claimedByName: claimedByName || "другой уборщик",
            claimedByWorkerId: args.claimedByWorkerId,
            statusText: claimedByName
              ? `Сделал: ${claimedByName}`
              : "Сделал: другой уборщик",
          } as Prisma.InputJsonValue,
          status: TasksFlowOutboxStatus.pending,
        },
      });
      marked += 1;
    } catch (err) {
      // Unique constraint violation на idempotencyKey — уже добавлено.
      // Прогноз: повторный webhook от TF на тот же event.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        console.warn("[siblings-cleanup] outbox dup", { idempotencyKey });
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  console.info("[siblings-cleanup] done", {
    excludeTaskId: args.excludeTaskId,
    marked,
    skipped,
  });

  return { marked, skipped };
}
