import { db } from "@/lib/db";

/**
 * Что организация реально делает — для ROOT'а в метриках платформы.
 *
 * Колонка «Записи 7д» отвечает на вопрос «сколько», но не на «что»: одна
 * и та же цифра бывает у организации, которая ведёт восемь журналов, и у
 * той, где уборщица третий месяц отмечается в одном. Различить их можно
 * только по разбивке и по ленте.
 *
 * Записи живут в двух моделях: `JournalEntry` (журналы-формы) и
 * `JournalDocumentEntry` (журналы-таблицы, ячейка сотрудник × день).
 * Метрики их складывают — здесь тоже, иначе цифра в таблице и содержимое
 * панели не сойдутся.
 */

/** Сколько последних событий показываем в ленте. */
const TIMELINE_LIMIT = 60;

/** Окно разбивки по журналам, дней. */
const BREAKDOWN_DAYS = 30;

export type OrgActivityEvent = {
  id: string;
  at: string;
  /// `form` — журнал-форма, `cell` — ячейка журнала-таблицы.
  kind: "form" | "cell";
  journalCode: string;
  journalName: string;
  /// Кто заполнил. Для ячейки — сотрудник, за которого стоит отметка.
  who: string;
  /// Название документа — только у журналов-таблиц.
  documentTitle: string | null;
};

export type OrgActivityJournal = {
  journalCode: string;
  journalName: string;
  count: number;
  lastAt: string;
};

export type OrgActivity = {
  organizationId: string;
  organizationName: string;
  breakdownDays: number;
  /// Разбивка по журналам за `breakdownDays`, самые активные сверху.
  byJournal: OrgActivityJournal[];
  /// Лента последних событий, свежие сверху.
  timeline: OrgActivityEvent[];
};

export async function getOrgActivity(
  organizationId: string,
  refDate: Date = new Date(),
): Promise<OrgActivity | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) return null;

  const since = new Date(
    refDate.getTime() - BREAKDOWN_DAYS * 24 * 60 * 60 * 1000,
  );

  // Берём по TIMELINE_LIMIT из каждой модели и сливаем: какая из двух
  // окажется свежее, заранее неизвестно, а брать по половине — значит
  // потерять хвост у организации, которая ведёт только журналы-таблицы.
  const [formEntries, cellEntries] = await Promise.all([
    db.journalEntry.findMany({
      where: { organizationId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: TIMELINE_LIMIT,
      select: {
        id: true,
        createdAt: true,
        template: { select: { code: true, name: true } },
        filledBy: { select: { name: true } },
      },
    }),
    db.journalDocumentEntry.findMany({
      where: {
        createdAt: { gte: since },
        document: { organizationId },
      },
      orderBy: { createdAt: "desc" },
      take: TIMELINE_LIMIT,
      select: {
        id: true,
        createdAt: true,
        employee: { select: { name: true } },
        document: {
          select: {
            title: true,
            template: { select: { code: true, name: true } },
          },
        },
      },
    }),
  ]);

  const events: OrgActivityEvent[] = [
    ...formEntries.map<OrgActivityEvent>((e) => ({
      id: `form:${e.id}`,
      at: e.createdAt.toISOString(),
      kind: "form",
      journalCode: e.template.code,
      journalName: e.template.name,
      who: e.filledBy?.name || "—",
      documentTitle: null,
    })),
    ...cellEntries.map<OrgActivityEvent>((e) => ({
      id: `cell:${e.id}`,
      at: e.createdAt.toISOString(),
      kind: "cell",
      journalCode: e.document.template.code,
      journalName: e.document.template.name,
      who: e.employee?.name || "—",
      documentTitle: e.document.title,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, TIMELINE_LIMIT);

  // Разбивку считаем по ПОЛНОМУ окну, а не по срезанной ленте: иначе у
  // активной организации в разбивку попадёт только последний день.
  const [formByTemplate, cellByDocument] = await Promise.all([
    db.journalEntry.groupBy({
      by: ["templateId"],
      where: { organizationId, createdAt: { gte: since } },
      _count: { id: true },
      _max: { createdAt: true },
    }),
    db.journalDocumentEntry.groupBy({
      by: ["documentId"],
      where: { createdAt: { gte: since }, document: { organizationId } },
      _count: { id: true },
      _max: { createdAt: true },
    }),
  ]);

  const templateIds = formByTemplate.map((r) => r.templateId);
  const documentIds = cellByDocument.map((r) => r.documentId);

  const [templates, documents] = await Promise.all([
    templateIds.length
      ? db.journalTemplate.findMany({
          where: { id: { in: templateIds } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    documentIds.length
      ? db.journalDocument.findMany({
          where: { id: { in: documentIds } },
          select: { id: true, template: { select: { code: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const templateById = new Map(templates.map((t) => [t.id, t]));
  const documentById = new Map(documents.map((d) => [d.id, d]));

  // Один журнал может держать несколько документов — складываем их в одну
  // строку разбивки, иначе «Гигиенический журнал» появится трижды.
  const byCode = new Map<string, OrgActivityJournal>();

  function add(
    code: string | undefined,
    name: string | undefined,
    count: number,
    lastAt: Date | null,
  ) {
    if (!code || !name || !lastAt) return;
    const prev = byCode.get(code);
    const at = lastAt.toISOString();
    if (!prev) {
      byCode.set(code, {
        journalCode: code,
        journalName: name,
        count,
        lastAt: at,
      });
      return;
    }
    prev.count += count;
    if (at > prev.lastAt) prev.lastAt = at;
  }

  for (const row of formByTemplate) {
    const t = templateById.get(row.templateId);
    add(t?.code, t?.name, row._count.id, row._max.createdAt);
  }
  for (const row of cellByDocument) {
    const d = documentById.get(row.documentId);
    add(
      d?.template.code,
      d?.template.name,
      row._count.id,
      row._max.createdAt,
    );
  }

  return {
    organizationId: org.id,
    organizationName: org.name,
    breakdownDays: BREAKDOWN_DAYS,
    byJournal: [...byCode.values()].sort((a, b) => b.count - a.count),
    timeline: events,
  };
}
