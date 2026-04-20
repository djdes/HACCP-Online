/**
 * Bridge between WeSetup journal documents and TasksFlow tasks.
 *
 * Phase 1 scope: cleaning journal only. Each `responsiblePair` in a
 * cleaning document maps to one recurring TasksFlow task assigned to the
 * cleaning person (`pair.cleaningUserId`). When the cleaner marks the
 * task done in TasksFlow, the inbound webhook (or the poll endpoint)
 * writes the corresponding cell in the journal matrix.
 *
 * Failure policy: never block the journal save on a TasksFlow error.
 * Sync runs after the doc is persisted; failures are logged + counted
 * so they show up in the integration status, but the user keeps editing
 * their journal. Re-saving the doc retries the sync.
 */
import type { TasksFlowIntegration, TasksFlowUserLink } from "@prisma/client";
import { db } from "@/lib/db";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  type CleaningDocumentConfig,
  type CleaningResponsiblePair,
  normalizeCleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { toDateKey } from "@/lib/hygiene-document";
import {
  TasksFlowError,
  type TasksFlowTask,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";

export const CLEANING_TASK_CATEGORY = "WeSetup · Уборка";

/**
 * Default schedule: every weekday + weekend. Cleaning journals run
 * daily by default; we don't currently encode per-pair schedules in
 * `CleaningResponsiblePair`, so all-week is the safest mirror.
 *
 * If `config.skipWeekends` is true, drop Sat/Sun.
 *
 * TasksFlow `weekDays` uses 0=Sun ... 6=Sat (matches their schema.ts).
 */
function buildWeekDays(skipWeekends: boolean): number[] {
  return skipWeekends ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
}

function buildTitle(pair: CleaningResponsiblePair): string {
  const who = pair.cleaningUserName?.trim() || pair.cleaningTitle.trim() || "Уборка";
  return `Уборка · ${who}`;
}

function buildDescription(
  pair: CleaningResponsiblePair,
  documentTitle: string,
  dateFromIso: string,
  dateToIso: string
): string {
  const lines = [
    `Журнал: ${documentTitle}`,
    `Период: ${dateFromIso} — ${dateToIso}`,
  ];
  if (pair.controlUserName) {
    lines.push(`Контроль: ${pair.controlUserName} (${pair.controlTitle})`);
  }
  return lines.join("\n");
}

/**
 * Result of one sync pass — surfaces what changed so callers (the
 * patch hook, the poll endpoint, the UI) can show meaningful counts
 * without re-querying.
 */
export type CleaningSyncReport = {
  created: number;
  updated: number;
  deleted: number;
  skippedNoLink: string[]; // pair.id list
  errors: Array<{ pairId: string; message: string }>;
};

const EMPTY_REPORT: CleaningSyncReport = {
  created: 0,
  updated: 0,
  deleted: 0,
  skippedNoLink: [],
  errors: [],
};

type PrismaTaskLink = {
  id: string;
  rowKey: string;
  tasksflowTaskId: number;
};

/**
 * Push cleaning responsiblePairs to TasksFlow as recurring tasks. Idempotent:
 * - existing TaskLink for `(integration, document, pair.id)` → PUT update
 * - missing TaskLink + valid worker → POST create
 * - removed pair (TaskLink exists but pair gone) → DELETE
 *
 * `pair.id` is the natural row key. We never reuse the integer
 * TasksFlow taskId across pairs.
 */
export async function syncCleaningDocumentToTasksFlow(params: {
  documentId: string;
  organizationId: string;
}): Promise<CleaningSyncReport> {
  const { documentId, organizationId } = params;

  const doc = await db.journalDocument.findUnique({
    where: { id: documentId },
    include: { template: true },
  });
  if (!doc || doc.organizationId !== organizationId) return EMPTY_REPORT;
  if (doc.template.code !== CLEANING_DOCUMENT_TEMPLATE_CODE) return EMPTY_REPORT;
  if (doc.status === "closed") return EMPTY_REPORT;

  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId },
  });
  if (!integration || !integration.enabled) return EMPTY_REPORT;

  const config = normalizeCleaningDocumentConfig(doc.config) as CleaningDocumentConfig;
  const pairs = config.responsiblePairs ?? [];
  const links = await db.tasksFlowUserLink.findMany({
    where: { integrationId: integration.id },
    select: {
      wesetupUserId: true,
      tasksflowUserId: true,
      tasksflowWorkerId: true,
    },
  });
  const linkByUserId = new Map(links.map((l) => [l.wesetupUserId, l]));

  const existingTaskLinks = await db.tasksFlowTaskLink.findMany({
    where: {
      integrationId: integration.id,
      journalDocumentId: documentId,
    },
    select: { id: true, rowKey: true, tasksflowTaskId: true },
  });
  const taskLinkByRow = new Map<string, PrismaTaskLink>(
    existingTaskLinks.map((tl) => [tl.rowKey, tl])
  );

  const client = tasksflowClientFor(integration);
  const report: CleaningSyncReport = {
    created: 0,
    updated: 0,
    deleted: 0,
    skippedNoLink: [],
    errors: [],
  };

  const dateFromIso = toDateKey(doc.dateFrom);
  const dateToIso = toDateKey(doc.dateTo);
  const weekDays = buildWeekDays(Boolean(config.skipWeekends));
  const seenRowKeys = new Set<string>();

  for (const pair of pairs) {
    seenRowKeys.add(pair.id);

    const cleaningUserId = pair.cleaningUserId;
    if (!cleaningUserId) {
      report.skippedNoLink.push(pair.id);
      continue;
    }
    const link = linkByUserId.get(cleaningUserId);
    const remoteUserId = link?.tasksflowUserId ?? null;
    if (!remoteUserId) {
      report.skippedNoLink.push(pair.id);
      continue;
    }

    const payload = {
      title: buildTitle(pair),
      workerId: remoteUserId,
      requiresPhoto: false,
      isRecurring: true,
      weekDays,
      category: CLEANING_TASK_CATEGORY,
      description: buildDescription(pair, doc.title, dateFromIso, dateToIso),
    };

    const existing = taskLinkByRow.get(pair.id);
    try {
      if (existing) {
        await client.updateTask(existing.tasksflowTaskId, payload);
        await db.tasksFlowTaskLink.update({
          where: { id: existing.id },
          data: { lastDirection: "push", updatedAt: new Date() },
        });
        report.updated += 1;
      } else {
        const created = await client.createTask(payload);
        await db.tasksFlowTaskLink.create({
          data: {
            integrationId: integration.id,
            journalCode: doc.template.code,
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
      report.errors.push({ pairId: pair.id, message: msg });
    }
  }

  // Delete TaskLinks whose pair was removed from the journal.
  for (const tl of existingTaskLinks) {
    if (seenRowKeys.has(tl.rowKey)) continue;
    try {
      await client.deleteTask(tl.tasksflowTaskId);
    } catch (err) {
      // Already gone on the remote side is fine; everything else gets
      // logged but we still drop our local link so the row doesn't get
      // stuck pointing at a dangling task forever.
      const status =
        err instanceof TasksFlowError ? err.status : 0;
      if (status !== 404) {
        report.errors.push({
          pairId: tl.rowKey,
          message: `delete: ${
            err instanceof Error ? err.message : "unknown"
          }`,
        });
      }
    }
    await db.tasksFlowTaskLink.delete({ where: { id: tl.id } }).catch(() => null);
    report.deleted += 1;
  }

  await db.tasksFlowIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });

  return report;
}

/**
 * Pull-side completion sync. Walks every `TasksFlowTaskLink` for the
 * org, fetches each task's current state, and (when newly completed)
 * marks today's cell in the journal matrix as the "default" cleaning
 * mark.
 *
 * `getTodayKey()` is injected so tests can pin a date.
 *
 * Returns counts so the UI / cron can report.
 */
export async function pullCompletionsForOrganization(params: {
  organizationId: string;
  todayKey?: string;
}): Promise<{
  checked: number;
  newlyCompleted: number;
  reopened: number;
  errors: number;
}> {
  const { organizationId } = params;
  const todayKey =
    params.todayKey ?? toDateKey(new Date());

  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId },
  });
  if (!integration || !integration.enabled) {
    return { checked: 0, newlyCompleted: 0, reopened: 0, errors: 0 };
  }

  const taskLinks = await db.tasksFlowTaskLink.findMany({
    where: { integrationId: integration.id },
  });
  if (taskLinks.length === 0) {
    return { checked: 0, newlyCompleted: 0, reopened: 0, errors: 0 };
  }

  const client = tasksflowClientFor(integration);
  let newlyCompleted = 0;
  let reopened = 0;
  let errors = 0;

  // Group by document to amortise the journal load.
  const linksByDoc = new Map<string, typeof taskLinks>();
  for (const tl of taskLinks) {
    const list = linksByDoc.get(tl.journalDocumentId) ?? [];
    list.push(tl);
    linksByDoc.set(tl.journalDocumentId, list);
  }

  for (const [documentId, docLinks] of linksByDoc) {
    const doc = await db.journalDocument.findUnique({
      where: { id: documentId },
      include: { template: true },
    });
    if (!doc || doc.template.code !== CLEANING_DOCUMENT_TEMPLATE_CODE) continue;
    const config = normalizeCleaningDocumentConfig(doc.config) as CleaningDocumentConfig;
    let configChanged = false;

    for (const link of docLinks) {
      let task: TasksFlowTask;
      try {
        task = await client.getTask(link.tasksflowTaskId);
      } catch (err) {
        // 404 → task deleted on TasksFlow side; drop the local link so we
        // stop polling for it. Anything else just bumps the error count.
        if (err instanceof TasksFlowError && err.status === 404) {
          await db.tasksFlowTaskLink
            .delete({ where: { id: link.id } })
            .catch(() => null);
          continue;
        }
        errors += 1;
        continue;
      }

      const wasCompleted = link.remoteStatus === "completed";
      if (task.isCompleted && !wasCompleted) {
        // Newly completed → write today's cell.
        config.matrix = config.matrix ?? {};
        config.matrix[link.rowKey] = config.matrix[link.rowKey] ?? {};
        config.matrix[link.rowKey][todayKey] =
          config.autoFill?.defaultRoomMark || "✓";
        configChanged = true;
        await db.tasksFlowTaskLink.update({
          where: { id: link.id },
          data: {
            remoteStatus: "completed",
            completedAt: new Date(),
            lastDirection: "pull",
          },
        });
        newlyCompleted += 1;
      } else if (!task.isCompleted && wasCompleted) {
        await db.tasksFlowTaskLink.update({
          where: { id: link.id },
          data: { remoteStatus: "active", lastDirection: "pull" },
        });
        reopened += 1;
      }
    }

    if (configChanged) {
      await db.journalDocument.update({
        where: { id: doc.id },
        data: { config },
      });
    }
  }

  await db.tasksFlowIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });

  return {
    checked: taskLinks.length,
    newlyCompleted,
    reopened,
    errors,
  };
}

/**
 * Look up which (organization, link) a TasksFlow webhook payload refers
 * to. Used by `/api/webhooks/tasksflow/task-complete` after HMAC check.
 */
export async function findTaskLinkByRemoteId(remoteTaskId: number): Promise<{
  link: { id: string; remoteStatus: string; rowKey: string; journalDocumentId: string };
  integration: TasksFlowIntegration;
} | null> {
  const link = await db.tasksFlowTaskLink.findFirst({
    where: { tasksflowTaskId: remoteTaskId },
    include: { integration: true },
  });
  if (!link) return null;
  return {
    link: {
      id: link.id,
      remoteStatus: link.remoteStatus,
      rowKey: link.rowKey,
      journalDocumentId: link.journalDocumentId,
    },
    integration: link.integration,
  };
}

/**
 * Idempotent cell-mark used by both the webhook and the pull endpoint.
 * Returns `true` when the document config was actually changed.
 */
export async function applyRemoteCompletion(params: {
  documentId: string;
  rowKey: string;
  completed: boolean;
  todayKey?: string;
}): Promise<boolean> {
  const todayKey = params.todayKey ?? toDateKey(new Date());
  const doc = await db.journalDocument.findUnique({
    where: { id: params.documentId },
    include: { template: true },
  });
  if (!doc || doc.template.code !== CLEANING_DOCUMENT_TEMPLATE_CODE) return false;
  const config = normalizeCleaningDocumentConfig(doc.config) as CleaningDocumentConfig;
  config.matrix = config.matrix ?? {};
  config.matrix[params.rowKey] = config.matrix[params.rowKey] ?? {};
  const before = config.matrix[params.rowKey][todayKey] ?? "";
  const next = params.completed ? config.autoFill?.defaultRoomMark || "✓" : "";
  if (before === next) return false;
  config.matrix[params.rowKey][todayKey] = next;
  await db.journalDocument.update({
    where: { id: doc.id },
    data: { config },
  });
  return true;
}
