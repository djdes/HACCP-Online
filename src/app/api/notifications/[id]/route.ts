import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/notifications/[id] — «Прочитать»: marks a row as read. 404s
 * when the row doesn't belong to the caller.
 */
export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  const { id } = await context.params;
  const existing = await db.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/notifications/[id] — «Удалить»: dismisses the row so it
 * disappears from both «Новые» и «Прочитанные».
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  const { id } = await context.params;
  const existing = await db.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const now = new Date();
  await db.notification.update({
    where: { id },
    data: { dismissedAt: now, readAt: now },
  });
  return NextResponse.json({ ok: true });
}
