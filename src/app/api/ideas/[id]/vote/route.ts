import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — переключить голос: был → снять, не было → поставить. Один голос на человека. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await params;
  const idea = await db.idea.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!idea) return NextResponse.json({ error: "Идея не найдена" }, { status: 404 });
  if (idea.status === "done" || idea.status === "declined") {
    return NextResponse.json({ error: "Голосование по этой идее закрыто" }, { status: 409 });
  }
  const userId = session.user.id;
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.ideaVote.findUnique({ where: { ideaId_userId: { ideaId: id, userId } } });
    if (existing) {
      await tx.ideaVote.delete({ where: { id: existing.id } });
      const updated = await tx.idea.update({ where: { id }, data: { votes: { decrement: 1 } }, select: { votes: true } });
      return { voted: false, votes: Math.max(0, updated.votes) };
    }
    await tx.ideaVote.create({ data: { ideaId: id, userId } });
    const updated = await tx.idea.update({ where: { id }, data: { votes: { increment: 1 } }, select: { votes: true } });
    return { voted: true, votes: updated.votes };
  });
  return NextResponse.json(result);
}
