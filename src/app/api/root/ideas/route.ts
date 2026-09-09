import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { sortIdeas } from "@/lib/ideas/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — все идеи с организацией и автором (только ROOT). */
export async function GET() {
  await requireRoot();
  const ideas = await db.idea.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      votes: true,
      adminNote: true,
      organizationId: true,
      authorId: true,
      createdAt: true,
      statusChangedAt: true,
    },
    take: 1000,
  });
  const orgIds = Array.from(new Set(ideas.map((i) => i.organizationId)));
  const authorIds = Array.from(new Set(ideas.map((i) => i.authorId)));
  const [orgs, authors] = await Promise.all([
    orgIds.length ? db.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : [],
    authorIds.length ? db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } }) : [],
  ]);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const author = new Map(authors.map((a) => [a.id, a]));
  return NextResponse.json({
    ideas: sortIdeas(ideas, "new").map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
      votes: i.votes,
      adminNote: i.adminNote,
      createdAt: i.createdAt.toISOString(),
      statusChangedAt: i.statusChangedAt?.toISOString() ?? null,
      organization: orgName.get(i.organizationId) ?? i.organizationId,
      author: author.get(i.authorId)?.name ?? author.get(i.authorId)?.email ?? "—",
    })),
  });
}
