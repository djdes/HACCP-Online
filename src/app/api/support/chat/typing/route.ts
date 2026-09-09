import { NextResponse } from "next/server";

import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { findOrgThread, publishSupportToOperators } from "@/lib/support-threads";
import { acceptTypingPing } from "@/lib/support-typing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — «клиент печатает». Эфемерно: в базу не пишем, только событие
 * тем, кто отвечает (ROOT в админке, участники партнёра). Ветки ещё нет
 * (первое сообщение не отправлено) — молчим: показывать «печатает» некому.
 */
const seen = new Map<string, number>();

export async function POST() {
  const session = await requireAuth();
  if (session.user.partnerAccess) return new NextResponse(null, { status: 204 });
  if (!acceptTypingPing(seen, session.user.id, Date.now())) {
    return new NextResponse(null, { status: 204 });
  }
  const thread = await findOrgThread(getActiveOrgId(session));
  if (thread) {
    await publishSupportToOperators(thread, {
      kind: "typing",
      data: { name: session.user.name ?? null },
    });
  }
  return new NextResponse(null, { status: 204 });
}
