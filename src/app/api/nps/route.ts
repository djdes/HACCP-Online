import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isNpsScore } from "@/lib/nps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { score, comment? } — ответ; POST { dismiss: true } — «не сейчас» (спросим через 90 дней). */
export async function POST(request: Request) {
  const session = await requireAuth();
  const body = (await request.json().catch(() => ({}))) as { score?: unknown; comment?: unknown; dismiss?: unknown };
  const now = new Date();
  if (body.dismiss === true) {
    await db.user.update({ where: { id: session.user.id }, data: { npsAskedAt: now } });
    return NextResponse.json({ ok: true, dismissed: true });
  }
  if (!isNpsScore(body.score)) return NextResponse.json({ error: "Оценка — от 0 до 10" }, { status: 400 });
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : "";
  await db.$transaction([
    db.npsResponse.create({ data: { organizationId: session.user.organizationId, userId: session.user.id, score: body.score, comment: comment || null } }),
    db.user.update({ where: { id: session.user.id }, data: { npsAskedAt: now } }),
  ]);
  return NextResponse.json({ ok: true });
}
