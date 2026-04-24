import type { ManagerScope } from "@/lib/manager-scope";
import type { AdapterRow } from "@/lib/tasksflow-adapters/types";

export type BulkJournalTemplate = {
  id: string;
  code: string;
  name: string;
};

export type BulkJournalSkip = {
  template: BulkJournalTemplate;
  reason: string;
};

export type BulkRowSelection = {
  rows: AdapterRow[];
  alreadyLinked: number;
  skipReason?: string;
};

export const PER_EMPLOYEE_BULK_ASSIGN_CODES = new Set<string>([
  "hygiene",
  "health_check",
]);

export function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === "string")
    : [];
}

export function isPerEmployeeBulkJournal(journalCode: string): boolean {
  return PER_EMPLOYEE_BULK_ASSIGN_CODES.has(journalCode);
}

export function canBulkAssignJournal(
  scope: Pick<ManagerScope, "assignableJournalCodes"> | null,
  journalCode: string
): boolean {
  if (!scope) return true;
  if (scope.assignableJournalCodes.length === 0) return true;
  return scope.assignableJournalCodes.includes(journalCode);
}

export function selectBulkJournalTemplates(args: {
  templates: BulkJournalTemplate[];
  disabledCodes: Set<string>;
  filledTemplateIds: Set<string>;
  scope: Pick<ManagerScope, "assignableJournalCodes"> | null;
}): { targets: BulkJournalTemplate[]; skipped: BulkJournalSkip[] } {
  const targets: BulkJournalTemplate[] = [];
  const skipped: BulkJournalSkip[] = [];

  for (const template of args.templates) {
    if (args.disabledCodes.has(template.code)) continue;
    if (args.filledTemplateIds.has(template.id)) continue;

    if (!canBulkAssignJournal(args.scope, template.code)) {
      skipped.push({
        template,
        reason: "Журнал не разрешён этому менеджеру в иерархии",
      });
      continue;
    }

    targets.push(template);
  }

  return { targets, skipped };
}

function noEligibleRowReason(args: {
  rows: AdapterRow[];
  onDutyUserIds: Set<string>;
  linkedUserIds: Set<string>;
}): string {
  if (args.onDutyUserIds.size === 0) {
    return "В иерархии нет сотрудников для назначения";
  }

  const responsibleRows = args.rows.filter((row) => row.responsibleUserId);
  if (responsibleRows.length === 0) {
    return "В журнале не указан ответственный сотрудник";
  }

  const onDutyRows = responsibleRows.filter((row) =>
    args.onDutyUserIds.has(row.responsibleUserId ?? "")
  );
  if (onDutyRows.length === 0) {
    return "Ответственные по журналу не стоят в смене сегодня";
  }

  const linkedRows = onDutyRows.filter((row) =>
    args.linkedUserIds.has(row.responsibleUserId ?? "")
  );
  if (linkedRows.length === 0) {
    return "Дежурные ответственные не привязаны к TasksFlow";
  }

  return "Нет подходящей строки для назначения в TasksFlow";
}

export function selectRowsForBulkAssign(args: {
  journalCode: string;
  rows: AdapterRow[];
  takenRowKeys: Set<string>;
  onDutyUserIds: Set<string>;
  linkedUserIds: Set<string>;
}): BulkRowSelection {
  const perEmployee = isPerEmployeeBulkJournal(args.journalCode);

  if (!perEmployee && args.takenRowKeys.size > 0) {
    return { rows: [], alreadyLinked: 1 };
  }

  const responsibleRows = args.rows.filter((row) => row.responsibleUserId);
  const onDutyRows = responsibleRows.filter((row) =>
    args.onDutyUserIds.has(row.responsibleUserId ?? "")
  );
  const linkedOnDutyRows = onDutyRows.filter((row) =>
    args.linkedUserIds.has(row.responsibleUserId ?? "")
  );

  if (linkedOnDutyRows.length === 0) {
    return {
      rows: [],
      alreadyLinked: 0,
      skipReason: noEligibleRowReason(args),
    };
  }

  if (!perEmployee) {
    const firstAvailable = linkedOnDutyRows.find(
      (row) => !args.takenRowKeys.has(row.rowKey)
    );
    if (!firstAvailable) {
      return { rows: [], alreadyLinked: 1 };
    }
    return { rows: [firstAvailable], alreadyLinked: 0 };
  }

  const unlinkedOnDutyRows = onDutyRows.filter(
    (row) => !args.linkedUserIds.has(row.responsibleUserId ?? "")
  );
  if (unlinkedOnDutyRows.length > 0) {
    return {
      rows: [],
      alreadyLinked: 0,
      skipReason: "Не все дежурные ответственные привязаны к TasksFlow",
    };
  }

  const rowsToCreate = linkedOnDutyRows.filter(
    (row) => !args.takenRowKeys.has(row.rowKey)
  );
  const alreadyLinked = linkedOnDutyRows.length - rowsToCreate.length;

  if (rowsToCreate.length === 0) {
    return { rows: [], alreadyLinked };
  }

  return { rows: rowsToCreate, alreadyLinked };
}
