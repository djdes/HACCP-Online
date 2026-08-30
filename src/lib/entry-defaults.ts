/**
 * Значения по умолчанию для новой строки журнала.
 *
 * Дата, время и ответственный — это «когда и кто», а не показатели.
 * Их система знает и обязана подставить: заставлять повара набивать
 * сегодняшнее число и текущее время руками — лишняя работа на каждой
 * записи, и именно там он ошибается.
 *
 * Показатели (температуры, оценки, килограммы, отметки) сюда не
 * относятся НИКОГДА. Журнал показывают Роспотребнадзору, и значение,
 * проставленное за непроведённый контроль, хуже пустой графы.
 */

/**
 * Сегодняшний день в местном часовом поясе, `YYYY-MM-DD`.
 *
 * Не `toISOString().slice(0, 10)`: тот отдаёт дату по UTC, и в Москве
 * с полуночи до трёх ночи показывал вчерашнее число — смена, работающая
 * ночью, получала запись не тем днём.
 */
export function localDayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Текущее время по местным часам — час и минута отдельно. */
export function localTimeParts(now: Date = new Date()): {
  hour: number;
  minute: number;
} {
  return { hour: now.getHours(), minute: now.getMinutes() };
}

/** Текущее время строкой `HH:MM` — для полей `<input type="time">`. */
export function localTimeValue(now: Date = new Date()): string {
  const { hour, minute } = localTimeParts(now);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
