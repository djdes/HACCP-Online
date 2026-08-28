/**
 * Человеческое автоназвание документа журнала.
 *
 * ПОЧЕМУ: раньше в диалоге «Создать документ» подставлялся штамп
 * «2026.08.27 22:05» — момент создания. Он ничего не говорил о самом
 * документе: список превращался в столбик одинаковых дат, а найти
 * «тот, что за первую половину сентября» было нельзя. Владелец
 * (2026-08-28) попросил собирать название из НАЗВАНИЯ ЖУРНАЛА и
 * ПЕРИОДА, который человек выбрал руками.
 *
 * Функции здесь чистые (никакого `new Date()` без аргументов), чтобы их
 * можно было звать прямо в обработчиках диалога и покрыть юнит-тестом.
 */

/** Месяцы в родительном падеже: «1 сентября 2026». */
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** Месяцы в именительном падеже: «сентябрь 2026» (весь месяц целиком). */
const MONTHS_NOMINATIVE = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

/** Тире-разделитель между названием журнала и периодом. */
const NAME_SEPARATOR = " — ";
/** Внутри периода — короткое тире: «1–15 сентября 2026». */
const RANGE_DASH = "–";

type ParsedDate = { year: number; month: number; day: number };

/** Разбирает `YYYY-MM-DD`. Всё остальное (пустое, мусор) → `null`. */
function parseIsoDate(value: string | null | undefined): ParsedDate | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Длина месяца без `Date` — функция должна оставаться чистой и не
 * зависеть от таймзоны рантайма.
 */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function compare(a: ParsedDate, b: ParsedDate): number {
  return (
    a.year - b.year || a.month - b.month || a.day - b.day
  );
}

/**
 * Период человеческим текстом. Возвращает `""`, если даты не разобрать.
 *
 * - весь год        → «2026 год»
 * - весь месяц      → «сентябрь 2026»
 * - часть месяца    → «1–15 сентября 2026»
 * - один день       → «7 сентября 2026»
 * - через месяц     → «25 сентября – 8 октября 2026»
 * - через год       → «25 декабря 2026 – 8 января 2027»
 */
export function formatJournalPeriodLabel(
  dateFrom: string | null | undefined,
  dateTo?: string | null
): string {
  const from = parseIsoDate(dateFrom);
  if (!from) return "";
  // Дата окончания есть не у всех журналов (годовые, «на один день»):
  // тогда период — это один день начала.
  const parsedTo = parseIsoDate(dateTo);
  const to = parsedTo && compare(parsedTo, from) >= 0 ? parsedTo : from;

  const dayFrom = `${from.day} ${MONTHS_GENITIVE[from.month - 1]}`;
  const dayTo = `${to.day} ${MONTHS_GENITIVE[to.month - 1]}`;

  if (from.year !== to.year) {
    // Через новый год год пишем у ОБЕИХ дат — иначе «25 декабря – 8 января
    // 2027» читается так, будто декабрь тоже из 2027-го.
    return `${dayFrom} ${from.year} ${RANGE_DASH} ${dayTo} ${to.year}`;
  }

  // Весь календарный год: «2026 год» короче и понятнее, чем
  // «1 января – 31 декабря 2026».
  if (from.month === 1 && from.day === 1 && to.month === 12 && to.day === 31) {
    return `${from.year} год`;
  }

  if (from.month !== to.month) {
    return `${dayFrom} ${RANGE_DASH} ${dayTo} ${from.year}`;
  }

  if (from.day === to.day) {
    return `${dayFrom} ${from.year}`;
  }

  if (from.day === 1 && to.day === daysInMonth(to.year, to.month)) {
    return `${MONTHS_NOMINATIVE[from.month - 1]} ${from.year}`;
  }

  return `${from.day}${RANGE_DASH}${to.day} ${MONTHS_GENITIVE[from.month - 1]} ${from.year}`;
}

/**
 * Итоговое автоназвание: «Гигиенический журнал — 1–15 сентября 2026».
 *
 * Если период не разобрать — остаётся одно название журнала, а если и
 * его нет — пустая строка (поле «Название документа» тогда обязательное
 * и подсветится при сабмите).
 */
export function buildJournalDocumentTitle(input: {
  journalName: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}): string {
  const name = (input.journalName || "").trim();
  const period = formatJournalPeriodLabel(input.dateFrom, input.dateTo);
  if (!name) return period;
  if (!period) return name;
  return `${name}${NAME_SEPARATOR}${period}`;
}
