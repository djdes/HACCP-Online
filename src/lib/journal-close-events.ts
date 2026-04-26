import { db } from "@/lib/db";

/**
 * Helpers для работы с JournalCloseEvent — закрытием журнала за день
 * без событий (или с событиями, или auto-cron'ом).
 *
 * См. схему JournalCloseEvent — единая запись на (template, date, org).
 * При reopen НЕ удаляется, а заполняется reopenedAt — для audit trail.
 */

export type CloseEventKind =
  | "no-events"
  | "auto-closed-empty"
  | "closed-with-events";

/**
 * Нормализует Date → UTC midnight того же дня. Все close-event'ы
 * хранятся с date = UTC midnight, чтобы lookup был детерминированным
 * независимо от timezone клиента.
 */
export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Создаёт или переоткрывает запись закрытия. Если на (template, date,
 * org) уже есть NOT-reopened запись — возвращает её с error='already-closed'.
 * Если есть REOPENED запись — обновляет её (новый close после reopen).
 */
export async function closeJournalForDay(args: {
  organizationId: string;
  templateId: string;
  journalDocumentId?: string | null;
  date: Date;
  kind: CloseEventKind;
  reason?: string | null;
  closedByUserId?: string | null;
}): Promise<
  | { ok: true; closeEvent: { id: string; kind: string; reason: string | null } }
  | { ok: false; error: "already-closed"; existing: { id: string; closedAt: Date } }
> {
  const date = utcDayStart(args.date);

  const existing = await db.journalCloseEvent.findUnique({
    where: {
      organizationId_templateId_date: {
        organizationId: args.organizationId,
        templateId: args.templateId,
        date,
      },
    },
    select: { id: true, createdAt: true, reopenedAt: true },
  });

  if (existing && !existing.reopenedAt) {
    return {
      ok: false,
      error: "already-closed",
      existing: { id: existing.id, closedAt: existing.createdAt },
    };
  }

  if (existing && existing.reopenedAt) {
    // Reopen-then-close cycle: обновляем существующую запись новым closure.
    const updated = await db.journalCloseEvent.update({
      where: { id: existing.id },
      data: {
        kind: args.kind,
        reason: args.reason ?? null,
        closedByUserId: args.closedByUserId ?? null,
        reopenedAt: null,
        reopenedByUserId: null,
        journalDocumentId: args.journalDocumentId ?? null,
      },
      select: { id: true, kind: true, reason: true },
    });
    return { ok: true, closeEvent: updated };
  }

  const created = await db.journalCloseEvent.create({
    data: {
      organizationId: args.organizationId,
      templateId: args.templateId,
      journalDocumentId: args.journalDocumentId ?? null,
      date,
      kind: args.kind,
      reason: args.reason ?? null,
      closedByUserId: args.closedByUserId ?? null,
    },
    select: { id: true, kind: true, reason: true },
  });
  return { ok: true, closeEvent: created };
}

/**
 * Reopen ранее закрытого журнала. Возвращает success или error если
 * не было активного closure.
 */
export async function reopenJournalForDay(args: {
  organizationId: string;
  templateId: string;
  date: Date;
  reopenedByUserId: string;
}): Promise<
  | { ok: true; closeEventId: string }
  | { ok: false; error: "not-closed" }
> {
  const date = utcDayStart(args.date);

  const existing = await db.journalCloseEvent.findUnique({
    where: {
      organizationId_templateId_date: {
        organizationId: args.organizationId,
        templateId: args.templateId,
        date,
      },
    },
    select: { id: true, reopenedAt: true },
  });

  if (!existing || existing.reopenedAt) {
    return { ok: false, error: "not-closed" };
  }

  await db.journalCloseEvent.update({
    where: { id: existing.id },
    data: {
      reopenedAt: new Date(),
      reopenedByUserId: args.reopenedByUserId,
    },
  });
  return { ok: true, closeEventId: existing.id };
}

/**
 * Возвращает active closure для (template, date) или null если нет.
 * «Активный» = есть запись и она не была reopened.
 */
export async function getActiveCloseEvent(
  organizationId: string,
  templateId: string,
  date: Date
) {
  const dayStart = utcDayStart(date);
  const existing = await db.journalCloseEvent.findUnique({
    where: {
      organizationId_templateId_date: {
        organizationId,
        templateId,
        date: dayStart,
      },
    },
    select: {
      id: true,
      kind: true,
      reason: true,
      closedByUserId: true,
      createdAt: true,
      reopenedAt: true,
    },
  });
  if (!existing || existing.reopenedAt) return null;
  return existing;
}
