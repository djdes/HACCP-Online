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
import { applyRoomResponsiblesToConfig } from "@/lib/cleaning-room-responsibles";
import {
  TasksFlowError,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";
import {
  normalizeCleaningDocumentConfig,
  parseScopeSteps,
  resolveRoomCleaners,
  resolveRoomController,
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
 * Возвращает список уборщиков, которые должны получить override-задачу
 * для (room, dateKey) при «/»→«Т»/«Г» переключении.
 *
 * Логика повторяет buildRoomsModeRows (см. tasksflow-adapters/cleaning.ts):
 *   • Race-mode (rooms-mode + roomsRaceMode=true) — ВСЕ уборщики из
 *     selectedCleanerUserIds. Каждый получит свою задачу. Тот, кто
 *     первый закроет, sibling-cleanup помечает остальных claimed_by_other.
 *   • Round-robin (rooms-mode без race) — один уборщик, выбираемый
 *     по позиции комнаты в списке (selectedRoomIds.indexOf, fallback
 *     на алфавитный порядок room.id если selectedRoomIds пуст).
 *   • Pairs-mode (legacy) — первый cleaner из responsiblePairs.
 *
 * Раньше функция называлась pickCleanerWesetupId и возвращала ОДНОГО
 * уборщика, поэтому в race-mode override создавал 1 задачу из N — и
 * остальные уборщики не видели, что менеджер кликнул «Т» в matrix.
 * Юзер: «когда я изменил со слэша на т ... задача не пришла».
 *
 * Также убран early-return когда selectedRoomIds пуст: теперь даже
 * без явного selection round-robin работает (idx по DB-порядку).
 */
function pickCleanersForRoom(
  config: CleaningDocumentConfig,
  roomId: string,
): string[] {
  if (
    config.cleaningMode === "rooms" &&
    Array.isArray(config.selectedCleanerUserIds) &&
    config.selectedCleanerUserIds.length > 0
  ) {
    // 2026-09: единый резолвер с адаптером (закрепление зон → пул).
    return resolveRoomCleaners(config, roomId);
  }
  // Pairs-mode (legacy): первый cleaner из responsiblePairs.
  const firstPair = config.responsiblePairs?.[0];
  if (firstPair?.cleaningUserId) return [firstPair.cleaningUserId];
  return [];
}

function pickVerifierWesetupId(
  config: CleaningDocumentConfig,
  roomId: string,
): string | null {
  return (
    resolveRoomController(config, roomId) ??
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

  const overrideRowKey = buildRowKey(args.roomId, args.dateKey);
  // Префикс для multi-cleaner override (новый формат, 2026-05-10):
  //   cell-override::<roomId>::<dateKey>::cleaner::<userId>
  // Старый формат cell-override::<roomId>::<dateKey> (без ::cleaner)
  // тоже захватывается через startsWith.
  const overridePrefix = `cell-override::${args.roomId}::${args.dateKey}`;
  const racePrefix = `room::${args.roomId}::cleaner::`;

  // Находим ВСЕ TF-задачи на эту комнату+(день|постоянные)+документ:
  //   1. cell-override::roomId::dateKey (legacy, single)
  //   2. cell-override::roomId::dateKey::cleaner::userId (new, multi)
  //   3. room::roomId::cleaner::userId (race-mode bulk-assigned)
  const relatedLinks = await db.tasksFlowTaskLink.findMany({
    where: {
      integrationId: integration.id,
      journalDocumentId: args.documentId,
      OR: [
        { rowKey: { startsWith: overridePrefix } },
        { rowKey: { startsWith: racePrefix } },
      ],
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
    if (relatedLinks.length === 0) return;
    // Cell вернулась в "/" или "" → удаляем все связанные TF-задачи
    // (override + race-mode siblings) на эту комнату+день. НО ТОЛЬКО
    // не-завершённые. Completed/verified-задачи защищаем — это
    // compliance-данные, удаление при изменении плана = потеря trail
    // (юзер жаловался: «после правки помещения задачи пересоздались
    // без надписи что одна сделана»).
    for (const link of relatedLinks) {
      if (
        link.remoteStatus === "completed" ||
        link.remoteStatus === "verified"
      ) {
        // Skip — задача уже выполнена, оставляем в TF и в TaskLink.
        continue;
      }
      try {
        await client.deleteTask(link.tasksflowTaskId);
      } catch (err) {
        const status = err instanceof TasksFlowError ? err.status : 0;
        if (status !== 404 && status !== 410) {
          console.error(
            `[cleaning-cell-override] delete task=${link.tasksflowTaskId} failed`,
            err,
          );
          continue;
        }
      }
      await db.tasksFlowTaskLink
        .delete({ where: { id: link.id } })
        .catch(() => {});
    }
    return;
  }

  // wantTask = true → upsert. Подтягиваем config документа и
  // выбираем уборщика + верификатора.
  const doc = await db.journalDocument.findUnique({
    where: { id: args.documentId },
    select: { config: true, organizationId: true },
  });
  if (!doc || doc.organizationId !== args.organizationId) return;
  const rawConfig = normalizeCleaningDocumentConfig(
    doc.config,
  ) as CleaningDocumentConfig;

  // Подтягиваем имена помещений из /settings/buildings (rooms-mode)
  // если их нет в config.rooms.
  const buildingRooms = await db.room.findMany({
    where: { building: { organizationId: args.organizationId } },
    select: {
      id: true,
      name: true,
      requirePhoto: true,
      currentScope: true,
      generalScope: true,
      cleanerUserIds: true,
      verifierUserIds: true,
    },
  });
  // Эффективный конфиг: уборщики/проверяющие помещения из Room
  // (та же точка слияния, что у адаптера и PDF).
  const activeUsers = await db.user.findMany({
    where: { organizationId: args.organizationId, archivedAt: null },
    select: { id: true },
  });
  const config = applyRoomResponsiblesToConfig(
    rawConfig,
    buildingRooms,
    new Set(activeUsers.map((u) => u.id)),
  );
  const roomName = findRoomName(config, buildingRooms, args.roomId);
  // Effective requirePhoto = Room.requirePhoto OR любой scope-step
  // имеет explicit per-step requirePhoto=true.
  const dbRoom = buildingRooms.find((r) => r.id === args.roomId);
  const requirePhoto =
    dbRoom?.requirePhoto === true ||
    parseScopeSteps(dbRoom?.currentScope).some((s) => s.requirePhoto === true) ||
    parseScopeSteps(dbRoom?.generalScope).some((s) => s.requirePhoto === true);

  // Список уборщиков для (room, dateKey). В race-mode = ВСЕ cleaners,
  // в round-robin = один по индексу, в pairs-mode = первый. Раньше
  // pickCleanerWesetupId возвращал ОДНОГО → в race-mode override-task
  // получал только cleaner-1, остальные не видели — юзер: «задача не пришла».
  const cleanerWesetupIds = pickCleanersForRoom(config, args.roomId);
  if (cleanerWesetupIds.length === 0) {
    console.warn(
      `[cleaning-cell-override] no eligible cleaners for room=${args.roomId} doc=${args.documentId} (mode=${config.cleaningMode}, race=${config.roomsRaceMode})`,
    );
    return;
  }

  // Resolve все TF user-id за один запрос.
  const userLinks = await db.tasksFlowUserLink.findMany({
    where: {
      integrationId: integration.id,
      wesetupUserId: { in: cleanerWesetupIds },
    },
    select: { wesetupUserId: true, tasksflowUserId: true },
  });
  const tfUserIdByWesetup = new Map(
    userLinks
      .filter((l) => l.tasksflowUserId != null)
      .map((l) => [l.wesetupUserId, l.tasksflowUserId as number]),
  );

  // Verifier (общий для всех уборщиков комнаты)
  const verifierWesetupId = pickVerifierWesetupId(config, args.roomId);
  let verifierTfId: number | null = null;
  if (verifierWesetupId) {
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

  if (relatedLinks.length > 0) {
    // У нас уже есть связанные TF-задачи (override и/или race-mode
    // bulk-assigned). Обновляем title во всех — T↔G меняется одновременно
    // у всех потенциальных уборщиков. Description обновляем только у
    // override (у race-задач description от bulk-assign template'а).
    //
    // 2026-05-10: ДОПОЛНИТЕЛЬНО — если в race-mode появился новый
    // cleaner после bulk-assign (или какой-то cleaner не получил задачу
    // из-за фильтра matrix=/), создаём недостающие override-задачи для
    // тех cleaners, у которых нет связанной задачи на эту комнату+день.
    const cleanersWithExistingTask = new Set<string>();
    for (const link of relatedLinks) {
      const m = /^room::[^:]+::cleaner::([^:]+)$/.exec(link.rowKey);
      if (m && m[1]) cleanersWithExistingTask.add(m[1]);
      const o = /^cell-override::[^:]+::[^:]+::cleaner::([^:]+)$/.exec(
        link.rowKey,
      );
      if (o && o[1]) cleanersWithExistingTask.add(o[1]);
    }
    for (const link of relatedLinks) {
      try {
        if (link.rowKey === overrideRowKey) {
          await client.updateTask(link.tasksflowTaskId, { title, description });
        } else {
          await client.updateTask(link.tasksflowTaskId, { title });
        }
        await db.tasksFlowTaskLink.update({
          where: { id: link.id },
          data: { lastDirection: "push", remoteStatus: "active" },
        });
      } catch (err) {
        console.error(
          `[cleaning-cell-override] update task=${link.tasksflowTaskId} failed`,
          err,
        );
      }
    }
    // Создать недостающих cleaners в race-mode (или round-robin при
    // первом override). Если cleanersWithExistingTask покрывает всех —
    // ничего не создаём.
    const missing = cleanerWesetupIds.filter(
      (id) => !cleanersWithExistingTask.has(id),
    );
    if (missing.length > 0) {
      await createOverrideTasksForCleaners({
        client,
        integration,
        documentId: args.documentId,
        roomId: args.roomId,
        dateKey: args.dateKey,
        title,
        description,
        cleanerIds: missing,
        tfUserIdByWesetup,
        verifierTfId,
        requirePhoto,
      });
    }
    return;
  }

  // links не было — создаём с нуля для всех cleaners.
  await createOverrideTasksForCleaners({
    client,
    integration,
    documentId: args.documentId,
    roomId: args.roomId,
    dateKey: args.dateKey,
    title,
    description,
    cleanerIds: cleanerWesetupIds,
    tfUserIdByWesetup,
    verifierTfId,
    requirePhoto,
  });
}

/**
 * Создаёт override-задачу для каждого переданного cleaner.
 *
 * RowKey-формат: `cell-override::<roomId>::<dateKey>::cleaner::<userId>` —
 * включает cleaner-id чтобы поддержать race-mode (N задач на комнату).
 * Pairs-mode и round-robin использует тот же шаблон с одним cleaner.
 *
 * Старый формат `cell-override::<roomId>::<dateKey>` (без cleaner)
 * остаётся читаемым в `relatedLinks` (startsWith `cell-override::roomId::dateKey`)
 * для back-compat с существующими записями TaskLink.
 */
async function createOverrideTasksForCleaners(args: {
  client: ReturnType<typeof tasksflowClientFor>;
  integration: { id: string };
  documentId: string;
  roomId: string;
  dateKey: string;
  title: string;
  description: string;
  cleanerIds: string[];
  tfUserIdByWesetup: Map<string, number>;
  verifierTfId: number | null;
  requirePhoto: boolean;
}): Promise<void> {
  const baseUrl = (process.env.NEXTAUTH_URL ?? "").trim() || "https://wesetup.ru";
  for (const cleanerWesetupId of args.cleanerIds) {
    const cleanerTfId = args.tfUserIdByWesetup.get(cleanerWesetupId);
    if (cleanerTfId == null) {
      console.warn(
        `[cleaning-cell-override] no TF link for cleaner=${cleanerWesetupId}`,
      );
      continue;
    }
    const verifierTfId =
      args.verifierTfId !== null && args.verifierTfId !== cleanerTfId
        ? args.verifierTfId
        : null;
    const rowKey = `cell-override::${args.roomId}::${args.dateKey}::cleaner::${cleanerWesetupId}`;
    const journalLink = JSON.stringify({
      kind: "wesetup-cleaning",
      baseUrl: baseUrl.replace(/\/+$/, ""),
      integrationId: args.integration.id,
      documentId: args.documentId,
      rowKey,
      label: args.title,
      isFreeText: false,
      bonusAmountKopecks: 0,
      taskScope: "personal",
      siblingVisibility: false,
    });
    try {
      const created = await args.client.createTask({
        title: args.title,
        description: args.description,
        workerId: cleanerTfId,
        verifierWorkerId: verifierTfId,
        isRecurring: false,
        requiresPhoto: args.requirePhoto,
        category: "WeSetup · Уборка",
        journalLink,
      });
      await db.tasksFlowTaskLink.create({
        data: {
          integrationId: args.integration.id,
          journalCode: "cleaning",
          journalDocumentId: args.documentId,
          rowKey,
          tasksflowTaskId: created.id,
          remoteStatus: created.isCompleted ? "completed" : "active",
          lastDirection: "push",
        },
      });
    } catch (err) {
      console.error(
        `[cleaning-cell-override] create failed cleaner=${cleanerWesetupId}`,
        err,
      );
    }
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
