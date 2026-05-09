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
