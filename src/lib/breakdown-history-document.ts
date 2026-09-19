import { localDayKey } from "@/lib/entry-defaults";
import { normalizeSourceEquipmentId } from "@/lib/equipment-directory-link";

export const BREAKDOWN_HISTORY_TEMPLATE_CODE = "breakdown_history";
export const BREAKDOWN_HISTORY_SOURCE_SLUG = "breakdownhistoryjournal";
export const BREAKDOWN_HISTORY_HEADING = "Карточка истории поломок";
export const BREAKDOWN_HISTORY_DOCUMENT_TITLE = "Карточка истории поломок";

export type BreakdownRow = {
  id: string;
  startDate: string;
  startHour: string;
  startMinute: string;
  /** Ссылка на `Equipment`: переименование в справочнике доходит до записи. */
  sourceEquipmentId: string | null;
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
  // Дата по местным часам: UTC до 03:00 в Москве давал вчерашнее число.
  const today = localDayKey();
  return {
    id: overrides?.id || createId("breakdown-row"),
    startDate: normalizeText(overrides?.startDate) || today,
    startHour: normalizeText(overrides?.startHour) || "00",
    startMinute: normalizeText(overrides?.startMinute) || "00",
    sourceEquipmentId: normalizeSourceEquipmentId(overrides?.sourceEquipmentId),
    equipmentName: normalizeText(overrides?.equipmentName),
    breakdownDescription: normalizeText(overrides?.breakdownDescription),
    repairPerformed: normalizeText(overrides?.repairPerformed),
    partsReplaced: normalizeText(overrides?.partsReplaced),
    // ПОЧЕМУ пусто: поломку заводят в момент, когда её ещё не починили.
    // Раньше окончание по умолчанию было «сегодня 00:00» — журнал
    // показывал ремонт законченным до того, как он начался.
    endDate: normalizeText(overrides?.endDate),
    endHour: normalizeText(overrides?.endHour),
    endMinute: normalizeText(overrides?.endMinute),
    downtimeHours: normalizeText(overrides?.downtimeHours),
    responsiblePerson: normalizeText(overrides?.responsiblePerson),
  };
}

/** `YYYY-MM-DDTHH:MM` — строки такого вида сравнимы лексикографически. */
function toSortableStamp(date: string, hour: string, minute: string) {
  return `${date}T${(hour || "00").padStart(2, "0")}:${(minute || "00").padStart(2, "0")}`;
}

/**
 * Проверка «окончание не раньше начала». Пустое окончание — законно:
 * ремонт ещё идёт.
 */
export function getBreakdownRowDateError(row: BreakdownRow): string | null {
  if (!row.startDate || !row.endDate) return null;
  const start = toSortableStamp(row.startDate, row.startHour, row.startMinute);
  const end = toSortableStamp(row.endDate, row.endHour, row.endMinute);
  return end < start
    ? "Окончание работ не может быть раньше их начала"
    : null;
}

/** Метка окончания работ для таблицы и карточек; пусто — ремонт не закончен. */
export function formatBreakdownEnd(row: BreakdownRow): string {
  if (!row.endDate) return "";
  const [year, month, day] = row.endDate.split("-");
  const dateLabel = year && month && day ? `${day}-${month}-${year}` : row.endDate;
  if (!row.endHour && !row.endMinute) return dateLabel;
  return `${dateLabel} ${(row.endHour || "00").padStart(2, "0")}:${(row.endMinute || "00").padStart(2, "0")}`;
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
