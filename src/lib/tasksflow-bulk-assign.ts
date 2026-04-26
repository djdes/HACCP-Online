import type { ManagerScope } from "@/lib/manager-scope";
import { PER_EMPLOYEE_DAILY_JOURNAL_CODES } from "@/lib/daily-journal-codes";
import type { AdapterRow } from "@/lib/tasksflow-adapters/types";

export type BulkJournalTemplate = {
  id: string;
  code: string;
  name: string;
  /** Премия за выполнение в копейках. Если > 0 — задача отправляется
   *  всем eligible сотрудникам (race-for-bonus), а не одному. */
  bonusAmountKopecks?: number;
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

export function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === "string")
    : [];
}

export function isPerEmployeeBulkJournal(journalCode: string): boolean {
  return PER_EMPLOYEE_DAILY_JOURNAL_CODES.has(journalCode);
}

/**
 * Журналы, которые ведутся ОДНОЙ КОМАНДОЙ — любой из ответственных
 * может закрыть запись от лица команды. Задача fan-out'ится на всех
 * eligible; первый кто сделает — у остальных карточка автоматически
 * уходит в «Сделано другими» (claimedByWorkerId выставляется на
 * стороне TasksFlow). Отличие от bonus-fan-out: денег не начисляем,
 * но это удобный race-for-completion для смены из N человек.
 */
const TEAM_FAN_OUT_CODES = new Set<string>([
  "intensive_cooling",              // повара горячего цеха
  "fryer_oil",                      // фритюр — те же повара
  "uv_lamp_runtime",                // УФ-лампа — уборщики/менеджер
  "cleaning_ventilation_checklist", // уборка-проветривание — команда
  "disinfectant_usage",             // дезсредства — кто доставал
  "climate_control",                // замер t°/влажности — кто в смене
  "cold_equipment_control",         // замер холодильников — повара
]);

export function isTeamFanOutJournal(journalCode: string): boolean {
  return TEAM_FAN_OUT_CODES.has(journalCode);
}

/**
 * Должна ли задача рассылаться всем eligible-сотрудникам (а не одному).
 *
 * Случаи:
 *   1. Per-employee журнал (hygiene / health_check) — каждый ведёт сам.
 *   2. Team-журнал (intensive_cooling, fryer_oil, …) — fan-out на всех
 *      eligible, первый закрывает у остальных.
 *   3. Журнал с премией > 0 — все видят, кто первый сделал, тому бонус
 *      (race-for-bonus).
 */
export function shouldFanOutToAll(template: {
  code: string;
  bonusAmountKopecks?: number;
}): boolean {
  if (isPerEmployeeBulkJournal(template.code)) return true;
  if (isTeamFanOutJournal(template.code)) return true;
  if ((template.bonusAmountKopecks ?? 0) > 0) return true;
  return false;
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
  /** Премия за журнал в копейках. Опциональна для обратной совместимости
   *  тестов; если опущена — fan-out только для per-employee. */
  bonusAmountKopecks?: number;
  rows: AdapterRow[];
  takenRowKeys: Set<string>;
  onDutyUserIds: Set<string>;
  linkedUserIds: Set<string>;
}): BulkRowSelection {
  const fanOutToAll = shouldFanOutToAll({
    code: args.journalCode,
    bonusAmountKopecks: args.bonusAmountKopecks,
  });

  if (!fanOutToAll && args.takenRowKeys.size > 0) {
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

  if (!fanOutToAll) {
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
