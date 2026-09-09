import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { IDEAS_PER_ORG_PER_DAY, filterIdeas, sortIdeas, validateIdeaInput, type IdeaFilter, type IdeaSort } from "@/lib/ideas/rules";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?sort=top|new&filter=open|done|all — идеи всех клиентов, с отметками «моя» и «голосовал». */
export async function GET(request: Request) {
  const session = await requireAuth();
  const { searchParams } = new URL(request.url);
  const sort: IdeaSort = searchParams.get("sort") === "new" ? "new" : "top";
  const filterParam = searchParams.get("filter");
  const filter: IdeaFilter = filterParam === "done" || filterParam === "all" ? filterParam : "open";
  const orgId = getActiveOrgId(session);

  const [ideas, votes] = await Promise.all([
    db.idea.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        votes: true,
        adminNote: true,
        organizationId: true,
        createdAt: true,
        statusChangedAt: true,
      },
      take: 500,
    }),
    db.ideaVote.findMany({ where: { userId: session.user.id }, select: { ideaId: true } }),
  ]);
  const voted = new Set(votes.map((v) => v.ideaId));
  const list = sortIdeas(filterIdeas(ideas, filter), sort).map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    status: i.status,
    votes: i.votes,
    adminNote: i.adminNote,
    createdAt: i.createdAt.toISOString(),
    statusChangedAt: i.statusChangedAt?.toISOString() ?? null,
    mine: i.organizationId === orgId,
    voted: voted.has(i.id),
  }));
  const doneCount = ideas.filter((i) => i.status === "done").length;
  return NextResponse.json({ ideas: list, doneCount, canPost: hasFullWorkspaceAccess(session.user) });
}

/** POST { title, description } — предложить идею (руководство, не больше 5 в сутки на организацию). */
export async function POST(request: Request) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Предлагать идеи могут руководители" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; description?: unknown };
  const parsed = validateIdeaInput({ title: body.title, description: body.description });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const orgId = getActiveOrgId(session);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.idea.count({ where: { organizationId: orgId, createdAt: { gte: since } } });
  if (recent >= IDEAS_PER_ORG_PER_DAY) {
    return NextResponse.json({ error: `Не больше ${IDEAS_PER_ORG_PER_DAY} идей в сутки — остальные завтра` }, { status: 429 });
  }

  // Автор голосует за свою идею сразу — иначе у каждой новой идеи ноль.
  const idea = await db.idea.create({
    data: {
      organizationId: orgId,
      authorId: session.user.id,
      title: parsed.title,
      description: parsed.description,
      votes: 1,
      voteRows: { create: { userId: session.user.id } },
    },
    select: { id: true, title: true, description: true, status: true, votes: true, createdAt: true },
  });
  await recordAuditLog({
    organizationId: orgId,
    session,
    request,
    action: "idea.create",
    entity: "Idea",
    entityId: idea.id,
    details: { title: idea.title },
  });
  return NextResponse.json(
    { idea: { ...idea, createdAt: idea.createdAt.toISOString(), statusChangedAt: null, adminNote: null, mine: true, voted: true } },
    { status: 201 }
  );
}
