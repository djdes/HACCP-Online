/**
 * Generic dispatcher between WeSetup journals and TasksFlow tasks.
 *
 * Per-journal logic lives in `src/lib/tasksflow-adapters/*`. This file
 * is a thin coordinator: routes documents to the right adapter, walks
 * remote task statuses for completion sync, and resolves webhooks back
 * to journal cells.
 *
 * Add a new journal? Don't touch this file — register an adapter in
 * `src/lib/tasksflow-adapters/index.ts` and the rest follows.
 *
 * Failure policy: never block the journal save on TasksFlow. Sync
 * runs after the local persist; failures are logged + surfaced via
 * `lastSyncAt` and the report shape so the user knows.
 */
import type { TasksFlowIntegration } from "@prisma/client";
import { db } from "@/lib/db";
import { toDateKey } from "@/lib/hygiene-document";
import {
  TasksFlowError,
  type TasksFlowTask,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";
import { getIntegrationCryptoErrorMessage } from "@/lib/integration-crypto";
import {
  getAdapter,
  listAdapters,
  type JournalSyncReport,
} from "@/lib/tasksflow-adapters";
import { EMPTY_SYNC_REPORT } from "@/lib/tasksflow-adapters/types";

function failedSyncReport(error: unknown): JournalSyncReport {
  return {
    ...EMPTY_SYNC_REPORT,
    errors: [
      {
        rowKey: "*",
        message: getIntegrationCryptoErrorMessage(error),
      },
    ],
  };
}

/**
 * Sync a single document to TasksFlow. Routes to the registered
 * adapter for the document's template code; returns EMPTY_REPORT for
 * documents whose template doesn't (yet) have an adapter.
 */
export async function syncDocumentToTasksFlow(params: {
  documentId: string;
  organizationId: string;
}): Promise<JournalSyncReport> {
  const { documentId, organizationId } = params;
  const doc = await db.journalDocument.findUnique({
    where: { id: documentId },
    include: { template: true },
  });
  if (!doc || doc.organizationId !== organizationId) return EMPTY_SYNC_REPORT;

  const adapter = getAdapter(doc.template.code);
  if (!adapter) return EMPTY_SYNC_REPORT;

  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId },
  });
  if (!integration || !integration.enabled) return EMPTY_SYNC_REPORT;

  let report: JournalSyncReport;
  try {
    report = await adapter.syncDocument({
      integration,
      documentId,
    });
  } catch (error) {
    console.error("[tasksflow-sync] document sync failed", error);
    return failedSyncReport(error);
  }
  await db.tasksFlowIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });
  return report;
}

/**
 * Backwards-compat shim — the cleaning hook in `journal-documents/[id]`
 * still imports this name. Kept so we don't have to refactor every
 * touchpoint in this iteration.
 */
export const syncCleaningDocumentToTasksFlow = syncDocumentToTasksFlow;

/**
 * Pull-side completion sync. Walks every `TasksFlowTaskLink` for the
 * org, fetches each task's current state, and (when newly completed
 * or reopened) lets the right adapter mirror the change back.
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
  const todayKey = params.todayKey ?? toDateKey(new Date());

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

  let client: ReturnType<typeof tasksflowClientFor>;
  try {
    client = tasksflowClientFor(integration);
  } catch (error) {
    console.error("[tasksflow-sync] pull skipped", error);
    return {
      checked: taskLinks.length,
      newlyCompleted: 0,
      reopened: 0,
      errors: Math.max(1, taskLinks.length),
    };
  }
  let newlyCompleted = 0;
  let reopened = 0;
  let errors = 0;

  for (const link of taskLinks) {
    const adapter = getAdapter(link.journalCode);
    if (!adapter) continue;

    let task: TasksFlowTask;
    try {
      task = await client.getTask(link.tasksflowTaskId);
    } catch (err) {
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
      const changed = await adapter.applyRemoteCompletion({
        documentId: link.journalDocumentId,
        rowKey: link.rowKey,
        completed: true,
        todayKey,
      });
      if (changed) newlyCompleted += 1;
      await db.tasksFlowTaskLink.update({
        where: { id: link.id },
        data: {
          remoteStatus: "completed",
          completedAt: new Date(),
          lastDirection: "pull",
        },
      });
    } else if (!task.isCompleted && wasCompleted) {
      await db.tasksFlowTaskLink.update({
        where: { id: link.id },
        data: { remoteStatus: "active", lastDirection: "pull" },
      });
      reopened += 1;
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
 * Webhook resolution: given a remote task id from TasksFlow, find the
 * link + integration so we can verify the HMAC and apply the cell.
 */
export async function findTaskLinkByRemoteId(remoteTaskId: number): Promise<{
  link: {
    id: string;
    remoteStatus: string;
    rowKey: string;
    journalDocumentId: string;
    journalCode: string;
  };
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
      journalCode: link.journalCode,
    },
    integration: link.integration,
  };
}

/**
 * Idempotent cell-mark used by the webhook endpoint. Routes through
 * the right adapter based on the link's `journalCode`.
 */
export async function applyRemoteCompletion(params: {
  documentId: string;
  rowKey: string;
  journalCode: string;
  completed: boolean;
  todayKey?: string;
}): Promise<boolean> {
  const adapter = getAdapter(params.journalCode);
  if (!adapter) return false;
  return adapter.applyRemoteCompletion({
    documentId: params.documentId,
    rowKey: params.rowKey,
    completed: params.completed,
    todayKey: params.todayKey ?? toDateKey(new Date()),
  });
}

/** Used by the catalog endpoint. */
export { listAdapters };
