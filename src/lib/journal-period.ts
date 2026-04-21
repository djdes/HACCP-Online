/**
 * Single source of truth for "в каком периоде создавать документ журнала"
 * — используется bulk-create, auto-create и (можно) UI-кнопкой «Создать
 * документ». Без этого bulk-create создавал ВСЕ документы месячными,
 * даже если по семантике журнал годовой (медкнижки, обучение, план
 * аудита) или событийный (авария, претензия).
 *
 * Правила (short):
 *   - YEARLY   → период = с 1 января по 31 декабря текущего года;
 *                годовой/событийный/annual-roster журнал.
 *   - MONTHLY  → с 1-го по последнее число текущего месяца; сюда
 *                попадают все daily и большинство периодических с
 *                месячной отчётной формой.
 *
 * Если код шаблона неизвестен — дефолт MONTHLY, с логом для разработчика.
 */

import { ALL_DAILY_JOURNAL_CODES } from "@/lib/daily-journal-codes";

export type JournalPeriodKind = "monthly" | "yearly";

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
]);

export function resolveJournalPeriodKind(
  templateCode: string
): JournalPeriodKind {
  if (YEARLY_JOURNAL_CODES.has(templateCode)) return "yearly";
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

function yearBounds(now: Date): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  return {
    from: new Date(Date.UTC(y, 0, 1)),
    to: new Date(Date.UTC(y, 11, 31)),
  };
}

function monthLabel(now: Date): string {
  return now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}
function yearLabel(now: Date): string {
  return `${now.getUTCFullYear()} г.`;
}

export function resolveJournalPeriod(
  templateCode: string,
  now: Date = new Date()
): { dateFrom: Date; dateTo: Date; kind: JournalPeriodKind; label: string } {
  const kind = resolveJournalPeriodKind(templateCode);
  if (kind === "yearly") {
    const b = yearBounds(now);
    return {
      dateFrom: b.from,
      dateTo: b.to,
      kind,
      label: yearLabel(now),
    };
  }
  const b = monthBounds(now);
  return { dateFrom: b.from, dateTo: b.to, kind, label: monthLabel(now) };
}
