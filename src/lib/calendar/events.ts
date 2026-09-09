import type { CalendarEvent } from "@/lib/calendar/ics";
import {
  batchEvents,
  calendarWindow,
  calibrationEvents,
  capaEvents,
  competencyEvents,
  medBookEvents,
  subscriptionEvents,
} from "@/lib/calendar/sources";
import { db } from "@/lib/db";
import { MED_BOOK_TEMPLATE_CODE } from "@/lib/med-book-document";

const CALIBRATION_TEMPLATE_CODE = "equipment_calibration";

/** Все события организации за окно «месяц назад — год вперёд». */
export async function collectCalendarEvents(organizationId: string, now: Date = new Date()): Promise<CalendarEvent[]> {
  const window = calendarWindow(now);
  const from = new Date(`${window.from}T00:00:00.000Z`);
  const to = new Date(`${window.to}T23:59:59.999Z`);

  const [org, competencies, capas, batches, medDocs, calDocs] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId }, select: { name: true, subscriptionEnd: true } }),
    db.staffCompetency.findMany({
      where: { organizationId, expiresAt: { gte: from, lte: to } },
      select: { id: true, skill: true, expiresAt: true, userId: true },
    }),
    db.capaTicket.findMany({
      where: { organizationId, dueDate: { gte: from, lte: to } },
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
    }),
    db.batch.findMany({
      where: { organizationId, expiryDate: { gte: from, lte: to } },
      select: { id: true, code: true, productName: true, expiryDate: true, status: true },
    }),
    db.journalDocument.findMany({
      where: { organizationId, status: "active", template: { code: MED_BOOK_TEMPLATE_CODE } },
      select: { id: true, entries: { select: { id: true, data: true, employee: { select: { name: true } } } } },
    }),
    db.journalDocument.findMany({
      where: { organizationId, status: "active", template: { code: CALIBRATION_TEMPLATE_CODE } },
      select: { id: true, config: true },
    }),
  ]);
  if (!org) return [];

  const userIds = Array.from(new Set(competencies.map((c) => c.userId)));
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return [
    ...subscriptionEvents(org, window),
    ...medBookEvents(
      medDocs.flatMap((doc) => doc.entries.map((e) => ({ id: e.id, employeeName: e.employee.name, data: e.data }))),
      window
    ),
    ...calibrationEvents(calDocs, window),
    ...competencyEvents(
      competencies.map((c) => ({ id: c.id, skill: c.skill, expiresAt: c.expiresAt, userName: nameById.get(c.userId) ?? null })),
      window
    ),
    ...capaEvents(capas, window),
    ...batchEvents(batches, window),
  ];
}
