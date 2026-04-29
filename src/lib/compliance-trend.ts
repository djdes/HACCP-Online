import { db } from "@/lib/db";
import { NOT_AUTO_SEEDED } from "@/lib/journal-entry-filters";

/**
 * E1 — 12-месячный compliance тренд. Возвращает per-month
 * агрегаты «сколько записей, сколько уникальных шаблонов
 * заполнялось». Рисуется на /reports как линейный график.
 */
export type TrendPoint = {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "Апр" / "Май"
  entries: number;
  uniqueTemplates: number;
};

export async function getComplianceTrend(
  organizationId: string,
  monthsBack: number = 12,
  refDate: Date = new Date()
): Promise<TrendPoint[]> {
  const points: TrendPoint[] = [];
  const monthLabels = [
    "Янв",
    "Фев",
    "Мар",
    "Апр",
    "Май",
    "Июн",
    "Июл",
    "Авг",
    "Сен",
    "Окт",
    "Ноя",
    "Дек",
  ];

  const monthsToScan: Array<{ start: Date; end: Date; key: string; label: string }> =
    [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const month = new Date(refDate);
    month.setUTCMonth(month.getUTCMonth() - i, 1);
    month.setUTCHours(0, 0, 0, 0);
    const next = new Date(month);
    next.setUTCMonth(next.getUTCMonth() + 1);
    monthsToScan.push({
      start: month,
      end: next,
      key: `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`,
      label: monthLabels[month.getUTCMonth()],
    });
  }

  for (const m of monthsToScan) {
    const [fieldEntries, docEntries] = await Promise.all([
      db.journalEntry.findMany({
        where: {
          organizationId,
          createdAt: { gte: m.start, lt: m.end },
        },
        select: { templateId: true },
      }),
      db.journalDocumentEntry.findMany({
        where: {
          document: { organizationId },
          createdAt: { gte: m.start, lt: m.end },
          ...NOT_AUTO_SEEDED,
        },
        select: { document: { select: { templateId: true } } },
      }),
    ]);

    const templateSet = new Set<string>();
    for (const e of fieldEntries) templateSet.add(e.templateId);
    for (const e of docEntries) templateSet.add(e.document.templateId);

    points.push({
      monthKey: m.key,
      monthLabel: m.label,
      entries: fieldEntries.length + docEntries.length,
      uniqueTemplates: templateSet.size,
    });
  }

  return points;
}
