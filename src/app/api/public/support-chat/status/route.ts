import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GUEST_ID_PATTERN, guestThreadKey } from "@/lib/public-support";
import { latestMessageOf } from "@/lib/support-threads";
import type { SupportStatus } from "@/lib/support-threads-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY: SupportStatus = { threadId: null, unreadForClient: 0, latest: null };

/** Статус гостевой ветки для фонового опроса виджета на лендинге. */
export async function GET(request: Request) {
  const guestId = new URL(request.url).searchParams.get("guestId") ?? "";
  const headers = { "Cache-Control": "no-store" };
  if (!GUEST_ID_PATTERN.test(guestId)) {
    return NextResponse.json(EMPTY, { headers });
  }
  const thread = await db.supportThread.findUnique({
    where: { key: guestThreadKey(guestId) },
    select: { id: true, unreadForClient: true },
  });
  if (!thread) return NextResponse.json(EMPTY, { headers });
  const status: SupportStatus = {
    threadId: thread.id,
    unreadForClient: thread.unreadForClient,
    latest: await latestMessageOf(thread.id),
  };
  return NextResponse.json(status, { headers });
}
