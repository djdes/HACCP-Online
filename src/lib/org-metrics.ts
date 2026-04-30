import { db } from "@/lib/db";
import { calculatePerEmployeePrice } from "@/lib/per-employee-pricing";
import { NOT_AUTO_SEEDED } from "@/lib/journal-entry-filters";

/**
 * Метрики по одной организации для ROOT-дашборда. Считаются по сырым
 * данным БД (entries, documents, users) — без кеша, потому что в /root/*
 * приходят редко и хочется свежих чисел.
 */
export type OrgMetrics = {
  organizationId: string;
  organizationName: string;
  type: string;
  subscriptionPlan: string;
  subscriptionEnd: string | null;
  createdAt: string;
  /// Активных пользователей (isActive=true, archivedAt=null, isRoot=false).
  activeUsers: number;
  /// Записей journals (JournalEntry + JournalDocumentEntry) за 7/30 дней.
  entries7d: number;
  entries30d: number;
  /// Тренд: процент изменения 7d window vs прошлая неделя
  /// (положительный = рост, отрицательный = падение).
  weeklyTrendPct: number | null;
  /// Когда последний раз кто-то заполнял журнал. null = никогда.
  lastEntryAt: string | null;
  /// Расчётный MRR — calculatePerEmployeePrice(activeUsers).monthlyRub.
  /// Для trial считаем как «потенциальный MRR» (что было бы, если bы
  /// заплатили за всех активных).
  potentialMrrRub: number;
  /// Реальный MRR — 0 для trial, иначе potentialMrrRub. Простая
  /// эвристика, потом заменим на честный billing.
  actualMrrRub: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAllOrgMetrics(
  excludeOrgId: string,
  refDate: Date = new Date()
): Promise<OrgMetrics[]> {
  const orgs = await db.organization.findMany({
    where: { id: { not: excludeOrgId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      subscriptionPlan: true,
      subscriptionEnd: true,
      createdAt: true,
    },
  });

  const since30 = new Date(refDate.getTime() - 30 * DAY_MS);
  const since7 = new Date(refDate.getTime() - 7 * DAY_MS);
  const since14 = new Date(refDate.getTime() - 14 * DAY_MS);

  // Параллельные агрегаты — один проход на всю таблицу, потом группируем.
  const [
    activeByOrg,
    fieldEntries30Raw,
    docEntries30Raw,
    fieldEntries7Raw,
    docEntries7Raw,
    fieldEntries14to7Raw,
    docEntries14to7Raw,
    lastFieldByOrg,
    lastDocByOrgRaw,
  ] = await Promise.all([
    db.user.groupBy({
      by: ["organizationId"],
      where: {
        isActive: true,
        archivedAt: null,
        isRoot: false,
        organizationId: { not: excludeOrgId },
      },
      _count: { id: true },
    }),
    db.journalEntry.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: since30 } },
      _count: { id: true },
    }),
    // groupBy на JournalDocumentEntry по organizationId напрямую нельзя
    // (FK через document) — берём count через findMany + bucket по ходу.
    db.journalDocumentEntry.findMany({
      where: { createdAt: { gte: since30 }, ...NOT_AUTO_SEEDED },
      select: { document: { select: { organizationId: true } } },
    }),
    db.journalEntry.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: since7 } },
      _count: { id: true },
    }),
    db.journalDocumentEntry.findMany({
      where: { createdAt: { gte: since7 }, ...NOT_AUTO_SEEDED },
      select: { document: { select: { organizationId: true } } },
    }),
    db.journalEntry.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: since14, lt: since7 } },
      _count: { id: true },
    }),
    db.journalDocumentEntry.findMany({
      where: { createdAt: { gte: since14, lt: since7 }, ...NOT_AUTO_SEEDED },
      select: { document: { select: { organizationId: true } } },
    }),
    db.journalEntry.groupBy({
      by: ["organizationId"],
      _max: { createdAt: true },
    }),
    db.journalDocumentEntry.findMany({
      // _autoSeeded плейсхолдеры создаются при пересоздании документа
      // и засоряли «last activity» — ROOT-дашборд показывал, что
      // неактивная org «была активна вчера» когда seed-cron создал
      // placeholder-rows.
      where: NOT_AUTO_SEEDED,
      orderBy: { createdAt: "desc" },
      take: 5000, // ограничиваем чтобы не тащить миллион строк
      select: {
        createdAt: true,
        document: { select: { organizationId: true } },
      },
    }),
  ]);

  function bucket(rows: { document: { organizationId: string } }[]) {
    const map = new Map<string, number>();
    for (const r of rows) {
      const id = r.document.organizationId;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }
  const docEntries30 = bucket(docEntries30Raw);
  const docEntries7 = bucket(docEntries7Raw);
  const docEntries14to7 = bucket(docEntries14to7Raw);

  // last document entry per org — берём максимум из таскуем top 5000.
  const lastDocByOrg = new Map<string, Date>();
  for (const r of lastDocByOrgRaw) {
    const id = r.document.organizationId;
    if (!lastDocByOrg.has(id)) {
      lastDocByOrg.set(id, r.createdAt);
    }
  }

  function entriesFor(
    orgId: string,
    fieldArr: { organizationId: string; _count: { id: number } }[],
    docMap: Map<string, number>
  ): number {
    const fieldRow = fieldArr.find((r) => r.organizationId === orgId);
    return (fieldRow?._count.id ?? 0) + (docMap.get(orgId) ?? 0);
  }

  return orgs.map<OrgMetrics>((org) => {
    const activeRow = activeByOrg.find((r) => r.organizationId === org.id);
    const activeUsers = activeRow?._count.id ?? 0;

    const e30 = entriesFor(org.id, fieldEntries30Raw, docEntries30);
    const e7 = entriesFor(org.id, fieldEntries7Raw, docEntries7);
    const ePrev = entriesFor(org.id, fieldEntries14to7Raw, docEntries14to7);

    const trend =
      ePrev === 0
        ? e7 > 0
          ? 100
          : null
        : Math.round(((e7 - ePrev) / ePrev) * 100);

    const lastFieldRow = lastFieldByOrg.find(
      (r) => r.organizationId === org.id
    );
    const lastField = lastFieldRow?._max.createdAt ?? null;
    const lastDoc = lastDocByOrg.get(org.id) ?? null;
    const lastEntryAt =
      lastField && lastDoc
        ? lastField > lastDoc
          ? lastField
          : lastDoc
        : (lastField ?? lastDoc);

    const calc = calculatePerEmployeePrice(activeUsers);
    const isPaid =
      org.subscriptionPlan === "paid" || org.subscriptionPlan === "pro";

    return {
      organizationId: org.id,
      organizationName: org.name,
      type: org.type,
      subscriptionPlan: org.subscriptionPlan,
      subscriptionEnd: org.subscriptionEnd?.toISOString() ?? null,
      createdAt: org.createdAt.toISOString(),
      activeUsers,
      entries7d: e7,
      entries30d: e30,
      weeklyTrendPct: trend,
      lastEntryAt: lastEntryAt?.toISOString() ?? null,
      potentialMrrRub: calc.monthlyRub,
      actualMrrRub: isPaid ? calc.monthlyRub : 0,
    };
  });
}
