import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { THREAD_SELECT, publishSupportToClient } from "@/lib/support-threads";
import { acceptTypingPing } from "@/lib/support-typing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — «оператор печатает» в ветке. Событие уходит всем вкладкам
 * организации; клиент видит «Поддержка печатает…» в чате. Без записи в базу.
 */
const seen = new Map<string, number>();

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireRoot();
  const { id } = await ctx.params;
  if (!acceptTypingPing(seen, `${session.user.id}:${id}`, Date.now())) {
    return new NextResponse(null, { status: 204 });
  }
  const thread = await db.supportThread.findUnique({ where: { id }, select: THREAD_SELECT });
  if (thread) {
    publishSupportToClient(thread, { kind: "typing", data: { name: "Поддержка WeSetup" } });
  }
  return new NextResponse(null, { status: 204 });
}
