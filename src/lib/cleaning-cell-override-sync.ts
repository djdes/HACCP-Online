/**
 * Live sync для CleaningDocument.matrix: когда пользователь кликает
 * ячейку сегодняшнего дня (T → G, G → T, → /, → ""), мы создаём,
 * обновляем или удаляем override-задачу в TasksFlow для этой ячейки.
 * Это даёт мгновенную обратную связь в TF — уборщица видит «Сегодня
 * генеральная · цех X» вместо общей recurring «Уборки».
 *
 * RowKey формат: `cell-override::{roomId}::{dateKey}`
 *   уникальный per (integration, document, cell). Не пересекается
 *   с другими rowKey-паттернами (room::, control::, pair-id).
 *
 * Поведение по value:
 *   "G" → upsert override task «Генеральная уборка · {room}»
 *   "T" → upsert override task «Текущая уборка · {room}»
 *   "/" или "" → delete override task если есть
 *
 * НЕ затрагивает другие TF-задачи (recurring per-pair или per-room).
 * Cleaner видит обе — это компромисс: проще для рассинхрона менеджер↔
 * сотрудник, без необходимости manipulate'ить recurring-задачи.
 */
import { db } from "@/lib/db";
import {
  TasksFlowError,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";
import {
  normalizeCleaningDocumentConfig,
  type CleaningDocumentConfig,
  type CleaningRoomItem,
} from "@/lib/cleaning-document";

type SyncArgs = {
  documentId: string;
  organizationId: string;
  roomId: string;
  dateKey: string;
  value: string;
};

const ROW_KEY_PREFIX = "cell-override";

function buildRowKey(roomId: string, dateKey: string): string {
  return `${ROW_KEY_PREFIX}::${roomId}::${dateKey}`;
}

function buildTitle(value: string, roomName: string): string {
  // Plain text без emoji — TF Mini App font не всегда рендерит emoji
  // (юзер видел «?» вместо 🧹). Тип уборки понятен из текста.
  if (value === "G") return `Генеральная уборка · ${roomName}`;
  if (value === "T") return `Текущая уборка · ${roomName}`;
  return `Уборка · ${roomName}`;
}

function buildDescription(args: {
  value: string;
  roomName: string;
  dateKey: string;
}): string {
  const cleaningType =
    args.value === "G"
      ? "генеральная (полная санобработка)"
      : args.value === "T"
        ? "текущая (ежедневная)"
        : "по плану";
  return [
    `Помещение: ${args.roomName}`,
    `Дата: ${args.dateKey}`,
    `Тип уборки: ${cleaningType}`,
    "",
    "Override от менеджера через журнал — сделай этот тип уборки сегодня.",
  ].join("\n");
}

/**
 * Round-robin / first-pair pick of cleaner for a given room.
 * Returns null if no eligible cleaner found.
 */
function pickCleanerWesetupId(
  config: CleaningDocumentConfig,
  roomId: string,
): string | null {
  // rooms-mode: round-robin по selectedCleanerUserIds
  if (
    config.cleaningMode === "rooms" &&
    Array.isArray(config.selectedRoomIds) &&
    Array.isArray(config.selectedCleanerUserIds) &&
    config.selectedCleanerUserIds.length > 0
  ) {
    const idx = config.selectedRoomIds.indexOf(roomId);
    if (idx >= 0) {
      return (
        config.selectedCleanerUserIds[
          idx % config.selectedCleanerUserIds.length
        ] ?? null
      );
    }
  }
  // pairs-mode (legacy): первый cleaner из responsiblePairs
  const firstPair = config.responsiblePairs?.[0];
  return firstPair?.cleaningUserId ?? null;
}

function pickVerifierWesetupId(
  config: CleaningDocumentConfig,
  roomId: string,
): string | null {
  return (
    config.verifierByRoomId?.[roomId] ??
    config.controlUserId ??
    config.responsiblePairs?.[0]?.controlUserId ??
    null
  );
}

function findRoomName(
  config: CleaningDocumentConfig,
  rooms: Array<{ id: string; name: string }>,
  roomId: string,
): string {
  const fromConfig = config.rooms?.find(
    (r: CleaningRoomItem) => r.id === roomId,
  );
  if (fromConfig) return fromConfig.name;
  const fromBuildings = rooms.find((r) => r.id === roomId);
  if (fromBuildings) return fromBuildings.name;
  return "(удалённое помещение)";
}

export async function syncCleaningCellOverride(
  args: SyncArgs,
): Promise<void> {
  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId: args.organizationId },
  });
  if (!integration || !integration.enabled) return;

  const rowKey = buildRowKey(args.roomId, args.dateKey);
  const existing = await db.tasksFlowTaskLink.findUnique({
    where: {
      integrationId_journalDocumentId_rowKey: {
        integrationId: integration.id,
        journalDocumentId: args.documentId,
        rowKey,
      },
    },
  });

  // Выходное состояние: нужно ли иметь override-задачу?
  const wantTask = args.value === "G" || args.value === "T";

  let client: ReturnType<typeof tasksflowClientFor>;
  try {
    client = tasksflowClientFor(integration);
  } catch (err) {
    console.error("[cleaning-cell-override] decrypt failed", err);
    return;
  }

  if (!wantTask) {
    if (!existing) return;
    // Cell вернулась в "/" или "" → удаляем override.
    try {
      await client.deleteTask(existing.tasksflowTaskId);
    } catch (err) {
      const status = err instanceof TasksFlowError ? err.status : 0;
      if (status !== 404) {
        console.error(
          "[cleaning-cell-override] delete failed",
          err,
        );
        return;
      }
    }
    await db.tasksFlowTaskLink
      .delete({ where: { id: existing.id } })
      .catch(() => {});
    return;
  }

  // wantTask = true → upsert. Подтягиваем config документа и
  // выбираем уборщика + верификатора.
  const doc = await db.journalDocument.findUnique({
    where: { id: args.documentId },
    select: { config: true, organizationId: true },
  });
  if (!doc || doc.organizationId !== args.organizationId) return;
  const config = normalizeCleaningDocumentConfig(
    doc.config,
  ) as CleaningDocumentConfig;

  // Подтягиваем имена помещений из /settings/buildings (rooms-mode)
  // если их нет в config.rooms.
  const buildingRooms = await db.room.findMany({
    where: { building: { organizationId: args.organizationId } },
    select: { id: true, name: true },
  });
  const roomName = findRoomName(config, buildingRooms, args.roomId);

  const cleanerWesetupId = pickCleanerWesetupId(config, args.roomId);
  if (!cleanerWesetupId) return;

  const userLink = await db.tasksFlowUserLink.findUnique({
    where: {
      integrationId_wesetupUserId: {
        integrationId: integration.id,
        wesetupUserId: cleanerWesetupId,
      },
    },
    select: { tasksflowUserId: true },
  });
  if (!userLink || userLink.tasksflowUserId == null) return;
  const cleanerTfId = userLink.tasksflowUserId;

  // Verifier (если есть TF-link)
  const verifierWesetupId = pickVerifierWesetupId(config, args.roomId);
  let verifierTfId: number | null = null;
  if (verifierWesetupId && verifierWesetupId !== cleanerWesetupId) {
    const verifierLink = await db.tasksFlowUserLink.findUnique({
      where: {
        integrationId_wesetupUserId: {
          integrationId: integration.id,
          wesetupUserId: verifierWesetupId,
        },
      },
      select: { tasksflowUserId: true },
    });
    verifierTfId = verifierLink?.tasksflowUserId ?? null;
  }

  const title = buildTitle(args.value, roomName);
  const description = buildDescription({
    value: args.value,
    roomName,
    dateKey: args.dateKey,
  });

  if (existing) {
    // Update title/description (например T ↔ G).
    try {
      await client.updateTask(existing.tasksflowTaskId, {
        title,
        description,
      });
      await db.tasksFlowTaskLink.update({
        where: { id: existing.id },
        data: { lastDirection: "push", remoteStatus: "active" },
      });
    } catch (err) {
      console.error("[cleaning-cell-override] update failed", err);
    }
    return;
  }

  // Create
  try {
    const created = await client.createTask({
      title,
      description,
      workerId: cleanerTfId,
      verifierWorkerId: verifierTfId,
      isRecurring: false,
      requiresPhoto: false,
      category: "Уборка",
    });
    await db.tasksFlowTaskLink.create({
      data: {
        integrationId: integration.id,
        journalCode: "cleaning",
        journalDocumentId: args.documentId,
        rowKey,
        tasksflowTaskId: created.id,
        remoteStatus: created.isCompleted ? "completed" : "active",
        lastDirection: "push",
      },
    });
  } catch (err) {
    console.error("[cleaning-cell-override] create failed", err);
  }
}

/**
 * Diff prevConfig.matrix vs nextConfig.matrix для сегодняшнего dateKey
 * и вызывает syncCleaningCellOverride на каждое реальное изменение.
 * Fire-and-forget — ошибки логируются но не блокируют save.
 */
export async function syncTodayMatrixChanges(args: {
  documentId: string;
  organizationId: string;
  prevMatrix: Record<string, Record<string, string>>;
  nextMatrix: Record<string, Record<string, string>>;
  todayKey: string;
}): Promise<void> {
  const allRoomIds = new Set([
    ...Object.keys(args.prevMatrix),
    ...Object.keys(args.nextMatrix),
  ]);
  const tasks: Promise<void>[] = [];
  for (const roomId of allRoomIds) {
    const prev = args.prevMatrix[roomId]?.[args.todayKey] ?? "";
    const next = args.nextMatrix[roomId]?.[args.todayKey] ?? "";
    if (prev === next) continue;
    tasks.push(
      syncCleaningCellOverride({
        documentId: args.documentId,
        organizationId: args.organizationId,
        roomId,
        dateKey: args.todayKey,
        value: next,
      }),
    );
  }
  await Promise.allSettled(tasks);
}
