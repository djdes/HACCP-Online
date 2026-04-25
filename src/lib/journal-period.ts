/**
 * Single source of truth for "в каком периоде создавать документ журнала"
 * — используется bulk-create, auto-create и UI-кнопкой «Создать
 * документ». Без этого bulk-create создавал ВСЕ документы месячными,
 * даже если по семантике журнал годовой/событийный/полу-месячный/
 * open-ended.
 *
 * Правила (short):
 *   - YEARLY       → с 1 января по 31 декабря текущего года.
 *   - HALF_MONTHLY → 1-15 или 16-end-of-month по календарю.
 *                    Источник: скрины lk.haccp-online.ru.
 *   - MONTHLY      → с 1-го по последнее число месяца (daily и пр.).
 *   - SINGLE_DAY   → ровно сегодня (dateFrom = dateTo = today). Чек-
 *                    листы которые проводятся одним днём.
 *   - PERPETUAL    → один open-ended документ, dateFrom = сегодня,
 *                    dateTo = 2099-12-31 (фактически без конца). Внутрь
 *                    пишутся события за любые даты, документ не
 *                    ротируется.
 *
 * Если код шаблона неизвестен — дефолт MONTHLY, с логом для разработчика.
 */

import { ALL_DAILY_JOURNAL_CODES } from "@/lib/daily-journal-codes";

export type JournalPeriodKind =
  | "monthly"
  | "yearly"
  | "half-monthly"
  | "single-day"
  | "perpetual";

/**
 * Явно помеченные как yearly коды. Список основан на тех журналах,
 * где ручная кнопка «Создать» уже предлагает выбор года (см.
 * *-documents-client.tsx) или где сама сущность события по
 * бизнес-смыслу копится за год: аудиты, обучение, обслуживание,
 * калибровка, ежегодная санитарная книжка, сан-день, список
 * стеклянной посуды, учёт СИЗ, борьба с вредителями, аварии,
 * претензии, неисправности.
 */
export const YEARLY_JOURNAL_CODES = new Set<string>([
  "audit_plan",
  "audit_protocol",
  "audit_report",
  "training_plan",
  "staff_training",
  "equipment_calibration",
  "equipment_maintenance",
  "equipment_cleaning",
  "sanitation_day",
  "sanitary_day_checklist",
  "glass_items_list",
  "ppe_issuance",
  "pest_control",
  "breakdown_history",
  "accident_journal",
  "complaint_register",
  "med_books",
  // Скан скринов lk.haccp-online.ru: «График и учёт генеральных
  // уборок» отдельной колонкой «Год 2025» + «Дата документа
  // 01-01-2025» — однозначно годовой документ.
  "general_cleaning",
]);

/**
 * Журналы, у которых на официальном haccp-online.ru документ создаётся
 * на полмесяца — 1-15 или 16-end-of-month. Подтверждено скриншотами:
 *   • Гигиенический журнал — «Апрель с 1 по 15»
 *   • Журнал здоровья       — «Апрель с 1 по 15»
 *   • Контроль температурного режима холодильного оборудования —
 *     «Апрель с 1 по 15»
 *
 * Если день месяца ≤15 → период (1, 15). Если ≥16 → период (16, last).
 */
export const HALF_MONTHLY_JOURNAL_CODES = new Set<string>([
  "hygiene",
  "health_check",
  "cold_equipment_control",
]);

/**
 * Журналы которые проводятся одним днём — каждое нажатие «Создать
 * документ» это отдельное мероприятие на конкретную дату. На офиц.
 * сайте показано «Дата проведения 05-08-2025».
 */
export const SINGLE_DAY_JOURNAL_CODES = new Set<string>([
  "sanitary_day_control",
]);

/**
 * Open-ended журналы — создаются один раз, внутрь пишутся события
 * за любые даты, документ не ротируется. На офиц. сайте показана
 * только «Дата начала», без даты окончания. Реализуем как один
 * документ с dateTo = 2099-12-31.
 */
export const PERPETUAL_JOURNAL_CODES = new Set<string>([
  "disinfectant_usage",
  "intensive_cooling",
  "glass_control",
]);

const PERPETUAL_DATE_TO = new Date(Date.UTC(2099, 11, 31));

export function resolveJournalPeriodKind(
  templateCode: string
): JournalPeriodKind {
  if (YEARLY_JOURNAL_CODES.has(templateCode)) return "yearly";
  if (HALF_MONTHLY_JOURNAL_CODES.has(templateCode)) return "half-monthly";
  if (SINGLE_DAY_JOURNAL_CODES.has(templateCode)) return "single-day";
  if (PERPETUAL_JOURNAL_CODES.has(templateCode)) return "perpetual";
  if (ALL_DAILY_JOURNAL_CODES.has(templateCode)) return "monthly";
  // Неизвестный код — трактуем как месячный. Это безопаснее: если
  // журнал на самом деле годовой, менеджер заметит "за 30 дней" и
  // заведёт вручную; обратное (месячный создан как годовой) — хуже,
  // т.к. документ будет расти и мешать отчётности.
  return "monthly";
}

function monthBounds(now: Date): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m, 1)),
    to: new Date(Date.UTC(y, m + 1, 0)),
  };
}

function halfMonthBounds(now: Date): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const day = now.getUTCDate();
  if (day <= 15) {
    return {
      from: new Date(Date.UTC(y, m, 1)),
      to: new Date(Date.UTC(y, m, 15)),
    };
  }
  // Вторая половина: 16-е → последнее число месяца. (Date.UTC(y, m+1, 0)
  // даёт последний день текущего месяца; 28/29/30/31 в зависимости от
  // месяца и високосного года.)
  return {
    from: new Date(Date.UTC(y, m, 16)),
    to: new Date(Date.UTC(y, m + 1, 0)),
  };
}

function yearBounds(now: Date): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  return {
    from: new Date(Date.UTC(y, 0, 1)),
    to: new Date(Date.UTC(y, 11, 31)),
  };
}

const RU_MONTHS_NOMINATIVE = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function monthLabel(now: Date): string {
  return now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}
function yearLabel(now: Date): string {
  return `${now.getUTCFullYear()} г.`;
}
function halfMonthLabel(now: Date): string {
  // «Апрель с 1 по 15» / «Апрель с 16 по 30» — формат как на
  // haccp-online.ru, для согласованности UI.
  const day = now.getUTCDate();
  const monthName = RU_MONTHS_NOMINATIVE[now.getUTCMonth()];
  if (day <= 15) return `${monthName} с 1 по 15`;
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return `${monthName} с 16 по ${lastDay}`;
}

function singleDayLabel(now: Date): string {
  return now.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export function resolveJournalPeriod(
  templateCode: string,
  now: Date = new Date()
): { dateFrom: Date; dateTo: Date; kind: JournalPeriodKind; label: string } {
  const kind = resolveJournalPeriodKind(templateCode);
  if (kind === "yearly") {
    const b = yearBounds(now);
    return { dateFrom: b.from, dateTo: b.to, kind, label: yearLabel(now) };
  }
  if (kind === "half-monthly") {
    const b = halfMonthBounds(now);
    return { dateFrom: b.from, dateTo: b.to, kind, label: halfMonthLabel(now) };
  }
  if (kind === "single-day") {
    const day = startOfUtcDay(now);
    return { dateFrom: day, dateTo: day, kind, label: singleDayLabel(now) };
  }
  if (kind === "perpetual") {
    // Open-ended: один документ с сегодня до far future. Внутрь
    // пишутся события на любую дату; ротации не происходит.
    const day = startOfUtcDay(now);
    return {
      dateFrom: day,
      dateTo: PERPETUAL_DATE_TO,
      kind,
      label: `с ${singleDayLabel(now)}`,
    };
  }
  const b = monthBounds(now);
  return { dateFrom: b.from, dateTo: b.to, kind, label: monthLabel(now) };
}
