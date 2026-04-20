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
        rows: (config.responsiblePairs ?? []).map<AdapterRow>((pair) => ({
          rowKey: pair.id,
          label: pair.cleaningUserName || pair.cleaningTitle,
          sublabel: pair.controlUserName
            ? `Контроль: ${pair.controlUserName}`
            : pair.controlTitle,
          responsibleUserId: pair.cleaningUserId,
        })),
      };
      // Stash extra context the schedule/description hooks need —
      // typed as private extras so types.ts stays journal-agnostic.
      (adapterDoc as AdapterDocument & {
        _skipWeekends?: boolean;
        _control?: string;
      })._skipWeekends = Boolean(config.skipWeekends);
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
