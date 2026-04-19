import { db } from "@/lib/db";

/**
 * "Filled today" check for a journal template. The legacy rule was
 * "any entry for today" — too lax, because most 2026 journals store
 * one row per employee (or per equipment, per room, per shift…) per day
 * and a single entry doesn't mean the day is actually closed out.
 *
 * New rule — per active `JournalDocument` of the template:
 *
 *   todayCount   = # of `JournalDocumentEntry` rows with `date = today`
 *   expectedCount = max # of rows seen on any single prior day within
 *                   the last 30 days (i.e. the document's natural roster
 *                   size — employees for hygiene, fridges for cold-
 *                   equipment, procedures for cleaning, etc. The UI
 *                   drives how many rows each day has, so we let the
 *                   data speak for itself instead of hardcoding a
 *                   per-template rule).
 *
 *   documentFilled = expectedCount === 0
 *                      ? todayCount > 0       // brand-new doc, any row counts
 *                      : todayCount >= expectedCount
 *
 * The template is considered filled today iff there's at least one
 * active document that covers today AND every such document is filled.
 *
 * Legacy `JournalEntry` journals (form-based, no per-day grid concept)
 * stay on the simpler "at least one entry today" rule — there's no
 * meaningful "all rows" for those.
 */

type DayRollup = {
  date: Date;
  count: number;
};

async function isDocumentFilledForDay(
  documentId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<boolean> {
  const lookbackStart = new Date(todayStart);
  lookbackStart.setDate(lookbackStart.getDate() - 30);

  const entries = await db.journalDocumentEntry.findMany({
    where: {
      documentId,
      date: { gte: lookbackStart, lt: todayEnd },
    },
    select: { date: true },
  });

  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const dayKey = entry.date.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);
  }

  const todayKey = todayStart.toISOString().slice(0, 10);
  const todayCount = byDay.get(todayKey) ?? 0;
  if (todayCount === 0) return false;

  let priorMax = 0;
  for (const [dayKey, count] of byDay.entries()) {
    if (dayKey === todayKey) continue;
    if (count > priorMax) priorMax = count;
  }

  // No history → one entry is enough (first day of a brand-new document).
  if (priorMax === 0) return true;

  return todayCount >= priorMax;
}

/**
 * Returns the set of JournalTemplate IDs that have at least one record
 * fully covering today (organization-scoped). Covers both storage
 * systems — legacy `JournalEntry` (any row counts) and the document
 * system (all rows for today, see module-level docstring).
 */
export async function getTemplatesFilledToday(
  organizationId: string,
  now: Date = new Date()
): Promise<Set<string>> {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [legacyEntries, activeDocuments] = await Promise.all([
    db.journalEntry.findMany({
      where: {
        organizationId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      select: { templateId: true },
      distinct: ["templateId"],
    }),
    db.journalDocument.findMany({
      where: {
        organizationId,
        status: "active",
        dateFrom: { lte: todayStart },
        dateTo: { gte: todayStart },
      },
      select: { id: true, templateId: true },
    }),
  ]);

  const filled = new Set<string>();
  for (const entry of legacyEntries) filled.add(entry.templateId);

  const documentsByTemplate = new Map<string, string[]>();
  for (const doc of activeDocuments) {
    const list = documentsByTemplate.get(doc.templateId) ?? [];
    list.push(doc.id);
    documentsByTemplate.set(doc.templateId, list);
  }

  await Promise.all(
    [...documentsByTemplate.entries()].map(async ([templateId, docIds]) => {
      const checks = await Promise.all(
        docIds.map((id) => isDocumentFilledForDay(id, todayStart, todayEnd))
      );
      if (checks.length > 0 && checks.every((ok) => ok)) {
        filled.add(templateId);
      }
    })
  );

  return filled;
}

/**
 * Single-template check. Same semantics as `getTemplatesFilledToday`.
 */
export async function isTemplateFilledToday(
  organizationId: string,
  templateId: string,
  now: Date = new Date()
): Promise<boolean> {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [legacyCount, activeDocuments] = await Promise.all([
    db.journalEntry.count({
      where: {
        organizationId,
        templateId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
    }),
    db.journalDocument.findMany({
      where: {
        organizationId,
        templateId,
        status: "active",
        dateFrom: { lte: todayStart },
        dateTo: { gte: todayStart },
      },
      select: { id: true },
    }),
  ]);

  if (legacyCount > 0) return true;
  if (activeDocuments.length === 0) return false;

  const checks = await Promise.all(
    activeDocuments.map((doc) =>
      isDocumentFilledForDay(doc.id, todayStart, todayEnd)
    )
  );
  return checks.every((ok) => ok);
}

// Kept for future consumers (e.g. analytics) — intentionally unused now.
export type { DayRollup };
