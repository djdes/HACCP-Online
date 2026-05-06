/**
 * Weekday-маска для гибкого расписания (например, «текущая уборка по Пн/Ср/Пт,
 * генеральная — только Сб»).
 *
 * Хранится как 7-битное число: bit 0 = Пн, bit 1 = Вт, ... bit 6 = Вс.
 * 0 = ничего не запланировано, 127 (0b1111111) = каждый день.
 *
 * Используем Monday-first индексацию (как hh.ru календарь и наш UI),
 * НЕ JS-нативный Sunday-first. Явные хелперы конвертируют между ними.
 */

/** Маска «каждый день». */
export const WEEKDAY_MASK_ALL = 127;
/** Маска «никогда». */
export const WEEKDAY_MASK_NONE = 0;
/** Только рабочие дни (Пн-Пт). */
export const WEEKDAY_MASK_WORKDAYS = 31; // 0b0011111
/** Только выходные (Сб-Вс). */
export const WEEKDAY_MASK_WEEKENDS = 96; // 0b1100000

/** Лейблы для UI, Monday-first. */
export const WEEKDAY_LABELS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const WEEKDAY_LABELS_RU_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

/** Конвертация JS dayOfWeek (0=Sun..6=Sat) → наш Monday-first индекс (0=Mon..6=Sun). */
export function jsDayOfWeekToMondayIndex(jsDow: number): number {
  // Sun (0) → 6; Mon (1) → 0; ... Sat (6) → 5
  return (jsDow + 6) % 7;
}

/** Возвращает Monday-first индекс для YYYY-MM-DD строки. */
export function dateKeyToMondayIndex(dateKey: string): number {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return jsDayOfWeekToMondayIndex(date.getUTCDay());
}

/** True если день недели включён в маску. mondayIndex: 0=Пн..6=Вс. */
export function isMaskedWeekday(mask: number, mondayIndex: number): boolean {
  if (mondayIndex < 0 || mondayIndex > 6) return false;
  return (mask & (1 << mondayIndex)) !== 0;
}

/** True если YYYY-MM-DD включён в маску. */
export function isMaskedDateKey(mask: number, dateKey: string): boolean {
  return isMaskedWeekday(mask, dateKeyToMondayIndex(dateKey));
}

/** Тоггл бита в маске. Возвращает новую маску. */
export function toggleWeekdayBit(mask: number, mondayIndex: number): number {
  if (mondayIndex < 0 || mondayIndex > 6) return mask;
  return mask ^ (1 << mondayIndex);
}

/** Нормализация: гарантирует число 0..127. */
export function normalizeMask(value: unknown, fallback: number = WEEKDAY_MASK_NONE): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 127) {
    return value;
  }
  return fallback;
}

/** Human-readable строка маски, например "Пн, Ср, Пт" или "ежедневно". */
export function describeMask(mask: number): string {
  if (mask === WEEKDAY_MASK_NONE) return "не запланировано";
  if (mask === WEEKDAY_MASK_ALL) return "ежедневно";
  if (mask === WEEKDAY_MASK_WORKDAYS) return "по будням";
  if (mask === WEEKDAY_MASK_WEEKENDS) return "по выходным";
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    if (isMaskedWeekday(mask, i)) days.push(WEEKDAY_LABELS_RU[i]);
  }
  return days.join(", ");
}
