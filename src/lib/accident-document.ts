export const ACCIDENT_DOCUMENT_TEMPLATE_CODE = "accident_journal";
export const ACCIDENT_DOCUMENT_SOURCE_SLUG = "accidentjournal";
export const ACCIDENT_DOCUMENT_TITLE = "Журнал учета аварий";
export const ACCIDENT_DOCUMENT_HEADING = "Журнал учета аварий";

export type AccidentRow = {
  id: string;
  accidentDate: string;
  accidentHour: string;
  accidentMinute: string;
  locationName: string;
  accidentDescription: string;
  affectedProducts: string;
  resolvedDate: string;
  resolvedHour: string;
  resolvedMinute: string;
  responsiblePeople: string;
  correctiveActions: string;
};

export type AccidentDocumentConfig = {
  rows: AccidentRow[];
  /**
   * Реальный день закрытия журнала (YYYY-MM-DD) для бумажной шапки:
   * раньше в «Окончен» печаталась дата открытия страницы.
   */
  finishedAt?: string | null;
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

/** Сегодня по МЕСТНОМУ времени, без сдвига в UTC. */
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/**
 * `today` — день, который считается «сегодня» (YYYY-MM-DD). По умолчанию
 * МЕСТНАЯ дата: `toISOString()` считал в UTC и ночью подставлял вчера.
 * Серверным вызовам, которым нужен день организации, параметр оставлен.
 */
export function createAccidentRow(
  overrides?: Partial<AccidentRow>,
  today = localToday()
): AccidentRow {
  const now = new Date();
  const nowHour = String(now.getHours()).padStart(2, "0");
  const nowMinute = String(now.getMinutes()).padStart(2, "0");
  return {
    id: overrides?.id || createId("accident-row"),
    accidentDate: normalizeText(overrides?.accidentDate) || today,
    accidentHour: normalizeText(overrides?.accidentHour) || nowHour,
    accidentMinute: normalizeText(overrides?.accidentMinute) || nowMinute,
    locationName: normalizeText(overrides?.locationName),
    accidentDescription: normalizeText(overrides?.accidentDescription),
    affectedProducts: normalizeText(overrides?.affectedProducts),
    resolvedDate: normalizeText(overrides?.resolvedDate) || today,
    resolvedHour: normalizeText(overrides?.resolvedHour) || nowHour,
    resolvedMinute: normalizeText(overrides?.resolvedMinute) || nowMinute,
    responsiblePeople: normalizeText(overrides?.responsiblePeople),
    correctiveActions: normalizeText(overrides?.correctiveActions),
  };
}

export function getAccidentDocumentDefaultConfig(): AccidentDocumentConfig {
  return {
    rows: [],
  };
}

export function buildAccidentDocumentDemoConfig(params?: {
  areaNames?: string[];
  userNames?: string[];
}): AccidentDocumentConfig {
  const locationName =
    params?.areaNames?.find((item) => item.toLowerCase().includes("склад")) ||
    params?.areaNames?.[0] ||
    "Склад";
  const responsiblePeople =
    params?.userNames?.slice(0, 2).join(", ") || "Петров, Иванов";

  return {
    rows: [
      createAccidentRow({
        accidentDate: "2021-10-29",
        accidentHour: "19",
        accidentMinute: "00",
        locationName,
        accidentDescription:
          "Прорыв трубы отопления в складе сырья. Вызвана аварийная служба. Временно поставлен хомут для устранения течи.",
        affectedProducts:
          "50 кг муки пшеничной в/с, размещенной на подтоварнике склада - утилизировано.",
        resolvedDate: "2021-10-29",
        resolvedHour: "22",
        resolvedMinute: "00",
        responsiblePeople,
        correctiveActions:
          "30.10.2021 в 15:00 произведена замена участка прохудившейся трубы. Проведена дополнительная инспекция всех труб отопления.",
      }),
    ],
  };
}

export function normalizeAccidentDocumentConfig(
  value: unknown
): AccidentDocumentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return getAccidentDocumentDefaultConfig();
  }

  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.rows)
    ? record.rows
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          return createAccidentRow(item as Partial<AccidentRow>);
        })
        .filter((item): item is AccidentRow => item !== null)
    : [];

  return {
    rows,
    ...(typeof record.finishedAt === "string" && record.finishedAt.trim() !== ""
      ? { finishedAt: record.finishedAt }
      : {}),
  };
}
