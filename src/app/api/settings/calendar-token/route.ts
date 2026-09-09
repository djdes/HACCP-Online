import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth-helpers";
import { calendarFeedUrl, revokeCalendarToken, rotateCalendarToken } from "@/lib/calendar/token";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return { session, denied: NextResponse.json({ error: "Доступно руководителям" }, { status: 403 }) };
  }
  return { session, denied: null };
}

/** GET — текущая ссылка (или null). */
export async function GET() {
  const { session, denied } = await guard();
  if (denied) return denied;
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { calendarToken: true } });
  const token = user?.calendarToken ?? null;
  return NextResponse.json({ token, url: token ? calendarFeedUrl(token) : null });
}

/** POST — создать или перевыпустить ссылку (старая перестаёт работать). */
export async function POST(request: Request) {
  const { session, denied } = await guard();
  if (denied) return denied;
  const token = await rotateCalendarToken(session.user.id);
  await recordAuditLog({
    organizationId: session.user.organizationId,
    session,
    request,
    action: "calendar.token.rotate",
    entity: "User",
    entityId: session.user.id,
  });
  return NextResponse.json({ token, url: calendarFeedUrl(token) });
}

/** DELETE — отключить ссылку. */
export async function DELETE(request: Request) {
  const { session, denied } = await guard();
  if (denied) return denied;
  await revokeCalendarToken(session.user.id);
  await recordAuditLog({
    organizationId: session.user.organizationId,
    session,
    request,
    action: "calendar.token.revoke",
    entity: "User",
    entityId: session.user.id,
  });
  return NextResponse.json({ ok: true });
}
