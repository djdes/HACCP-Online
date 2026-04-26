import { db } from "@/lib/db";
import { parseDisabledCodes } from "@/lib/disabled-journals";

/**
 * Compliance heatmap: матрица «templates × дни», цветовое чтение
 * закономерностей («у нас завал по health_check каждый понедельник»,
 * «glass_control никто не ведёт уже 2 недели»).
 *
 * Дёшево по запросам: 2 запроса к БД (entries за период) + один
 * для шаблонов.
 *
 * Возвращает для каждого шаблона массив из `daysBack` дней, отсортированный
 * по возрастанию даты. Status:
 *   - "filled" — есть запись в этот день;
 *   - "missed" — день в прошлом, а записи нет;
 *   - "future" — день в будущем (на случай если кто-то расширит окно).
 */
export type CellStatus = "filled" | "missed" | "future";

export type HeatmapCell = {
  date: string; // YYYY-MM-DD UTC
  status: CellStatus;
  count: number;
};

export type HeatmapRow = {
  templateCode: string;
  templateName: string;
  cells: HeatmapCell[];
};

export async function getComplianceHeatmap(
  organizationId: string,
  daysBack: number = 30,
  refDate: Date = new Date()
): Promise<{ rows: HeatmapRow[]; days: string[] }> {
  // Нормализуем периоды на UTC midnight.
  const todayStart = new Date(refDate);
  todayStart.setUTCHours(0, 0, 0, 0);
  const periodStart = new Date(todayStart);
  periodStart.setUTCDate(periodStart.getUTCDate() - (daysBack - 1));

  // Диапазон дней — массив YYYY-MM-DD в порядке возрастания.
  const days: string[] = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(periodStart);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  const [organization, templates, fieldEntries, docEntries] = await Promise.all(
    [
      db.organization.findUnique({
        where: { id: organizationId },
        select: { disabledJournalCodes: true },
      }),
      db.journalTemplate.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, code: true, name: true },
      }),
      db.journalEntry.findMany({
        where: {
          organizationId,
          createdAt: { gte: periodStart, lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) },
        },
        select: { templateId: true, createdAt: true },
      }),
      db.journalDocumentEntry.findMany({
        where: {
          document: { organizationId },
          date: { gte: periodStart, lte: todayStart },
        },
        select: {
          date: true,
          document: { select: { templateId: true } },
        },
      }),
    ]
  );

  const disabledSet = parseDisabledCodes(organization?.disabledJournalCodes);
  const activeTemplates = templates.filter((t) => !disabledSet.has(t.code));
  const templateById = new Map(activeTemplates.map((t) => [t.id, t]));

  // Bucket: templateId → date(YYYY-MM-DD) → count.
  const buckets = new Map<string, Map<string, number>>();
  function bump(templateId: string, dateStr: string) {
    if (!templateById.has(templateId)) return;
    let inner = buckets.get(templateId);
    if (!inner) {
      inner = new Map();
      buckets.set(templateId, inner);
    }
    inner.set(dateStr, (inner.get(dateStr) ?? 0) + 1);
  }
  for (const entry of fieldEntries) {
    const dateStr = entry.createdAt.toISOString().slice(0, 10);
    bump(entry.templateId, dateStr);
  }
  for (const entry of docEntries) {
    const dateStr = entry.date.toISOString().slice(0, 10);
    bump(entry.document.templateId, dateStr);
  }

  const rows: HeatmapRow[] = activeTemplates.map((tpl) => {
    const inner = buckets.get(tpl.id);
    const cells: HeatmapCell[] = days.map((dateStr) => {
      const count = inner?.get(dateStr) ?? 0;
      const isFuture =
        new Date(dateStr).getTime() > todayStart.getTime();
      const status: CellStatus = isFuture
        ? "future"
        : count > 0
          ? "filled"
          : "missed";
      return { date: dateStr, status, count };
    });
    return {
      templateCode: tpl.code,
      templateName: tpl.name,
      cells,
    };
  });

  // Сортируем: проблемные журналы (больше missed-дней) сверху —
  // менеджер сразу видит worst offenders.
  rows.sort((a, b) => {
    const am = a.cells.filter((c) => c.status === "missed").length;
    const bm = b.cells.filter((c) => c.status === "missed").length;
    return bm - am;
  });

  return { rows, days };
}
