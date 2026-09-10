import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { issueSession } from "@/lib/issue-session";
import { recordLogin } from "@/lib/login-trace";
import { consumeMagicLink } from "@/lib/magic-link";
import { twoFactorRequired } from "@/lib/two-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginRedirect(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/login?magic=${reason}`, request.url));
}

/** GET /api/auth/magic/<token> — по ссылке из письма: сессия и переход в кабинет. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verdict = await consumeMagicLink(token);
  if (!verdict.ok) return loginRedirect(request, verdict.reason);
  const user = await db.user.findUnique({ where: { id: verdict.userId }, include: { organization: true } });
  if (!user || !user.isActive) return loginRedirect(request, "invalid");
  // Код в Telegram включён — ссылка из письма его не заменяет: вход только по паролю с кодом.
  if (twoFactorRequired(user)) return loginRedirect(request, "two-factor");

  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || null;
  await recordLogin(user.id, ip, { userAgent: request.headers.get("user-agent"), method: "magic" });
  return issueSession(NextResponse.redirect(new URL("/dashboard", request.url)), user, user.organization.name);
}
