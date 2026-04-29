import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NOT_AUTO_SEEDED } from "@/lib/journal-entry-filters";
import { authenticateExternalRequest, tokenHint } from "@/lib/external/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/external/summary?orgId=<id>&date=YYYY-MM-DD
 *
 * Returns a daily fill-rate report for external apps so they can render a
 * "X of 35 journals filled today" badge without scraping every document.
 * Bearer auth; a per-org token overrides the `orgId` query.
 */
export async function GET(request: Request) {
  const auth = await authenticateExternalRequest(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateStr =
    searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const organizationId =
    auth.source === "organization" && auth.organizationId
      ? auth.organizationId
      : searchParams.get("orgId");

  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "orgId query parameter required for shared tokens" },
      { status: 400 }
    );
  }

  const day = new Date(`${dateStr}T00:00:00.000Z`);
  if (!Number.isFinite(day.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid date" }, { status: 400 });
  }
  const nextDay = new Date(day);
  nextDay.setUTCDate(day.getUTCDate() + 1);

  const [templates, entryCounts, documentCounts] = await Promise.all([
    db.journalTemplate.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    db.journalDocumentEntry.groupBy({
      by: ["documentId"],
      where: {
        date: { gte: day, lt: nextDay },
        document: { organizationId, status: "active" },
        ...NOT_AUTO_SEEDED,
      },
      _count: { _all: true },
    }),
    db.journalDocument.findMany({
      where: {
        organizationId,
        status: "active",
        dateFrom: { lte: day },
        dateTo: { gte: day },
      },
      select: { id: true, templateId: true },
    }),
  ]);

  const entriesByDoc = new Map(
    entryCounts.map((row) => [row.documentId, row._count._all])
  );
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const perCode = new Map<
    string,
    { name: string; entries: number; documents: number }
  >();
  for (const t of templates) {
    perCode.set(t.code, { name: t.name, entries: 0, documents: 0 });
  }
  for (const doc of documentCounts) {
    const template = templateById.get(doc.templateId);
    if (!template) continue;
    const agg = perCode.get(template.code);
    if (!agg) continue;
    agg.documents += 1;
    agg.entries += entriesByDoc.get(doc.id) || 0;
  }

  const journals = [...perCode.entries()].map(([code, info]) => ({
    code,
    name: info.name,
    entriesOnDate: info.entries,
    hasActiveDocument: info.documents > 0,
    filled: info.entries > 0,
  }));

  return NextResponse.json({
    ok: true,
    organizationId,
    date: dateStr,
    totalJournals: journals.length,
    filledJournals: journals.filter((j) => j.filled).length,
    journals,
    tokenHint: tokenHint(auth.token),
  });
}
