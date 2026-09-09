import { NextResponse } from "next/server";

import { issueSession } from "@/lib/issue-session";
import { recordLogin } from "@/lib/login-trace";
import { createRateLimiter } from "@/lib/rate-limit";
import { verifyTelegramChallenge } from "@/lib/two-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Перебор кодов ограничен и попытками челленджа (5), и IP: 15 за 5 минут.
const limiter = createRateLimiter({ tokensPerInterval: 15, intervalMs: 5 * 60 * 1000 });

/** POST { challengeId, code } — второй шаг входа: код из Telegram → сессия. */
export async function POST(request: Request) {
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  if (!limiter.consume(`login-code:${ip}`)) {
    return NextResponse.json({ error: "Слишком много попыток. Подождите 5 минут." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { challengeId?: unknown; code?: unknown };
  const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!challengeId || !code) return NextResponse.json({ error: "Введите код" }, { status: 400 });

  const result = await verifyTelegramChallenge(challengeId, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  await recordLogin(result.user.id, ip === "unknown" ? null : ip, {
    userAgent: request.headers.get("user-agent"),
    method: result.method,
  });
  return issueSession(NextResponse.json({ success: true }), result.user, result.user.organization.name);
}
