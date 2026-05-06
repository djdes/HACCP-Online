/**
 * Производственный календарь РФ 2025-2026.
 *
 * Источник: Постановление Правительства РФ + hh.ru/calendar (ручная сверка).
 * 2025: Постановление от 10.10.2024 №1335 «О переносе выходных дней в 2025 году».
 * 2026: Постановление от ... 2025 (когда выйдет — обновить).
 *
 * Перечисляем ТОЛЬКО holidays и short-days. Sunday/Saturday определяются
 * автоматически по дню недели (см. getCalendarDayKind).
 *
 * Update этого файла + run scripts/seed-production-calendar.ts чтобы
 * залить в БД.
 */

export type CalendarDayKind = "workday" | "weekend" | "holiday" | "short";

export type CalendarDayEntry = {
  date: string; // YYYY-MM-DD
  kind: Extract<CalendarDayKind, "holiday" | "short">;
  name?: string;
};

/** РФ календарь 2025 — праздники и сокращённые дни. */
export const RU_CALENDAR_2025: CalendarDayEntry[] = [
  // Январь — Новогодние каникулы (1-8) + Рождество (7).
  { date: "2025-01-01", kind: "holiday", name: "Новогодние каникулы" },
  { date: "2025-01-02", kind: "holiday", name: "Новогодние каникулы" },
  { date: "2025-01-03", kind: "holiday", name: "Новогодние каникулы" },
  { date: "2025-01-06", kind: "holiday", name: "Новогодние каникулы" },
  { date: "2025-01-07", kind: "holiday", name: "Рождество Христово" },
  { date: "2025-01-08", kind: "holiday", name: "Новогодние каникулы" },
  // Февраль — День защитника Отечества (23).
  { date: "2025-02-22", kind: "short", name: "Предпраздничный (23 февраля)" },
  { date: "2025-02-23", kind: "holiday", name: "День защитника Отечества" },
  { date: "2025-02-24", kind: "holiday", name: "Перенос с 23 февраля" },
  // Март — Международный женский день (8).
  { date: "2025-03-07", kind: "short", name: "Предпраздничный (8 марта)" },
  { date: "2025-03-08", kind: "holiday", name: "Международный женский день" },
  { date: "2025-03-10", kind: "holiday", name: "Перенос с 8 марта" },
  // Май — Праздник Весны и Труда (1) + День Победы (9).
  { date: "2025-04-30", kind: "short", name: "Предпраздничный (1 мая)" },
  { date: "2025-05-01", kind: "holiday", name: "Праздник Весны и Труда" },
  { date: "2025-05-02", kind: "holiday", name: "Перенос" },
  { date: "2025-05-08", kind: "short", name: "Предпраздничный (9 мая)" },
  { date: "2025-05-09", kind: "holiday", name: "День Победы" },
  // Июнь — День России (12).
  { date: "2025-06-11", kind: "short", name: "Предпраздничный (12 июня)" },
  { date: "2025-06-12", kind: "holiday", name: "День России" },
  { date: "2025-06-13", kind: "holiday", name: "Перенос" },
  // Ноябрь — День народного единства (4).
  { date: "2025-11-03", kind: "holiday", name: "Перенос" },
  { date: "2025-11-04", kind: "holiday", name: "День народного единства" },
  // Декабрь — Предновогодний.
  { date: "2025-12-31", kind: "holiday", name: "Перенос с новогодних" },
];

/** РФ календарь 2026 — official предложение Минтруда (на момент seeded). */
export const RU_CALENDAR_2026: CalendarDayEntry[] = [
  // Январь — Новогодние каникулы (1-8) + Рождество.
  { date: "2026-01-01", kind: "holiday", name: "Новый год" },
  { date: "2026-01-02", kind: "holiday", name: "Новогодние каникулы" },
  { date: "2026-01-05", kind: "holiday", name: "Новогодние каникулы" },
  { date: "2026-01-06", kind: "holiday", name: "Новогодние каникулы" },
  { date: "2026-01-07", kind: "holiday", name: "Рождество Христово" },
  { date: "2026-01-08", kind: "holiday", name: "Новогодние каникулы" },
  // Февраль — 23 февраля.
  { date: "2026-02-20", kind: "short", name: "Предпраздничный (23 февраля)" },
  { date: "2026-02-23", kind: "holiday", name: "День защитника Отечества" },
  // Март — 8 марта (вс) + перенос.
  { date: "2026-03-06", kind: "short", name: "Предпраздничный (8 марта)" },
  { date: "2026-03-09", kind: "holiday", name: "Перенос с 8 марта" },
  // Май — 1 мая (пт) + 9 мая (сб).
  { date: "2026-04-30", kind: "short", name: "Предпраздничный (1 мая)" },
  { date: "2026-05-01", kind: "holiday", name: "Праздник Весны и Труда" },
  { date: "2026-05-08", kind: "short", name: "Предпраздничный (9 мая)" },
  { date: "2026-05-09", kind: "holiday", name: "День Победы" },
  { date: "2026-05-11", kind: "holiday", name: "Перенос с 9 мая" },
  // Июнь — 12 июня (пт).
  { date: "2026-06-11", kind: "short", name: "Предпраздничный (12 июня)" },
  { date: "2026-06-12", kind: "holiday", name: "День России" },
  // Ноябрь — 4 ноября (ср).
  { date: "2026-11-03", kind: "short", name: "Предпраздничный (4 ноября)" },
  { date: "2026-11-04", kind: "holiday", name: "День народного единства" },
  // Декабрь.
  { date: "2026-12-31", kind: "holiday", name: "Перенос" },
];

export const ALL_RU_CALENDAR_ENTRIES: CalendarDayEntry[] = [
  ...RU_CALENDAR_2025,
  ...RU_CALENDAR_2026,
];

/**
 * Lookup-map для быстрых in-memory проверок (date → kind/name) когда
 * запрос к БД нежелателен (рендер большого grid'а).
 */
export const RU_CALENDAR_MAP: Map<
  string,
  { kind: "holiday" | "short"; name?: string }
> = new Map(
  ALL_RU_CALENDAR_ENTRIES.map((entry) => [
    entry.date,
    { kind: entry.kind, name: entry.name },
  ]),
);

/**
 * Определяет тип дня по дате — БЕЗ запроса к БД.
 *
 * Алгоритм:
 *   1. Если дата в RU_CALENDAR_MAP — вернуть holiday/short.
 *   2. Иначе если день — Сб/Вс — вернуть weekend.
 *   3. Иначе workday.
 */
export function getCalendarDayKind(dateKey: string): {
  kind: CalendarDayKind;
  name?: string;
} {
  const explicit = RU_CALENDAR_MAP.get(dateKey);
  if (explicit) return explicit;
  // Парсим day-of-week из YYYY-MM-DD (UTC, чтобы избежать timezone-skew).
  const date = new Date(`${dateKey}T00:00:00Z`);
  const dow = date.getUTCDay(); // 0 = Sun, 6 = Sat
  if (dow === 0 || dow === 6) return { kind: "weekend" };
  return { kind: "workday" };
}

/** True если дата — выходной или праздник (для bulk-actions). */
export function isNonWorkingDay(dateKey: string): boolean {
  const k = getCalendarDayKind(dateKey).kind;
  return k === "weekend" || k === "holiday";
}
