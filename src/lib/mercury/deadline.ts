/**
 * Дедлайн гашения входящего ВСД.
 *
 * Правило Россельхознадзора: входящий ветеринарный сопроводительный
 * документ гасится в течение ОДНОГО РАБОЧЕГО ДНЯ с момента поступления
 * партии. Просрочка — нарушение, поэтому дату считаем честно по
 * производственному календарю РФ, а не «+24 часа».
 *
 * Чистый модуль без БД и сети: всё поведение проверяется юнит-тестами
 * (`deadline.test.ts`), включая пятницу, предпраздничные дни и годы, для
 * которых календаря ещё нет.
 */
import {
  getCalendarDayKind,
  isNonWorkingDay,
} from "@/lib/production-calendar-data";

/** Диапазон лет, на которые в репозитории есть настоящий календарь РФ. */
export const CALENDAR_KNOWN_YEARS = { from: 2025, to: 2026 } as const;

/** `Date` → `YYYY-MM-DD` в UTC. */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` + N дней (UTC). */
function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

/**
 * Есть ли для года настоящие данные календаря.
 *
 * За пределами диапазона `getCalendarDayKind` молча считает выходными
 * только субботу и воскресенье — праздники «пропадают», и дедлайн
 * уезжает. Это не повод падать (журнал важнее), но повод предупредить в
 * логах и вернуть флаг наружу.
 */
export function hasCalendarData(dateKey: string): boolean {
  const year = Number(dateKey.slice(0, 4));
  return year >= CALENDAR_KNOWN_YEARS.from && year <= CALENDAR_KNOWN_YEARS.to;
}

/**
 * Смещение часового пояса зоны относительно UTC в минутах на конкретный
 * момент. Считаем через `Intl`, а не хардкодом: у организации может быть
 * любая зона из `RUSSIAN_TIMEZONES`, и у части из них смещение менялось.
 */
function timezoneOffsetMinutes(timezone: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(at).map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 180; // Europe/Moscow
  }
}

/** Конец суток `dateKey` (23:59:59) в зоне организации, как момент UTC. */
export function endOfDayInTimezone(dateKey: string, timezone: string): Date {
  // Приближение в два шага: берём полночь как UTC, узнаём смещение зоны
  // на этот момент и вычитаем его. Двух проходов достаточно даже когда
  // день попадает на перевод часов — в РФ его нет, но зона может быть
  // задана любая.
  const naive = Date.parse(`${dateKey}T23:59:59Z`);
  let offset = timezoneOffsetMinutes(timezone, new Date(naive));
  offset = timezoneOffsetMinutes(timezone, new Date(naive - offset * 60000));
  return new Date(naive - offset * 60000);
}

export type ProcessingDeadline = {
  /** Момент, до которого ВСД должен быть погашен. */
  dueAt: Date;
  /** День дедлайна, `YYYY-MM-DD`. */
  dueDateKey: string;
  /** false — календаря на этот год нет, праздники не учтены. */
  calendarKnown: boolean;
};

/**
 * Дедлайн гашения: конец СЛЕДУЮЩЕГО РАБОЧЕГО ДНЯ после поступления.
 *
 * `base` — дата поставки из ВСД (`deliveryDate`), а если её нет — дата
 * оформления (`issueDate`). Если сама поставка пришлась на выходной,
 * отсчёт всё равно ведём от первого рабочего дня после неё: раньше
 * работать никто не обязан.
 */
export function computeProcessingDueAt(input: {
  base: Date | string;
  timezone?: string | null;
  /** Ограничитель на случай испорченных данных: не ищем дольше 2 недель. */
  maxLookaheadDays?: number;
}): ProcessingDeadline {
  const timezone = input.timezone || "Europe/Moscow";
  const baseKey =
    typeof input.base === "string"
      ? input.base.slice(0, 10)
      : toDateKey(input.base);
  const maxLookahead = input.maxLookaheadDays ?? 14;

  // Первый рабочий день, начиная с даты поставки.
  let cursor = baseKey;
  let guard = 0;
  while (isNonWorkingDay(cursor) && guard < maxLookahead) {
    cursor = shiftDateKey(cursor, 1);
    guard += 1;
  }

  // И следующий рабочий день после него — это и есть срок.
  let due = shiftDateKey(cursor, 1);
  guard = 0;
  while (isNonWorkingDay(due) && guard < maxLookahead) {
    due = shiftDateKey(due, 1);
    guard += 1;
  }

  return {
    dueAt: endOfDayInTimezone(due, timezone),
    dueDateKey: due,
    calendarKnown: hasCalendarData(baseKey) && hasCalendarData(due),
  };
}

export type DeadlineTone = "ok" | "soon" | "overdue";

/**
 * Как показывать срок в списке: спокойно, «сегодня до конца дня» или
 * «просрочен». Порог «скоро» — 8 часов: смена успевает закончиться.
 */
export function describeDeadline(
  dueAt: Date | null | undefined,
  now: Date = new Date(),
): { tone: DeadlineTone; hoursLeft: number | null; daysOverdue: number } {
  if (!dueAt) return { tone: "ok", hoursLeft: null, daysOverdue: 0 };
  const diffMs = dueAt.getTime() - now.getTime();
  if (diffMs < 0) {
    return {
      tone: "overdue",
      hoursLeft: 0,
      daysOverdue: Math.floor(-diffMs / 86400000),
    };
  }
  const hoursLeft = diffMs / 3600000;
  return {
    tone: hoursLeft <= 8 ? "soon" : "ok",
    hoursLeft,
    daysOverdue: 0,
  };
}

/** Для логов и предупреждений в UI. */
export function calendarWarning(dateKey: string): string | null {
  if (hasCalendarData(dateKey)) return null;
  return (
    `Производственного календаря на ${dateKey.slice(0, 4)} год нет: ` +
    `срок гашения посчитан только по субботам и воскресеньям, ` +
    `праздники не учтены. Обновите src/lib/production-calendar-data.ts.`
  );
}

export { getCalendarDayKind };
