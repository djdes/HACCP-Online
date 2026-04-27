/**
 * N6 — timezone-aware утилиты. Используются на UI чтобы показывать
 * даты в зоне организации (Europe/Moscow, Asia/Novosibirsk и т.п.).
 *
 * Не трогает БД — там всё в UTC. Конвертация на render time.
 */

/**
 * Форматирует дату в указанной timezone в стиле «27.04 14:30».
 * Если timezone невалидный — fallback на UTC+0.
 */
export function formatLocalDateTime(
  date: Date,
  timezone: string = "Europe/Moscow"
): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

/**
 * Только дата в формате «27.04.2026».
 */
export function formatLocalDate(
  date: Date,
  timezone: string = "Europe/Moscow"
): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Список зон РФ для UI-селектора. Можно расширить.
 */
export const RUSSIAN_TIMEZONES = [
  { tz: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { tz: "Europe/Moscow", label: "Москва (UTC+3)" },
  { tz: "Europe/Samara", label: "Самара (UTC+4)" },
  { tz: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { tz: "Asia/Omsk", label: "Омск (UTC+6)" },
  { tz: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { tz: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { tz: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { tz: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { tz: "Asia/Magadan", label: "Магадан (UTC+11)" },
  { tz: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
] as const;
