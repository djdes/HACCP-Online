/**
 * M10 — Российские праздничные дни. Используется в cron'ах
 * (shift-watcher, compliance) чтобы не пинговать менеджеров и не
 * заставлять заполнять журналы в государственные выходные.
 *
 * Список из официального производственного календаря РФ. Обновляется
 * вручную раз в год.
 */

const HOLIDAYS_2026 = new Set([
  "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04",
  "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08",
  "2026-02-23", "2026-03-08",
  "2026-05-01", "2026-05-04", "2026-05-09", "2026-05-11",
  "2026-06-12",
  "2026-11-04",
]);

const HOLIDAYS_2027 = new Set([
  "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04",
  "2027-01-05", "2027-01-06", "2027-01-07", "2027-01-08",
  "2027-02-22", "2027-02-23", "2027-03-08",
  "2027-05-01", "2027-05-03", "2027-05-09", "2027-05-10",
  "2027-06-14",
  "2027-11-04",
]);

const ALL_HOLIDAYS: Set<string> = new Set([
  ...HOLIDAYS_2026,
  ...HOLIDAYS_2027,
]);

/**
 * Проверяет, является ли указанная дата российским праздником.
 *
 * @param date  Date или строка формата YYYY-MM-DD
 */
export function isRussianHoliday(date: Date | string): boolean {
  const key =
    typeof date === "string" ? date : date.toISOString().slice(0, 10);
  return ALL_HOLIDAYS.has(key);
}

/**
 * Проверяет, является ли указанная дата выходным (Sat/Sun) или праздником.
 */
export function isNonWorkingDay(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return true;
  return isRussianHoliday(d);
}

/**
 * Возвращает причину почему день нерабочий, или null.
 */
export function nonWorkingDayReason(date: Date | string): string | null {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getUTCDay();
  if (day === 0) return "Воскресенье";
  if (day === 6) return "Суббота";
  if (isRussianHoliday(d)) return "Государственный праздник";
  return null;
}
