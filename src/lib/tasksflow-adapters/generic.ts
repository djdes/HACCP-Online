/**
 * Universal fallback adapter — applied to every active journal that
 * doesn't have a hand-rolled specific adapter.
 *
 * Provides the simplest contract the user agreed to:
 *   • admin in TasksFlow → picks a journal + workers + free-text task
 *   • worker → sees a textual confirmation + optional comment field +
 *     «Я выполнил» button
 *   • on completion → JournalDocumentEntry is appended with
 *     `{source: "tasksflow", comment, completedAt, taskTitle}`
 *
 * The journal in WeSetup gets the entry on the responsible employee
 * for today's date. It won't fill specific journal columns
 * automatically (that requires a per-journal adapter), but it
 * provides full audit trail with source attribution.
 *
 * Specific adapters (`hygiene.ts`, `cleaning.ts`) override this
 * universal behaviour with structured form fields when a journal's
 * shape allows for it.
 */
import { db } from "@/lib/db";
import { FILLING_GUIDES } from "@/lib/journal-filling-guides";
import {
  EMPTY_SYNC_REPORT,
  type AdapterDocument,
  type AdapterRow,
  type JournalAdapter,
  type TaskSchedule,
} from "./types";
import type { PipelineStep, TaskFormSchema } from "./task-form";
import { extractEmployeeId, rowKeyForEmployee } from "./row-key";

const COMMENT_FIELD = {
  type: "text" as const,
  key: "comment",
  label: "Комментарий (необязательно)",
  multiline: true,
  maxLength: 500,
  placeholder: "Например: всё в порядке, замечаний нет",
};

/**
 * Build a pipeline-driven form for journals that have a filling-guide.
 * Each guide step becomes a confirmation step; worker has to tap
 * «Сделал» on each before reaching the final comment + submit.
 *
 * If the journal has no guide entry, returns the legacy single-step
 * form (just a comment + Готово).
 *
 * `requirePhoto` — если true, к каждому action-шагу (кроме
 * «Что взять» и «Завершение») добавляется требование фото.
 */
function buildGenericForm(
  templateCode: string,
  options: { requirePhoto: boolean }
): TaskFormSchema {
  const guide = FILLING_GUIDES[templateCode];
  if (!guide || !guide.steps || guide.steps.length === 0) {
    return {
      intro:
        "Подтвердите выполнение задачи. Можно оставить комментарий — он " +
        "сохранится в журнал WeSetup как запись.",
      submitLabel: "Готово",
      fields: [COMMENT_FIELD],
    };
  }
  // Material-step prepended only if there are materials — это
  // помогает сотруднику собрать всё нужное прежде чем идти на смену.
  const steps: PipelineStep[] = [];
  if (guide.materials && guide.materials.length > 0) {
    steps.push({
      id: "materials",
      title: "Что взять с собой",
      detail: guide.materials.map((m) => `• ${m}`).join("\n"),
      hint: guide.summary,
      // Materials-шаг — это «прочитай и собери», фото не нужно.
      requirePhoto: false,
    });
  }
  for (let i = 0; i < guide.steps.length; i += 1) {
    const step = guide.steps[i];
    steps.push({
      id: `step-${i + 1}`,
      title: step.title,
      detail: step.detail,
      requirePhoto: options.requirePhoto,
    });
  }
  steps.push({
    id: "completion",
    title: "Завершение",
    detail: guide.completionCriteria,
    hint: guide.regulationRef,
    // Финальный шаг — резюме, фото не нужно (комментарий обязательнее).
    requirePhoto: false,
  });
  return {
    intro: guide.summary,
    submitLabel: "Готово — записать в журнал",
    pipeline: steps,
    fields: [COMMENT_FIELD],
  };
}

const employeeIdFromRowKey = extractEmployeeId;

/**
 * Build a generic adapter for any journal template. The label/icon
 * come from `JournalTemplate` row in DB at registry build time, so
 * the catalog UI shows real journal names not «Generic».
 */
export function buildGenericAdapter(
  templateCode: string,
  label: string
): JournalAdapter {
  return {
    meta: {
      templateCode,
      label,
      description:
        "Свободная задача с подтверждением выполнения и записью в журнал.",
      iconName: "clipboard-check",
    },

    scheduleForRow(_row, _doc): TaskSchedule {
      return { weekDays: [0, 1, 2, 3, 4, 5, 6] };
    },

    titleForRow(row): string {
      return row.label;
    },

    descriptionForRow(_row, doc): string {
      return [
        `Журнал: ${doc.documentTitle}`,
        `Период: ${doc.period.from} — ${doc.period.to}`,
      ].join("\n");
    },

    async listDocumentsForOrg(organizationId): Promise<AdapterDocument[]> {
      const [docs, employees] = await Promise.all([
        db.journalDocument.findMany({
          where: {
            organizationId,
            status: "active",
            template: { code: templateCode },
          },
          select: {
            id: true,
            title: true,
            dateFrom: true,
            dateTo: true,
          },
          orderBy: { dateFrom: "desc" },
        }),
        db.user.findMany({
          where: { organizationId, isActive: true },
          select: {
            id: true,
            name: true,
            role: true,
            positionTitle: true,
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
      ]);

      const toDateKey = (d: Date) => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      };

      return docs.map<AdapterDocument>((doc) => ({
        documentId: doc.id,
        documentTitle: doc.title,
        period: { from: toDateKey(doc.dateFrom), to: toDateKey(doc.dateTo) },
        rows: employees.map<AdapterRow>((emp) => ({
          rowKey: rowKeyForEmployee(emp.id),
          label: emp.name,
          sublabel: emp.positionTitle ?? undefined,
          responsibleUserId: emp.id,
        })),
      }));
    },

    async syncDocument() {
      // Generic adapter is admin-driven (push from TF UI), no
      // PATCH-time auto-sync.
      return EMPTY_SYNC_REPORT;
    },

    async getTaskForm(input) {
      // Достаём org-настройку «Требовать фото на каждом шаге». input
      // содержит documentId — через него вытаскиваем organizationId
      // (быстрее чем join из адаптера). Best-effort: если запрос
      // упадёт, считаем что фото не требуется.
      let requirePhoto = false;
      try {
        const doc = await db.journalDocument.findUnique({
          where: { id: input.documentId },
          select: {
            organization: {
              select: { requirePhotoOnTaskFillStep: true },
            },
          },
        });
        requirePhoto = Boolean(doc?.organization?.requirePhotoOnTaskFillStep);
      } catch {
        requirePhoto = false;
      }
      return buildGenericForm(templateCode, { requirePhoto });
    },

    async applyRemoteCompletion({ documentId, rowKey, completed, todayKey, values }) {
      if (!completed) return false;
      const employeeId = employeeIdFromRowKey(rowKey);
      // Free-text rowKeys (`freetask:…`) — no employee binding; in
      // that case we'd need to look up the worker via TaskLink. For
      // simplicity, only handle adapter-row-bound case.
      if (!employeeId) return false;

      const dateObj = new Date(`${todayKey}T00:00:00.000Z`);
      if (Number.isNaN(dateObj.getTime())) return false;

      const comment =
        typeof values?.comment === "string" ? values.comment.trim() : "";

      // Pipeline trail: client sends `_pipeline` блоб с timeline
      // подтверждений (см. task-fill-client). Сохраняем это в data
      // как evidence trail — манагер увидит что worker реально
      // прошёл через все шаги, а не просто нажал Готово.
      const pipelineTrail = (() => {
        const raw = (values as Record<string, unknown> | undefined)?._pipeline;
        if (!raw || typeof raw !== "object") return null;
        const steps = (raw as { steps?: unknown }).steps;
        if (!Array.isArray(steps) || steps.length === 0) return null;
        return raw;
      })();

      const data = {
        source: "tasksflow",
        templateCode,
        completedAt: new Date().toISOString(),
        ...(comment ? { comment } : {}),
        ...(pipelineTrail ? { pipeline: pipelineTrail } : {}),
      };

      await db.journalDocumentEntry.upsert({
        where: {
          documentId_employeeId_date: {
            documentId,
            employeeId,
            date: dateObj,
          },
        },
        create: {
          documentId,
          employeeId,
          date: dateObj,
          data,
        },
        update: { data },
      });
      return true;
    },
  };
}
