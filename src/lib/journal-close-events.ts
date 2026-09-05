import { db } from "@/lib/db";

/**
 * Helpers для работы с JournalCloseEvent — закрытием журнала за день
 * без событий (или с событиями, или auto-cron'ом).
 *
 * См. схему JournalCloseEvent — единая запись на (template, date, org,
 * точка). При reopen НЕ удаляется, а заполняется reopenedAt — для audit
 * trail.
 *
 * Точки (2026-09-05): закрытие дня — своё у каждой точки. В уникальном
 * ключе точка представлена `buildingKey`: id здания или "" для общего
 * закрытия (организация без точек и записи до появления точек). Общее
 * закрытие считается действующим и для каждой точки — см.
 * `getActiveCloseEvent`.
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

/** Ключ точки в уникальном индексе: id здания или "" для общего закрытия. */
export function closeEventBuildingKey(buildingId?: string | null): string {
  return buildingId ?? "";
}

/**
 * Точка документа — для закрытий из task-fill, где известен только
 * документ задачи. null — документ без точки или не найден.
 */
export async function documentBuildingId(
  documentId: string | null | undefined,
): Promise<string | null> {
  if (!documentId) return null;
  const document = await db.journalDocument.findUnique({
    where: { id: documentId },
    select: { buildingId: true },
  });
  return document?.buildingId ?? null;
}

function findCloseEvent<S extends { id: true }>(
  organizationId: string,
  templateId: string,
  date: Date,
  buildingId: string | null | undefined,
  select: S,
) {
  return db.journalCloseEvent.findUnique({
    where: {
      organizationId_templateId_date_buildingKey: {
        organizationId,
        templateId,
        date,
        buildingKey: closeEventBuildingKey(buildingId),
      },
    },
    select,
  });
}

/**
 * Создаёт или переоткрывает запись закрытия. Если на (template, date,
 * org, точка) уже есть NOT-reopened запись — возвращает её с
 * error='already-closed'. Если есть REOPENED запись — обновляет её
 * (новый close после reopen).
 */
export async function closeJournalForDay(args: {
  organizationId: string;
  templateId: string;
  journalDocumentId?: string | null;
  /** Точка, для которой закрывается день; null — общее закрытие. */
  buildingId?: string | null;
  date: Date;
  kind: CloseEventKind;
  reason?: string | null;
  closedByUserId?: string | null;
}): Promise<
  | { ok: true; closeEvent: { id: string; kind: string; reason: string | null } }
  | { ok: false; error: "already-closed"; existing: { id: string; closedAt: Date } }
> {
  const date = utcDayStart(args.date);

  const existing = await findCloseEvent(
    args.organizationId,
    args.templateId,
    date,
    args.buildingId,
    { id: true, createdAt: true, reopenedAt: true },
  );

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
      buildingKey: closeEventBuildingKey(args.buildingId),
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
  buildingId?: string | null;
  date: Date;
  reopenedByUserId: string;
}): Promise<
  | { ok: true; closeEventId: string }
  | { ok: false; error: "not-closed" }
> {
  const date = utcDayStart(args.date);

  const existing = await findCloseEvent(
    args.organizationId,
    args.templateId,
    date,
    args.buildingId,
    { id: true, reopenedAt: true },
  );

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
 * Возвращает active closure для (template, date, точка) или null если нет.
 * «Активный» = есть запись и она не была reopened. Для точки действует
 * и общее закрытие организации ("") — оно старше режима точек и должно
 * продолжать работать.
 */
export async function getActiveCloseEvent(
  organizationId: string,
  templateId: string,
  date: Date,
  buildingId: string | null = null,
) {
  const dayStart = utcDayStart(date);
  const keys = buildingId ? [closeEventBuildingKey(buildingId), ""] : [""];
  const existing = await db.journalCloseEvent.findFirst({
    where: {
      organizationId,
      templateId,
      date: dayStart,
      buildingKey: { in: keys },
      reopenedAt: null,
    },
    // Своё закрытие точки важнее общего.
    orderBy: { buildingKey: "desc" },
    select: {
      id: true,
      kind: true,
      reason: true,
      closedByUserId: true,
      createdAt: true,
      reopenedAt: true,
    },
  });
  return existing ?? null;
}
