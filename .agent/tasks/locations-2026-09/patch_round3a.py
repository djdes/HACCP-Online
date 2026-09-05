import io
import re


def read(path):
    return io.open(path, encoding="utf-8").read()


def write(path, s):
    io.open(path, "w", encoding="utf-8", newline="\n").write(s)
    print("patched", path)


def apply(path, s, pairs):
    for old, new, count in pairs:
        n = s.count(old)
        assert n == count, f"{path}: expected {count} of {old[:90]!r}, found {n}"
        s = s.replace(old, new)
    return s


def patch(path, pairs):
    write(path, apply(path, read(path), pairs))


def add_import_after(s, anchor_regex, line, path):
    m = re.search(anchor_regex, s, re.M)
    assert m, f"{path}: import anchor {anchor_regex!r} not found"
    return s[: m.end()] + "\n" + line + s[m.end():]


# ---------- schema ----------
patch("prisma/schema.prisma", [
    ('''  name           String
  address        String?
  sortOrder      Int          @default(0)
  rooms          Room[]
  /// Точки (2026-09-05): документы и обязательства, привязанные к этому''', '''  name           String
  address        String?
  /// Точки (2026-09-05): реквизиты точки для шапки PDF — у сети КПП и
  /// телефон свои на каждом адресе.
  kpp            String?
  phone          String?
  sortOrder      Int          @default(0)
  rooms          Room[]
  /// Точки (2026-09-05): документы и обязательства, привязанные к этому''', 1),
    ('''  date              DateTime
  kind              String''', '''  date              DateTime
  /// Точки (2026-09-05): ключ точки в уникальном индексе — id здания или
  /// "" для общего закрытия организации (до точек и без точек).
  buildingKey       String           @default("")
  kind              String''', 1),
    ('''  @@unique([organizationId, templateId, date])
  @@index([organizationId, date])
  @@index([templateId, date])''', '''  @@unique([organizationId, templateId, date, buildingKey])
  @@index([organizationId, date])
  @@index([templateId, date])''', 1),
    ('''  documentId      String
  png             Bytes''', '''  documentId      String
  /// Точки (2026-09-05): "" — общее превью, иначе id точки: у каждой
  /// точки свой активный документ и свой снимок.
  buildingKey     String       @default("")
  png             Bytes''', 1),
    ('''  @@unique([organizationId, code])
  @@index([renderedAt])''', '''  @@unique([organizationId, code, buildingKey])
  @@index([renderedAt])''', 1),
])

# ---------- today-compliance: close event per building ----------
p = "src/lib/today-compliance.ts"
s = read(p)
s = add_import_after(s, r'^import \{ buildingWhere \} from "@/lib/building-scope";$',
                     'import { getActiveCloseEvent } from "@/lib/journal-close-events";', p)
s = apply(p, s, [
    ('''  const closeEvent = await db.journalCloseEvent.findUnique({
    where: {
      organizationId_templateId_date: {
        organizationId,
        templateId,
        date: todayStart,
      },
    },
    select: { id: true, kind: true, reason: true, reopenedAt: true },
  });
  if (closeEvent && !closeEvent.reopenedAt) {''', '''  // Точки: своё закрытие точки или общее закрытие организации.
  const closeEvent = await getActiveCloseEvent(
    organizationId,
    templateId,
    todayStart,
    options.buildingId ?? null,
  );
  if (closeEvent) {''', 1),
])
write(p, s)

# ---------- auto-close-shifts cron: per building ----------
p = "src/app/api/cron/auto-close-shifts/route.ts"
s = read(p)
s = add_import_after(s, r'^import \{ db \} from "@/lib/db";$',
                     'import { buildingTargets } from "@/lib/active-building";\nimport { buildingWhere } from "@/lib/building-scope";\nimport { closeEventBuildingKey } from "@/lib/journal-close-events";', p)
s = apply(p, s, [
    ('''  for (const org of orgs) {
    let closed = 0;
    let skipped = 0;

    for (const tplId of sharedTemplateIds) {''', '''  for (const org of orgs) {
    let closed = 0;
    let skipped = 0;
    // Точки: день закрывается на каждой точке отдельно (или один раз для
    // организации без точек).
    const targets = await buildingTargets(org.id);

    for (const tplId of sharedTemplateIds) for (const buildingId of targets) {''', 1),
    ('''      const existing = await db.journalCloseEvent.findUnique({
        where: {
          organizationId_templateId_date: {
            organizationId: org.id,
            templateId: tplId,
            date: targetDate,
          },
        },
        select: { id: true },
      });''', '''      const existing = await db.journalCloseEvent.findFirst({
        where: {
          organizationId: org.id,
          templateId: tplId,
          date: targetDate,
          buildingKey: closeEventBuildingKey(buildingId),
        },
        select: { id: true },
      });''', 1),
    ('''            document: { organizationId: org.id, templateId: tplId },''',
     '''            document: { organizationId: org.id, templateId: tplId, ...buildingWhere(buildingId) },''', 1),
    ('''          status: "active",
          dateFrom: { lte: targetDate },
          dateTo: { gte: targetDate },
        },
        select: { id: true },
      });

      const result = await closeJournalForDay({
        organizationId: org.id,
        templateId: tplId,
        journalDocumentId: activeDoc?.id ?? null,''', '''          status: "active",
          dateFrom: { lte: targetDate },
          dateTo: { gte: targetDate },
          ...buildingWhere(buildingId),
        },
        select: { id: true },
      });

      const result = await closeJournalForDay({
        organizationId: org.id,
        templateId: tplId,
        journalDocumentId: activeDoc?.id ?? null,
        buildingId,''', 1),
])
write(p, s)

# ---------- task-fill close events: building of the task's document ----------
p = "src/app/api/task-fill/[taskId]/close-no-events/route.ts"
s = read(p)
s = re.sub(r'import \{ ([^}]*)closeJournalForDay([^}]*)\} from "@/lib/journal-close-events";',
           lambda m: 'import { ' + m.group(1) + 'closeJournalForDay, documentBuildingId' + m.group(2) + '} from "@/lib/journal-close-events";', s, count=1)
assert "documentBuildingId" in s, p
s = apply(p, s, [
    ('''    journalDocumentId: link.journalDocumentId,
    date: new Date(),
    kind: parsed.kind,''', '''    journalDocumentId: link.journalDocumentId,
    buildingId: await documentBuildingId(link.journalDocumentId),
    date: new Date(),
    kind: parsed.kind,''', 1),
])
write(p, s)

p = "src/app/api/task-fill/[taskId]/reopen/route.ts"
s = read(p)
s = re.sub(r'import \{ ([^}]*)reopenJournalForDay([^}]*)\} from "@/lib/journal-close-events";',
           lambda m: 'import { ' + m.group(1) + 'reopenJournalForDay, documentBuildingId' + m.group(2) + '} from "@/lib/journal-close-events";', s, count=1)
assert "documentBuildingId" in s, p
s = apply(p, s, [
    ('''    date: new Date(),
    reopenedByUserId: actorId,
  });''', '''    buildingId: await documentBuildingId(link.journalDocumentId),
    date: new Date(),
    reopenedByUserId: actorId,
  });''', 1),
])
write(p, s)

p = "src/app/api/task-fill/[taskId]/status/route.ts"
s = read(p)
s = re.sub(r'import \{ ([^}]*)getActiveCloseEvent([^}]*)\} from "@/lib/journal-close-events";',
           lambda m: 'import { ' + m.group(1) + 'getActiveCloseEvent, documentBuildingId' + m.group(2) + '} from "@/lib/journal-close-events";', s, count=1)
assert "documentBuildingId" in s, p
s = apply(p, s, [
    ('''    getActiveCloseEvent(
      link.integration.organizationId,
      template.id,
      today
    ),''', '''    documentBuildingId(link.journalDocumentId).then((buildingId) =>
      getActiveCloseEvent(link.integration.organizationId, template.id, today, buildingId),
    ),''', 1),
])
write(p, s)

p = "src/app/task-fill/[taskId]/page.tsx"
s = read(p)
s = re.sub(r'import \{ ([^}]*)getActiveCloseEvent([^}]*)\} from "@/lib/journal-close-events";',
           lambda m: 'import { ' + m.group(1) + 'getActiveCloseEvent, documentBuildingId' + m.group(2) + '} from "@/lib/journal-close-events";', s, count=1)
assert "documentBuildingId" in s, p
s = apply(p, s, [
    ('''      ? getActiveCloseEvent(
          link.integration.organizationId,
          template.id,
          new Date()
        )
      : Promise.resolve(null),''', '''      ? documentBuildingId(link.journalDocumentId).then((buildingId) =>
          getActiveCloseEvent(link.integration.organizationId, template.id, new Date(), buildingId),
        )
      : Promise.resolve(null),''', 1),
])
write(p, s)

# ---------- previews per building ----------
p = "src/lib/journal-preview/service.ts"
s = apply(p, read(p), [
    ('''export type PreviewCandidate = {
  organizationId: string;
  code: string;
  documentId: string;
  sourceUpdatedAt: Date;
};''', '''export type PreviewCandidate = {
  organizationId: string;
  code: string;
  /** Точки: "" — общее превью, иначе id точки. */
  buildingKey: string;
  documentId: string;
  sourceUpdatedAt: Date;
};''', 1),
    ('''type ActiveDoc = {
  id: string;
  organizationId: string;
  updatedAt: Date;
  dateFrom: Date;
  template: { code: string };
};

type ExistingPreview = {
  id: string;
  organizationId: string;
  code: string;
  documentId: string;
  sourceUpdatedAt: Date;
  renderedAt: Date;
};''', '''type ActiveDoc = {
  id: string;
  organizationId: string;
  buildingId?: string | null;
  updatedAt: Date;
  dateFrom: Date;
  template: { code: string };
};

type ExistingPreview = {
  id: string;
  organizationId: string;
  code: string;
  buildingKey?: string;
  documentId: string;
  sourceUpdatedAt: Date;
  renderedAt: Date;
};

const KEY_SEPARATOR = "::";

/** (организация, код, точка) — один активный документ и одно превью. */
function previewKey(organizationId: string, code: string, buildingKey: string): string {
  return [organizationId, code, buildingKey].join(KEY_SEPARATOR);
}''', 1),
    ('''  const latestByKey = new Map<string, ActiveDoc>();
  for (const doc of input.activeDocs) {
    const key = `${doc.organizationId}::${doc.template.code}`;
    const prev = latestByKey.get(key);
    if (!prev || doc.dateFrom > prev.dateFrom) latestByKey.set(key, doc);
  }

  const previewByKey = new Map<string, ExistingPreview>();
  for (const p of input.previews) previewByKey.set(`${p.organizationId}::${p.code}`, p);''', '''  const latestByKey = new Map<string, ActiveDoc>();
  for (const doc of input.activeDocs) {
    const key = previewKey(doc.organizationId, doc.template.code, doc.buildingId ?? "");
    const prev = latestByKey.get(key);
    if (!prev || doc.dateFrom > prev.dateFrom) latestByKey.set(key, doc);
  }

  const previewByKey = new Map<string, ExistingPreview>();
  for (const p of input.previews) {
    previewByKey.set(previewKey(p.organizationId, p.code, p.buildingKey ?? ""), p);
  }''', 1),
    ('''    const hasActive = latestByKey.has(`${p.organizationId}::${p.code}`);''',
     '''    const hasActive = latestByKey.has(previewKey(p.organizationId, p.code, p.buildingKey ?? ""));''', 1),
    ('''  for (const [key, doc] of latestByKey) {
    const [organizationId, code] = key.split("::");
    if (input.disabledByOrg.get(organizationId)?.has(code)) continue;
    const existing = previewByKey.get(key);
    const candidate = {
      organizationId,
      code,
      documentId: doc.id,''', '''  for (const [key, doc] of latestByKey) {
    const [organizationId, code, buildingKey] = key.split(KEY_SEPARATOR);
    if (input.disabledByOrg.get(organizationId)?.has(code)) continue;
    const existing = previewByKey.get(key);
    const candidate = {
      organizationId,
      code,
      buildingKey: buildingKey ?? "",
      documentId: doc.id,''', 1),
    ('''      select: {
        id: true,
        organizationId: true,
        updatedAt: true,
        dateFrom: true,
        template: { select: { code: true } },
      },
    }),
    db.journalPreview.findMany({
      select: {
        id: true,
        organizationId: true,
        code: true,
        documentId: true,''', '''      select: {
        id: true,
        organizationId: true,
        buildingId: true,
        updatedAt: true,
        dateFrom: true,
        template: { select: { code: true } },
      },
    }),
    db.journalPreview.findMany({
      select: {
        id: true,
        organizationId: true,
        code: true,
        buildingKey: true,
        documentId: true,''', 1),
    ('''  await db.journalPreview.upsert({
    where: {
      organizationId_code: {
        organizationId: candidate.organizationId,
        code: candidate.code,
      },
    },
    create: {
      organizationId: candidate.organizationId,
      code: candidate.code,
      documentId: candidate.documentId,''', '''  await db.journalPreview.upsert({
    where: {
      organizationId_code_buildingKey: {
        organizationId: candidate.organizationId,
        code: candidate.code,
        buildingKey: candidate.buildingKey,
      },
    },
    create: {
      organizationId: candidate.organizationId,
      code: candidate.code,
      buildingKey: candidate.buildingKey,
      documentId: candidate.documentId,''', 1),
    ('''export async function getJournalPreviewMap(organizationId: string): Promise<Map<string, string>> {
  const rows = await db.journalPreview
    .findMany({
      where: { organizationId },
      select: { code: true, renderedAt: true },
    })
    .catch(() => []);
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.code, `/api/journal-previews/${encodeURIComponent(row.code)}?v=${row.renderedAt.getTime()}`);
  }
  return map;
}''', '''export async function getJournalPreviewMap(
  organizationId: string,
  /** Точка: её превью, если есть, иначе общее. null — только общие. */
  buildingId: string | null = null,
): Promise<Map<string, string>> {
  const wanted = buildingId ?? "";
  const rows = await db.journalPreview
    .findMany({
      where: { organizationId, buildingKey: { in: wanted ? [wanted, ""] : [""] } },
      select: { code: true, buildingKey: true, renderedAt: true },
    })
    .catch(() => []);
  const map = new Map<string, string>();
  // Сначала общие, затем превью точки перекрывают их.
  for (const row of [...rows].sort((a, b) => a.buildingKey.length - b.buildingKey.length)) {
    map.set(
      row.code,
      `/api/journal-previews/${encodeURIComponent(row.code)}?v=${row.renderedAt.getTime()}&b=${encodeURIComponent(row.buildingKey)}`,
    );
  }
  return map;
}''', 1),
])
write(p, s)

patch("src/app/api/journal-previews/[code]/route.ts", [
    ('''export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {''', '''export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {''', 1),
    ('''  const preview = await db.journalPreview.findUnique({
    where: { organizationId_code: { organizationId, code } },
    select: { png: true, renderedAt: true },
  });
  if (!preview) {''', '''  // Точки: `b` — ключ точки из URL превью; без своего снимка отдаём общий.
  const buildingKey = new URL(request.url).searchParams.get("b") ?? "";
  const preview =
    (await db.journalPreview.findUnique({
      where: { organizationId_code_buildingKey: { organizationId, code, buildingKey } },
      select: { png: true, renderedAt: true },
    })) ??
    (buildingKey
      ? await db.journalPreview.findUnique({
          where: { organizationId_code_buildingKey: { organizationId, code, buildingKey: "" } },
          select: { png: true, renderedAt: true },
        })
      : null);
  if (!preview) {''', 1),
])

patch("src/app/(dashboard)/journals/page.tsx", [
    ('  const previewUrls = await getJournalPreviewMap(getActiveOrgId(session));',
     '  const previewUrls = await getJournalPreviewMap(getActiveOrgId(session), activeBuildingId);', 1),
])
p = "src/app/(dashboard)/settings/journals/page.tsx"
s = read(p)
s = add_import_after(s, r'^import .* from "@/lib/auth-helpers";$', 'import { getActiveBuildingId } from "@/lib/active-building";', p)
s = apply(p, s, [
    ('  const previewUrls = await getJournalPreviewMap(organizationId);',
     '  const previewUrls = await getJournalPreviewMap(organizationId, await getActiveBuildingId(session));', 1),
])
write(p, s)

# ---------- compliance heatmap / trend: optional building filter ----------
for p, fn_sigs in [
    ("src/lib/compliance-heatmap.ts", [
        ('''export async function getComplianceHeatmap(
  organizationId: string,
  daysBack: number = 30,
  refDate: Date = new Date()
): Promise<{ rows: HeatmapRow[]; days: string[] }> {''', '''export async function getComplianceHeatmap(
  organizationId: string,
  daysBack: number = 30,
  refDate: Date = new Date(),
  options: { buildingId?: string | null } = {}
): Promise<{ rows: HeatmapRow[]; days: string[] }> {'''),
        ('''export async function getWeekdayHeatmap(
  organizationId: string,
  weeksBack: number = 8,
  refDate: Date = new Date()
): Promise<{ rows: WeekdayHeatmapRow[]; weekdayLabels: typeof WEEKDAY_LABELS }> {''', '''export async function getWeekdayHeatmap(
  organizationId: string,
  weeksBack: number = 8,
  refDate: Date = new Date(),
  options: { buildingId?: string | null } = {}
): Promise<{ rows: WeekdayHeatmapRow[]; weekdayLabels: typeof WEEKDAY_LABELS }> {'''),
    ]),
    ("src/lib/compliance-trend.ts", [
        ('''export async function getComplianceTrend(
  organizationId: string,
  monthsBack: number = 12,
  refDate: Date = new Date()
): Promise<TrendPoint[]> {''', '''export async function getComplianceTrend(
  organizationId: string,
  monthsBack: number = 12,
  refDate: Date = new Date(),
  options: { buildingId?: string | null } = {}
): Promise<TrendPoint[]> {'''),
    ]),
]:
    s = read(p)
    for old, new in fn_sigs:
        assert s.count(old) == 1, (p, old[:60])
        s = s.replace(old, new)
    n = s.count("document: { organizationId },")
    assert n >= 1, (p, n)
    s = s.replace("document: { organizationId },", "document: { organizationId, ...buildingWhere(options.buildingId) },")
    s = add_import_after(s, r'^import \{ db \} from "@/lib/db";$', 'import { buildingWhere } from "@/lib/building-scope";', p)
    write(p, s)
    print(p, "document filters:", n)

p = "src/app/(dashboard)/reports/page.tsx"
s = read(p)
s = add_import_after(s, r'^import .* from "@/lib/auth-helpers";$',
                     'import { loadBuildingContext } from "@/lib/active-building";\nimport { buildingWhere } from "@/lib/building-scope";', p)
s = apply(p, s, [
    ('''  const orgId = getActiveOrgId(session);
  const now = new Date();''', '''  const orgId = getActiveOrgId(session);
  // Точки: графики и счётчики по документам — для активной точки; записи
  // поле-ориентированных журналов остаются на организацию.
  const buildingContext = await loadBuildingContext(session);
  const activeBuildingId = buildingContext.activeBuildingId;
  const now = new Date();''', 1),
    ('    getComplianceHeatmap(orgId, 30),', '    getComplianceHeatmap(orgId, 30, now, { buildingId: activeBuildingId }),', 1),
    ('    getWeekdayHeatmap(orgId, 8),', '    getWeekdayHeatmap(orgId, 8, now, { buildingId: activeBuildingId }),', 1),
    ('    getComplianceTrend(orgId, 12),', '    getComplianceTrend(orgId, 12, now, { buildingId: activeBuildingId }),', 1),
    ('        document: { organizationId: orgId },', '        document: { organizationId: orgId, ...buildingWhere(activeBuildingId) },', 2),
    ('        <ReportForm templates={templates} areas={areas} />', '''        {buildingContext.activeBuilding ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f5f6ff] px-3 py-1.5 text-[13px] text-[#3848c7]">
            Точка: <b className="font-semibold">{buildingContext.activeBuilding.name}</b> — графики и
            счётчики по документам считаются для неё
          </div>
        ) : null}
        <ReportForm templates={templates} areas={areas} />''', 1),
])
write(p, s)

# ---------- mini/home: background obligation sync ----------
p = "src/app/api/mini/home/route.ts"
s = read(p)
s = add_import_after(s, r'^import \{ db \} from "@/lib/db";$',
                     'import { scheduleObligationSync, utcDayKey } from "@/lib/obligation-sync-throttle";', p)
s = apply(p, s, [
    ('''    try {
      await syncDailyJournalObligationsForOrganization(
        getActiveOrgId(session),
        requestNow
      );
    } catch (syncErr) {
      console.error("[mini:home] org sync failed:", syncErr);
    }''', '''    // Сверка всей организации тяжёлая: ждём её только пока за сегодня нет
    // ни одной строки, дальше — в фоне, не чаще раза в минуту.
    try {
      const orgHasRowsToday =
        (await db.journalObligation.count({
          where: { organizationId: getActiveOrgId(session), dateKey: utcDayKey(requestNow) },
        })) > 0;
      await scheduleObligationSync(
        `org:${getActiveOrgId(session)}`,
        () => syncDailyJournalObligationsForOrganization(getActiveOrgId(session), requestNow),
        { force: !orgHasRowsToday },
      );
    } catch (syncErr) {
      console.error("[mini:home] org sync failed:", syncErr);
    }''', 1),
    ('''  try {
    await syncDailyJournalObligationsForUser({
      userId: session.user.id,
      organizationId: getActiveOrgId(session),
      now: requestNow,
    });
  } catch (syncErr) {
    console.error("[mini:home] user sync failed:", syncErr);
  }''', '''  try {
    const userHasRowsToday =
      (await db.journalObligation.count({
        where: { userId: session.user.id, dateKey: utcDayKey(requestNow) },
      })) > 0;
    await scheduleObligationSync(
      `user:${session.user.id}`,
      () =>
        syncDailyJournalObligationsForUser({
          userId: session.user.id,
          organizationId: getActiveOrgId(session),
          now: requestNow,
        }),
      { force: !userHasRowsToday },
    );
  } catch (syncErr) {
    console.error("[mini:home] user sync failed:", syncErr);
  }''', 1),
])
write(p, s)

# ---------- buildings [id] PATCH: kpp / phone ----------
patch("src/app/api/settings/buildings/[id]/route.ts", [
    ('''  address: z.string().trim().max(200).optional().nullable(),
  sortOrder: z.number().int().optional(),
});''', '''  address: z.string().trim().max(200).optional().nullable(),
  /// Точки: реквизиты точки для шапки PDF.
  kpp: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
});''', 1),
    ('''      ...(body.address !== undefined ? { address: body.address } : {}),''',
     '''      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.kpp !== undefined ? { kpp: body.kpp || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),''', 1),
])

# ---------- profile complete: return created buildings ----------
patch("src/app/api/profile/complete/route.ts", [
    ('''  return NextResponse.json({ ok: true });''', '''  // Точки: анкета показывает шаг «Назовите точки» — отдаём созданные.
  const buildings =
    data.locationsCount >= 2
      ? await db.building.findMany({
          where: { organizationId },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, address: true },
        })
      : [];
  return NextResponse.json({ ok: true, buildings });''', 1),
])

# ---------- export / inspector / compliance bundle: location labels ----------
patch("src/app/api/settings/organization/export/route.ts", [
    ('''  const zip = new JSZip();''', '''  // Точки: справочник точек, чтобы buildingId в документах читался.
  const buildings = await db.building.findMany({
    where: { organizationId: orgId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, address: true, kpp: true, phone: true },
  });

  const zip = new JSZip();''', 1),
    ('''  zip.file("journal-documents.json", fmt(documents));''',
     '''  zip.file("buildings.json", fmt(buildings));
  zip.file("journal-documents.json", fmt(documents));''', 1),
])
patch("src/app/inspector/[token]/[code]/page.tsx", [
    ('''      status: true,
      // Тот же фикс что в /api/inspector/[token]/pdf — не считать''', '''      status: true,
      building: { select: { name: true } },
      // Тот же фикс что в /api/inspector/[token]/pdf — не считать''', 1),
    ('''                  <div className="mt-1 text-[12px] text-[#6f7282]">
                    {formatRange(doc.dateFrom, doc.dateTo)} ·{" "}''', '''                  <div className="mt-1 text-[12px] text-[#6f7282]">
                    {doc.building ? <>{doc.building.name} ·{" "}</> : null}
                    {formatRange(doc.dateFrom, doc.dateTo)} ·{" "}''', 1),
])
patch("src/app/api/inspector/[token]/pdf/route.ts", [
    ('''        status: true,
        // Считаем только реально заполненные строки. _autoSeeded —''', '''        status: true,
        building: { select: { name: true } },
        // Считаем только реально заполненные строки. _autoSeeded —''', 1),
    ('''        d.title,
        `${fmt(d.dateFrom)} — ${fmt(d.dateTo)}`,''', '''        [d.title, d.building?.name].filter(Boolean).join(" · "),
        `${fmt(d.dateFrom)} — ${fmt(d.dateTo)}`,''', 1),
])
patch("src/app/api/reports/compliance-bundle/route.ts", [
    ('''    include: {
      template: { select: { code: true, name: true } },
    },''', '''    include: {
      template: { select: { code: true, name: true } },
      building: { select: { name: true } },
    },''', 1),
    ('''      `${doc.title} · ${ymd(doc.dateFrom)}..${ymd(doc.dateTo)}`''',
     '''      `${doc.title}${doc.building ? ` · ${doc.building.name}` : ""} · ${ymd(doc.dateFrom)}..${ymd(doc.dateTo)}`''', 1),
])

# ---------- PageHeader: actions wrap under the title instead of squeezing it ----------
patch("src/components/ui/page-header.tsx", [
    ('''      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">''', '''      className={cn(
        // flex-wrap: когда действий много (страница сотрудников — семь
        // кнопок), они переносятся под заголовок, а не сжимают описание
        // в узкий столбец.
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 sm:min-w-[320px] sm:flex-1">''', 1),
    ('''        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">''',
     '''        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">''', 1),
])

# ---------- tsconfig: proxy.ts ----------
for p in ["tsconfig.json", "tsconfig.typecheck.json"]:
    s = read(p)
    if '"proxy.ts"' not in s:
        s = s.replace('"middleware.ts",', '"middleware.ts",\n    "proxy.ts",', 1)
        write(p, s)

# ---------- whats-new ----------
patch("src/lib/whats-new-notes.ts", [
    ('''      "Новый сотрудник по умолчанию привязывается к активной точке; на странице сотрудников видно, сколько человек без точки получают задачи со всех точек.",
    ],
  },''', '''      "Новый сотрудник по умолчанию привязывается к активной точке; на странице сотрудников видно, сколько человек без точки получают задачи со всех точек.",
      "На дашборде — сводка по точкам: сколько журналов заполнено сегодня на каждой, клик переключает точку. После анкеты — шаг «Назовите точки», чтобы имена и адреса были сразу.",
      "«Закрыть день без событий» и снимки журналов теперь свои у каждой точки; общие документы без точки подписаны «Общий»; отчёты, экспорт и ссылка для инспектора показывают точку.",
      "В карточке точки — кто здесь работает, КПП и телефон для шапки PDF. Главная Mini App открывается быстрее: сверка задач идёт в фоне.",
    ],
  },''', 1),
])
print("round 3a done")
