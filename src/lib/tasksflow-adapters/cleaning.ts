/**
 * TasksFlow adapter for the «Журнал уборки» (cleaning) journal.
 *
 * Mapping:
 *   • adapter row  = `responsiblePair` in the cleaning document
 *   • completion   = mark today's cell in the matrix with the doc's
 *                    `autoFill.defaultRoomMark` (defaults to "✓")
 *   • schedule     = Mon-Sun by default, Mon-Fri if `skipWeekends`
 *
 * This file is the canonical example of how to write an adapter.
 * Any new journal adapter follows the same shape (register in
 * `index.ts` to expose it to the API + UI).
 */
import type { TasksFlowIntegration } from "@prisma/client";
import { db } from "@/lib/db";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  type CleaningDocumentConfig,
  normalizeCleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { toDateKey } from "@/lib/hygiene-document";
import {
  TasksFlowError,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";
import {
  EMPTY_SYNC_REPORT,
  type AdapterDocument,
  type AdapterRow,
  type JournalAdapter,
  type JournalSyncReport,
  type TaskSchedule,
} from "./types";

const CATEGORY = "WeSetup · Уборка";

export const cleaningAdapter: JournalAdapter = {
  meta: {
    templateCode: CLEANING_DOCUMENT_TEMPLATE_CODE,
    label: "Журнал уборки",
    description: "Назначение уборщиков на ответственные строки",
    iconName: "spray-can",
  },

  scheduleForRow(_row, doc): TaskSchedule {
    const skip = (doc as AdapterDocument & { _skipWeekends?: boolean })
      ._skipWeekends;
    return { weekDays: skip ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6] };
  },

  titleForRow(row): string {
    return `Уборка · ${row.label}`;
  },

  descriptionForRow(_row, doc): string {
    const sub = (doc as AdapterDocument & { _control?: string })._control;
    const lines = [
      `Журнал: ${doc.documentTitle}`,
      `Период: ${doc.period.from} — ${doc.period.to}`,
    ];
    if (sub) lines.push(`Контроль: ${sub}`);
    return lines.join("\n");
  },

  async listDocumentsForOrg(organizationId): Promise<AdapterDocument[]> {
    const docs = await db.journalDocument.findMany({
      where: {
        organizationId,
        status: "active",
        template: { code: CLEANING_DOCUMENT_TEMPLATE_CODE },
      },
      select: {
        id: true,
        title: true,
        dateFrom: true,
        dateTo: true,
        config: true,
      },
      orderBy: { dateFrom: "desc" },
    });

    // Подгружаем комнаты org один раз — нужны для label в rooms-mode.
    const allRooms = await db.room.findMany({
      where: { building: { organizationId } },
      select: { id: true, name: true },
    });
    const roomNameById = new Map(allRooms.map((r) => [r.id, r.name]));
    // И юзеров — для подписи cleaner-а в label.
    const orgUsers = await db.user.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true, name: true },
    });
    const userNameById = new Map(orgUsers.map((u) => [u.id, u.name]));

    return docs.map((doc) => {
      const config = normalizeCleaningDocumentConfig(
        doc.config
      ) as CleaningDocumentConfig;
      const adapterDoc: AdapterDocument = {
        documentId: doc.id,
        documentTitle: doc.title,
        period: {
          from: toDateKey(doc.dateFrom),
          to: toDateKey(doc.dateTo),
        },
        rows:
          config.cleaningMode === "rooms"
            ? buildRoomsModeRows(config, roomNameById, userNameById)
            : (config.responsiblePairs ?? []).map<AdapterRow>((pair) => ({
                rowKey: pair.id,
                label: pair.cleaningUserName || pair.cleaningTitle,
                sublabel: pair.controlUserName
                  ? `Контроль: ${pair.controlUserName}`
                  : pair.controlTitle,
                responsibleUserId: pair.cleaningUserId,
              })),
      };
      (adapterDoc as AdapterDocument & {
        _skipWeekends?: boolean;
        _control?: string;
        _cleaningMode?: "pairs" | "rooms";
      })._skipWeekends = Boolean(config.skipWeekends);
      (adapterDoc as AdapterDocument & {
        _cleaningMode?: "pairs" | "rooms";
      })._cleaningMode = config.cleaningMode ?? "pairs";
      return adapterDoc;
    });
  },

  async syncDocument({ integration, documentId }): Promise<JournalSyncReport> {
    const doc = await db.journalDocument.findUnique({
      where: { id: documentId },
      include: { template: true },
    });
    if (
      !doc ||
      doc.organizationId !== integration.organizationId ||
      doc.template.code !== CLEANING_DOCUMENT_TEMPLATE_CODE
    ) {
      return EMPTY_SYNC_REPORT;
    }
    if (doc.status === "closed") return EMPTY_SYNC_REPORT;

    const config = normalizeCleaningDocumentConfig(
      doc.config
    ) as CleaningDocumentConfig;
    const pairs = config.responsiblePairs ?? [];

    const userLinks = await db.tasksFlowUserLink.findMany({
      where: { integrationId: integration.id },
      select: {
        wesetupUserId: true,
        tasksflowUserId: true,
      },
    });
    const linkByUser = new Map(userLinks.map((l) => [l.wesetupUserId, l]));

    const existingTaskLinks = await db.tasksFlowTaskLink.findMany({
      where: {
        integrationId: integration.id,
        journalDocumentId: documentId,
      },
      select: { id: true, rowKey: true, tasksflowTaskId: true },
    });
    const taskLinkByRow = new Map(
      existingTaskLinks.map((tl) => [tl.rowKey, tl])
    );

    const client = tasksflowClientFor(integration);
    const report: JournalSyncReport = {
      created: 0,
      updated: 0,
      deleted: 0,
      skippedNoLink: [],
      errors: [],
    };

    const dateFromIso = toDateKey(doc.dateFrom);
    const dateToIso = toDateKey(doc.dateTo);
    const weekDays = config.skipWeekends
      ? [1, 2, 3, 4, 5]
      : [0, 1, 2, 3, 4, 5, 6];
    const seen = new Set<string>();

    for (const pair of pairs) {
      seen.add(pair.id);
      if (!pair.cleaningUserId) {
        report.skippedNoLink.push(pair.id);
        continue;
      }
      const link = linkByUser.get(pair.cleaningUserId);
      const remoteUserId = link?.tasksflowUserId ?? null;
      if (!remoteUserId) {
        report.skippedNoLink.push(pair.id);
        continue;
      }

      const payload = {
        title: `Уборка · ${pair.cleaningUserName || pair.cleaningTitle}`,
        workerId: remoteUserId,
        requiresPhoto: false,
        isRecurring: true,
        weekDays,
        category: CATEGORY,
        description: [
          `Журнал: ${doc.title}`,
          `Период: ${dateFromIso} — ${dateToIso}`,
          pair.controlUserName
            ? `Контроль: ${pair.controlUserName} (${pair.controlTitle})`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      };

      const existing = taskLinkByRow.get(pair.id);
      try {
        if (existing) {
          await client.updateTask(existing.tasksflowTaskId, payload);
          await db.tasksFlowTaskLink.update({
            where: { id: existing.id },
            data: { lastDirection: "push" },
          });
          report.updated += 1;
        } else {
          const created = await client.createTask(payload);
          await db.tasksFlowTaskLink.create({
            data: {
              integrationId: integration.id,
              journalCode: CLEANING_DOCUMENT_TEMPLATE_CODE,
              journalDocumentId: documentId,
              rowKey: pair.id,
              tasksflowTaskId: created.id,
              remoteStatus: created.isCompleted ? "completed" : "active",
              lastDirection: "push",
            },
          });
          report.created += 1;
        }
      } catch (err) {
        const msg =
          err instanceof TasksFlowError
            ? `${err.status} ${err.message}`
            : err instanceof Error
            ? err.message
            : "unknown error";
        report.errors.push({ rowKey: pair.id, message: msg });
      }
    }

    for (const tl of existingTaskLinks) {
      if (seen.has(tl.rowKey)) continue;
      try {
        await client.deleteTask(tl.tasksflowTaskId);
      } catch (err) {
        const status = err instanceof TasksFlowError ? err.status : 0;
        if (status !== 404) {
          report.errors.push({
            rowKey: tl.rowKey,
            message: `delete: ${err instanceof Error ? err.message : "unknown"}`,
          });
        }
      }
      await db.tasksFlowTaskLink
        .delete({ where: { id: tl.id } })
        .catch(() => null);
      report.deleted += 1;
    }

    return report;
  },

  async applyRemoteCompletion({
    documentId,
    rowKey,
    completed,
    todayKey,
  }): Promise<boolean> {
    const doc = await db.journalDocument.findUnique({
      where: { id: documentId },
      include: { template: true },
    });
    if (!doc || doc.template.code !== CLEANING_DOCUMENT_TEMPLATE_CODE) {
      return false;
    }
    const config = normalizeCleaningDocumentConfig(
      doc.config
    ) as CleaningDocumentConfig;

    // Rooms-mode: rowKey формата `room::{roomId}::cleaner::{cleanerUserId}`.
    // Создаём/обновляем JournalDocumentEntry с информацией кто и когда
    // убрался в этом помещении.
    const parsed = parseRoomsModeRowKey(rowKey);
    if (parsed && config.cleaningMode === "rooms") {
      return applyRoomsModeCompletion({
        documentId: doc.id,
        organizationId: doc.organizationId,
        roomId: parsed.roomId,
        cleanerUserId: parsed.cleanerUserId,
        dateKey: todayKey,
        completed,
      });
    }

    // Control-digest task: rowKey формата `control::{documentId}::{dateKey}`.
    // Контролёр проверил сводку за день — проставляем
    // controllerCompletedAt всем entries за этот dateKey.
    const ctrl = parseControlRowKey(rowKey);
    if (ctrl && config.cleaningMode === "rooms") {
      return applyControlCompletion({
        documentId: doc.id,
        controllerUserId: config.controlUserId ?? null,
        dateKey: ctrl.dateKey,
        completed,
      });
    }

    // Старая логика — pairs-mode: пишем mark в matrix.
    config.matrix = config.matrix ?? {};
    config.matrix[rowKey] = config.matrix[rowKey] ?? {};
    const before = config.matrix[rowKey][todayKey] ?? "";
    const next = completed
      ? config.autoFill?.defaultRoomMark || "✓"
      : "";
    if (before === next) return false;
    config.matrix[rowKey][todayKey] = next;
    await db.journalDocument.update({
      where: { id: doc.id },
      data: { config },
    });
    return true;
  },
};

/* =========================================================
 * Rooms-mode helpers
 * ========================================================= */

function buildRoomsModeRows(
  config: CleaningDocumentConfig,
  roomNameById: Map<string, string>,
  userNameById: Map<string, string>
): AdapterRow[] {
  const rooms = config.selectedRoomIds ?? [];
  const cleaners = config.selectedCleanerUserIds ?? [];
  if (rooms.length === 0 || cleaners.length === 0) return [];

  // 2026-05-04: ДВА режима через config.roomsRaceMode.
  //
  // RACE-MODE (config.roomsRaceMode === true):
  //   На каждую комнату задача СРАЗУ для всех выбранных уборщиков.
  //   В TasksFlow появляется N×M task'ов; кто первый отметит —
  //   остальные видят «выполнено другим». Подходит для гибких смен
  //   где уборщица сама решает что делать. После Stage 1 фикса
  //   selectRowsForBulkAssign сохраняет все rows (dedup by rowKey,
  //   не userId).
  //
  // ROUND-ROBIN (default — config.roomsRaceMode !== true):
  //   На каждую комнату ровно ОДИН уборщик (cleaners[i % M]).
  //   5 комнат × 2 уборщика → 5 task'ов: Маркова делает комнаты
  //   0,2,4, Захаров — 1,3. Каждый знает свой набор. Подходит
  //   для строгого распределения зон ответственности.
  // Per-room verifier resolver — приоритет verifierByRoomId[roomId]
  // → fallback controlUserId → fallback null (тогда bulk-assign
  // возьмёт document-wide doc.verifierUserId).
  const verifierByRoomId = config.verifierByRoomId ?? {};
  function verifierForRoom(roomId: string): string | null {
    return (
      verifierByRoomId[roomId] ?? config.controlUserId ?? null
    );
  }

  if (config.roomsRaceMode === true) {
    const rows: AdapterRow[] = [];
    for (const roomId of rooms) {
      const roomName = roomNameById.get(roomId) ?? "(удалённая комната)";
      for (const cleanerId of cleaners) {
        const cleanerName =
          userNameById.get(cleanerId) ?? "(удалённый сотрудник)";
        rows.push({
          rowKey: `room::${roomId}::cleaner::${cleanerId}`,
          label: `Уборка · ${roomName}`,
          sublabel: `Уборщик: ${cleanerName} (race — кто первый)`,
          responsibleUserId: cleanerId,
          verifierUserId: verifierForRoom(roomId),
        });
      }
    }
    return rows;
  }

  return rooms.map((roomId, idx) => {
    const cleanerId = cleaners[idx % cleaners.length];
    const roomName = roomNameById.get(roomId) ?? "(удалённая комната)";
    const cleanerName = userNameById.get(cleanerId) ?? "(удалённый сотрудник)";
    return {
      rowKey: `room::${roomId}::cleaner::${cleanerId}`,
      label: `Уборка · ${roomName}`,
      sublabel: `Уборщик: ${cleanerName}`,
      responsibleUserId: cleanerId,
      verifierUserId: verifierForRoom(roomId),
    };
  });
}

function parseRoomsModeRowKey(
  rowKey: string
): { roomId: string; cleanerUserId: string } | null {
  // Формат: `room::{roomId}::cleaner::{cleanerUserId}`
  const m = /^room::([^:]+)::cleaner::([^:]+)$/.exec(rowKey);
  if (!m) return null;
  return { roomId: m[1], cleanerUserId: m[2] };
}

export function parseControlRowKey(
  rowKey: string
): { documentId: string; dateKey: string } | null {
  // Формат: `control::{documentId}::{dateKey}`
  const m = /^control::([^:]+)::([0-9-]+)$/.exec(rowKey);
  if (!m) return null;
  return { documentId: m[1], dateKey: m[2] };
}

export function buildControlRowKey(documentId: string, dateKey: string): string {
  return `control::${documentId}::${dateKey}`;
}

async function applyControlCompletion(args: {
  documentId: string;
  controllerUserId: string | null;
  dateKey: string;
  completed: boolean;
}): Promise<boolean> {
  if (!args.completed || !args.controllerUserId) return false;
  const date = new Date(`${args.dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;

  // Находим все cleaning_room entries за эту дату, проставляем
  // controllerCompletedAt + controllerUserId.
  const entries = await db.journalDocumentEntry.findMany({
    where: {
      documentId: args.documentId,
      date,
      data: { path: ["kind"], equals: "cleaning_room" },
    },
    select: { id: true, data: true },
  });
  if (entries.length === 0) return false;

  const stamp = new Date().toISOString();
  for (const e of entries) {
    const prevData =
      e.data && typeof e.data === "object" && !Array.isArray(e.data)
        ? (e.data as Record<string, unknown>)
        : {};
    if (prevData.controllerCompletedAt) continue;
    await db.journalDocumentEntry.update({
      where: { id: e.id },
      data: {
        data: {
          ...prevData,
          controllerUserId: args.controllerUserId,
          controllerCompletedAt: stamp,
        },
      },
    });
  }
  return true;
}

/**
 * Race-resolution + persist завершения уборки помещения.
 *
 * Логика:
 *   - Если у этого documentId+roomId+dateKey уже есть завершённая
 *     запись (другой уборщик был первым) — возвращаем false без
 *     перезаписи. Race-победитель не меняется.
 *   - Иначе создаём JournalDocumentEntry с
 *     data: { kind, roomId, dateKey, cleanerUserId, completedAt }.
 *
 * Контролёр получит сводную задачу cron'ом cleaning-control-digest
 * (см. /api/cron/cleaning-control-digest) и его complete пометит
 * controllerCompletedAt всем сегодняшним entries дня.
 */
async function applyRoomsModeCompletion(args: {
  documentId: string;
  organizationId: string;
  roomId: string;
  cleanerUserId: string;
  dateKey: string;
  completed: boolean;
}): Promise<boolean> {
  if (!args.completed) {
    // Реоткрытие — не трогаем существующую запись (другой уборщик мог
    // её закрыть). Если хотим reopen — это явное действие, пока not implemented.
    return false;
  }

  // dateKey "YYYY-MM-DD" → Date (UTC midnight). Совпадает с тем как
  // hygiene-document.toDateKey работает.
  const date = new Date(`${args.dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;

  // Уже есть запись по этому (room, date) — другой уборщик был первым?
  // findFirst по data JSON-path — медленнее unique-constraint, но для
  // race-checking (1 раз на complete) acceptable.
  const existing = await db.journalDocumentEntry.findFirst({
    where: {
      documentId: args.documentId,
      date,
      AND: [
        { data: { path: ["roomId"], equals: args.roomId } },
        { data: { path: ["kind"], equals: "cleaning_room" } },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    // Race lost — другой cleaner был первым. TF-task pipeline всё равно
    // пометит remote как completed, но новую entry не создаём.
    return false;
  }

  // Idempotency через `(documentId, employeeId, date)` unique-constraint:
  // если этот же cleaner повторно дёрнул complete на той же задаче —
  // upsert не падает.
  await db.journalDocumentEntry.upsert({
    where: {
      documentId_employeeId_date: {
        documentId: args.documentId,
        employeeId: args.cleanerUserId,
        date,
      },
    },
    create: {
      documentId: args.documentId,
      employeeId: args.cleanerUserId,
      date,
      data: {
        kind: "cleaning_room",
        roomId: args.roomId,
        dateKey: args.dateKey,
        cleanerUserId: args.cleanerUserId,
        completedAt: new Date().toISOString(),
      },
    },
    update: {
      data: {
        kind: "cleaning_room",
        roomId: args.roomId,
        dateKey: args.dateKey,
        cleanerUserId: args.cleanerUserId,
        completedAt: new Date().toISOString(),
      },
    },
  });
  return true;
}
