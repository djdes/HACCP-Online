import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notifications — returns the current user's notification bucket,
 * split into «Новые» (unread) and «Прочитанные» (read), both excluding
 * dismissed rows.
 */
export async function GET() {
  const session = await requireAuth();
  const rows = await db.notification.findMany({
    where: { userId: session.user.id, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = rows.filter((n) => !n.readAt);
  const read = rows.filter((n) => !!n.readAt);
  return NextResponse.json({
    unread,
    read,
    unreadCount: unread.length,
  });
}

/**
 * DELETE /api/notifications — «Удалить все»: dismisses every not-yet
 * dismissed row for the current user.
 */
export async function DELETE() {
  const session = await requireAuth();
  const now = new Date();
  await db.notification.updateMany({
    where: { userId: session.user.id, dismissedAt: null },
    data: { dismissedAt: now, readAt: now },
  });
  return NextResponse.json({ ok: true });
}
