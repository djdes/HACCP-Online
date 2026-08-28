export const BREAKDOWN_HISTORY_TEMPLATE_CODE = "breakdown_history";
export const BREAKDOWN_HISTORY_SOURCE_SLUG = "breakdownhistoryjournal";
export const BREAKDOWN_HISTORY_HEADING = "Карточка истории поломок";
export const BREAKDOWN_HISTORY_DOCUMENT_TITLE = "Карточка истории поломок";

export type BreakdownRow = {
  id: string;
  startDate: string;
  startHour: string;
  startMinute: string;
  equipmentName: string;
  breakdownDescription: string;
  repairPerformed: string;
  partsReplaced: string;
  endDate: string;
  endHour: string;
  endMinute: string;
  downtimeHours: string;
  responsiblePerson: string;
};

export type BreakdownHistoryDocumentConfig = {
  rows: BreakdownRow[];
};

function createId(prefix: string) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function createBreakdownRow(
  overrides?: Partial<BreakdownRow>
): BreakdownRow {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: overrides?.id || createId("breakdown-row"),
    startDate: normalizeText(overrides?.startDate) || today,
    startHour: normalizeText(overrides?.startHour) || "00",
    startMinute: normalizeText(overrides?.startMinute) || "00",
    equipmentName: normalizeText(overrides?.equipmentName),
    breakdownDescription: normalizeText(overrides?.breakdownDescription),
    repairPerformed: normalizeText(overrides?.repairPerformed),
    partsReplaced: normalizeText(overrides?.partsReplaced),
    endDate: normalizeText(overrides?.endDate) || today,
    endHour: normalizeText(overrides?.endHour) || "00",
    endMinute: normalizeText(overrides?.endMinute) || "00",
    downtimeHours: normalizeText(overrides?.downtimeHours),
    responsiblePerson: normalizeText(overrides?.responsiblePerson),
  };
}

export function getBreakdownHistoryDefaultConfig(): BreakdownHistoryDocumentConfig {
  // ПОЧЕМУ пусто: журнал предъявляют инспектору. Раньше здесь лежала
  // готовая «поломка весов 28.10.2021» — в свежем документе это запись
  // о событии, которого не было. Строки заводит сотрудник по факту.
  return {
    rows: [],
  };
}

export function normalizeBreakdownHistoryDocumentConfig(
  value: unknown
): BreakdownHistoryDocumentConfig {
  const fallback = getBreakdownHistoryDefaultConfig();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.rows)
    ? record.rows
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item))
            return null;
          return createBreakdownRow(item as Partial<BreakdownRow>);
        })
        .filter((item): item is BreakdownRow => item !== null)
    : [];

  return {
    rows,
  };
}
