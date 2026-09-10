import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { computeNps } from "@/lib/nps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — NPS за 90 дней и за всё время, последние ответы с комментариями. */
export async function GET() {
  await requireRoot();
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [recent, all, latest] = await Promise.all([
    db.npsResponse.findMany({ where: { createdAt: { gte: since } }, select: { score: true } }),
    db.npsResponse.findMany({ select: { score: true } }),
    db.npsResponse.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, score: true, comment: true, createdAt: true, organizationId: true, userId: true } }),
  ]);
  const orgIds = Array.from(new Set(latest.map((r) => r.organizationId)));
  const orgs = orgIds.length ? await db.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  return NextResponse.json({
    last90: computeNps(recent.map((r) => r.score)),
    allTime: computeNps(all.map((r) => r.score)),
    latest: latest.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), organization: orgName.get(r.organizationId) ?? r.organizationId })),
  });
}
