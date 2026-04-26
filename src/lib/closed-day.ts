import { isManagementRole } from "@/lib/user-roles";

/**
 * «Закрытый день» (Compliance feature 3.10.4):
 *   - после момента "сегодняшнее начало" (с учётом `shiftEndHour`)
 *     записи прошедших дней становятся read-only для рядовых
 *     сотрудников;
 *   - management (manager/head_chef/owner/technologist) и ROOT всегда
 *     может, но каждое такое действие должно писаться в AuditLog с
 *     указанием причины — это требование ХАССП-аудита.
 *
 * Здесь — pure-функции без зависимостей от БД и сессии. Wire-up
 * делается в API-роутах (см. /api/journal-documents/[id]/entries).
 */

/**
 * Возвращает дату "начала сегодняшнего дня" с учётом `shiftEndHour`.
 * Если shiftEndHour=0 — это полночь UTC. Если 6 — это 06:00 UTC.
 *
 * Идея: "сегодня" — это окно `[startOfToday, startOfToday+24h)`.
 * Когда now < startOfToday — мы ещё в "прошлой смене", и "сегодня"
 * начинается завтра. Здесь это покрывается тем, что startOfToday для
 * "прошлой смены" уже на сутки назад.
 */
export function getStartOfToday(refDate: Date, shiftEndHour: number): Date {
  const utcNow = refDate.getTime();
  const baseDay = new Date(refDate);
  baseDay.setUTCHours(shiftEndHour, 0, 0, 0);
  // Если now ещё не дошло до shiftEndHour — "сегодня" началось вчера.
  if (baseDay.getTime() > utcNow) {
    baseDay.setUTCDate(baseDay.getUTCDate() - 1);
  }
  return baseDay;
}

/**
 * Заперт ли указанный entryDate для редактирования "не-управлением"?
 *
 * @param entryDate Дата записи (из JournalDocumentEntry.date — это
 *   полночь UTC). Сравниваем по дню, не по точному времени.
 * @param org Часть Organization с полями lockPastDayEdits и shiftEndHour.
 * @param refDate "Сейчас" — для тестов.
 */
export function isPastDayLocked(
  entryDate: Date,
  org: { lockPastDayEdits: boolean; shiftEndHour: number },
  refDate: Date = new Date()
): boolean {
  if (!org.lockPastDayEdits) return false;
  const startOfToday = getStartOfToday(refDate, org.shiftEndHour);
  // Запись по дате "сегодня и позже" — редактируется свободно.
  // Запись по дате "вчера и раньше" — заперта.
  return entryDate.getTime() < startOfToday.getTime();
}

export type ClosedDayActor = {
  role: string;
  isRoot: boolean;
};

/**
 * Может ли актор редактировать запись с указанной датой при текущих
 * настройках org? Management всегда может (но это не значит «без
 * аудита» — caller должен залогировать override).
 */
export function canEditEntryAt(
  entryDate: Date,
  actor: ClosedDayActor,
  org: { lockPastDayEdits: boolean; shiftEndHour: number },
  refDate: Date = new Date()
): { allowed: boolean; reason: "ok" | "past_day_locked"; isOverride: boolean } {
  const isLocked = isPastDayLocked(entryDate, org, refDate);
  if (!isLocked) {
    return { allowed: true, reason: "ok", isOverride: false };
  }
  if (actor.isRoot || isManagementRole(actor.role)) {
    return { allowed: true, reason: "past_day_locked", isOverride: true };
  }
  return { allowed: false, reason: "past_day_locked", isOverride: false };
}
