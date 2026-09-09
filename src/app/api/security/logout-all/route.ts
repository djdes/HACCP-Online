import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { CUSTOM_SESSION_COOKIE } from "@/lib/auth-cookies";
import { requireAuth } from "@/lib/auth-helpers";
import { clearLegacyCookies } from "@/lib/issue-session";
import { bumpSessionVersion } from "@/lib/session-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — завершить все сессии: версия сессий растёт, все выданные
 * токены (на всех устройствах, включая это) перестают проходить.
 * Куки этого браузера чистим сразу, чтобы не ждать первого 401.
 */
export async function POST(request: Request) {
  const session = await requireAuth();
  await bumpSessionVersion(session.user.id);
  await recordAuditLog({
    organizationId: session.user.organizationId,
    session,
    request,
    action: "security.logout-all",
    entity: "User",
    entityId: session.user.id,
  });
  const response = NextResponse.json({ ok: true, redirect: "/login" });
  clearLegacyCookies(response);
  response.cookies.set(CUSTOM_SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}
