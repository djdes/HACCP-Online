import { NextResponse } from "next/server";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { findOrgThread, latestMessageOf } from "@/lib/support-threads";
import type { SupportStatus } from "@/lib/support-threads-shared";

export const dynamic = "force-dynamic";

/**
 * Дешёвый статус чата для фонового опроса: есть ли непрочитанный ответ и
 * какая реплика последняя. Два индексированных чтения, ничего не пишет —
 * усыновление legacy-ветки делает первый GET самого чата.
 */
export async function GET() {
  const session = await requireAuth();
  const thread = await findOrgThread(getActiveOrgId(session));
  const status: SupportStatus = thread
    ? {
        threadId: thread.id,
        unreadForClient: thread.unreadForClient,
        latest: await latestMessageOf(thread.id),
      }
    : { threadId: null, unreadForClient: 0, latest: null };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
