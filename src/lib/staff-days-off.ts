/**
 * Выходные дни сотрудника: недельное правило + явные исключения.
 *
 * Почему так. Раньше выходной существовал только как строка
 * `StaffWorkOffDay(userId, date)` — управляющая была вынуждена
 * прокликивать Сб/Вс каждому сотруднику на месяц вперёд, а любое
 * автозаполнение видело только те дни, которые кто-то успел отметить.
 *
 * Теперь у сотрудника есть недельное правило `User.weeklyDaysOff`
 * (0=Пн … 6=Вс), а таблица `StaffWorkOffDay` хранит ТОЛЬКО исключения
 * из него:
 *   - `kind = "off"`  — выходной вопреки правилу (отметили вручную);
 *   - `kind = "work"` — рабочий день вопреки правилу (сняли галочку
 *     с «правильного» выходного).
 *
 * Явная отметка побеждает правило в обе стороны — это единственная
 * точка правды `isStaffDayOff`, её используют автозаполнение журналов,
 * раздача ежедневных обязательств и bulk-assign в TasksFlow.
 */

/** Подписи дней недели в порядке хранения: 0=Пн … 6=Вс. */
export const WEEKDAY_LABELS = [
  "Пн",
  "Вт",
  "Ср",
  "Чт",
  "Пт",
  "Сб",
  "Вс",
] as const;

/** Дефолт для новых сотрудников — суббота и воскресенье. */
export const DEFAULT_WEEKLY_DAYS_OFF: readonly number[] = [5, 6];

export type StaffDayOffKind = "off" | "work";

export type StaffDayOffUser = {
  weeklyDaysOff?: readonly number[] | null;
};

/** ISO-строка дня (YYYY-MM-DD) из Date или самой строки. */
export function toDayKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/**
 * Индекс дня недели в нашей нумерации (0=Пн … 6=Вс).
 * Считаем в UTC: даты графика хранятся как «день в 00:00 UTC», и
 * локальная таймзона сервера не должна сдвигать субботу в пятницу.
 */
export function weekdayIndex(value: Date | string): number {
  const date =
    typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : value;
  // getUTCDay(): 0=Вс … 6=Сб → сдвигаем к 0=Пн … 6=Вс.
  return (date.getUTCDay() + 6) % 7;
}

/** Чистит присланный массив: только 0..6, без дублей, по возрастанию. */
export function normalizeWeeklyDaysOff(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<number>();
  for (const raw of value) {
    // `Number(null)` === 0 и `Number(true)` === 1 — из-за этого мусор
    // из JSON молча превращался бы в «понедельник».
    if (typeof raw !== "number" && typeof raw !== "string") continue;
    if (typeof raw === "string" && raw.trim() === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 6) continue;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export function normalizeDayOffKind(value: unknown): StaffDayOffKind {
  return value === "work" ? "work" : "off";
}

/** Ключ карты исключений — `userId|YYYY-MM-DD`. */
export function dayOffOverrideKey(userId: string, date: Date | string): string {
  return `${userId}|${toDayKey(date)}`;
}

/**
 * Выходной ли у сотрудника этот день.
 *
 * @param override явная отметка из `StaffWorkOffDay` (если она есть);
 *                 побеждает недельное правило в обе стороны.
 */
export function isStaffDayOff(
  user: StaffDayOffUser | null | undefined,
  date: Date | string,
  override?: StaffDayOffKind | null
): boolean {
  if (override === "off") return true;
  if (override === "work") return false;
  const weekly = normalizeWeeklyDaysOff(user?.weeklyDaysOff ?? []);
  if (weekly.length === 0) return false;
  return weekly.includes(weekdayIndex(date));
}

/**
 * Карта исключений из плоского списка строк `StaffWorkOffDay`.
 * Нужна везде, где день проверяется пачкой (автозаполнение, bulk-assign).
 */
export function buildDayOffOverrides(
  rows: readonly { userId: string; date: Date | string; kind?: string | null }[]
): Map<string, StaffDayOffKind> {
  const map = new Map<string, StaffDayOffKind>();
  for (const row of rows) {
    map.set(dayOffOverrideKey(row.userId, row.date), normalizeDayOffKind(row.kind));
  }
  return map;
}

export type WorkOffBulkItem = {
  userId: string;
  /** ISO YYYY-MM-DD */
  date: string;
  /** true — «отметить выходным», false — «сделать рабочим». */
  enabled: boolean;
};

export type WorkOffBulkPlan = {
  upserts: Array<{ userId: string; date: string; kind: StaffDayOffKind }>;
  deletes: Array<{ userId: string; date: string }>;
};

/**
 * Превращает пачку кликов «зажал и покрасил» в минимальный набор
 * операций над `StaffWorkOffDay`.
 *
 * Идемпотентность: результат зависит только от последнего значения по
 * каждой паре (userId, date) — повторная отправка того же плана даёт
 * ту же строку в БД. Строку заводим ТОЛЬКО когда она расходится с
 * недельным правилом: совпал с правилом — исключение не нужно, и его
 * надо удалить, иначе оно «залипнет» после смены правила.
 */
export function planWorkOffBulk(
  items: readonly WorkOffBulkItem[],
  weeklyByUserId: ReadonlyMap<string, readonly number[]>
): WorkOffBulkPlan {
  // Последний клик по клетке побеждает — пользователь мог провести
  // курсором по одной и той же ячейке дважды.
  const latest = new Map<string, WorkOffBulkItem>();
  for (const item of items) {
    latest.set(dayOffOverrideKey(item.userId, item.date), item);
  }

  const plan: WorkOffBulkPlan = { upserts: [], deletes: [] };
  for (const item of latest.values()) {
    const weekly = normalizeWeeklyDaysOff(weeklyByUserId.get(item.userId) ?? []);
    const ruleSaysOff = weekly.includes(weekdayIndex(item.date));
    if (item.enabled === ruleSaysOff) {
      plan.deletes.push({ userId: item.userId, date: item.date });
    } else {
      plan.upserts.push({
        userId: item.userId,
        date: item.date,
        kind: item.enabled ? "off" : "work",
      });
    }
  }
  // Стабильный порядок — чтобы транзакция и тесты были предсказуемы.
  const byKey = (a: { userId: string; date: string }, b: { userId: string; date: string }) =>
    dayOffOverrideKey(a.userId, a.date).localeCompare(dayOffOverrideKey(b.userId, b.date));
  plan.upserts.sort(byKey);
  plan.deletes.sort(byKey);
  return plan;
}

/** Человеческая подпись правила: «Сб, Вс» / «не задано». */
export function weeklyDaysOffLabel(value: unknown): string {
  const weekly = normalizeWeeklyDaysOff(value);
  if (weekly.length === 0) return "не задано";
  return weekly.map((d) => WEEKDAY_LABELS[d]).join(", ");
}
