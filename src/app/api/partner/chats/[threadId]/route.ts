import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePartnerApi } from "@/lib/partners/api";
import { SUPPORT_CHAT_HISTORY_LIMIT } from "@/lib/support-chat";
import { MESSAGE_SELECT, listPartnerOrgIds, toMessageDto } from "@/lib/support-threads";
import { threadKindOf } from "@/lib/support-threads-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Переписка одной ветки. Гостевые и чужие ветки — 404, без подсказок. */
export async function GET(_request: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { threadId } = await ctx.params;

  const thread = await db.supportThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      key: true,
      organizationId: true,
      organizationName: true,
      userName: true,
      userEmail: true,
      phone: true,
      unreadForStaff: true,
    },
  });
  const orgIds = thread?.organizationId
    ? await listPartnerOrgIds(auth.ctx.membership.partnerId)
    : [];
  if (!thread || !thread.organizationId || !orgIds.includes(thread.organizationId)) {
    return NextResponse.json({ error: "Ветка не найдена" }, { status: 404 });
  }

  const messages = await db.supportMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
    take: SUPPORT_CHAT_HISTORY_LIMIT,
    select: MESSAGE_SELECT,
  }).then((rows) => rows.reverse());

  return NextResponse.json({
    thread: {
      id: thread.id,
      kind: threadKindOf(thread.key),
      organizationId: thread.organizationId,
      organizationName: thread.organizationName,
      userName: thread.userName,
      userEmail: thread.userEmail,
      phone: thread.phone,
      unreadForStaff: thread.unreadForStaff,
    },
    messages: messages.map(toMessageDto),
  });
}
