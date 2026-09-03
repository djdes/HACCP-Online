import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { actorName, readJson, requirePartnerApi } from "@/lib/partners/api";
import { supportOperatorLimiter } from "@/lib/rate-limit";
import {
  SupportThreadError,
  deliverOperatorMessage,
  listPartnerOrgIds,
  parseOperatorInput,
  postOperatorMessage,
  resolveReplyTarget,
} from "@/lib/support-threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ответ партнёра в ветку своей организации. */
export async function POST(request: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { session, membership } = auth.ctx;
  const { threadId } = await ctx.params;

  const source = await db.supportThread.findUnique({
    where: { id: threadId },
    select: { organizationId: true },
  });
  const orgIds = source?.organizationId ? await listPartnerOrgIds(membership.partnerId) : [];
  if (!source?.organizationId || !orgIds.includes(source.organizationId)) {
    return NextResponse.json({ error: "Ветка не найдена" }, { status: 404 });
  }

  const input = parseOperatorInput(await readJson(request), session.user.id);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  if (!supportOperatorLimiter.consume(session.user.id)) {
    return NextResponse.json({ error: "Слишком много сообщений подряд" }, { status: 429 });
  }

  try {
    const target = await resolveReplyTarget(threadId);
    const operator = {
      kind: "partner" as const,
      name: `${membership.partner.brandName} · ${actorName(session)}`,
      userId: session.user.id,
      partnerId: membership.partnerId,
    };
    const posted = await postOperatorMessage({
      threadId: target.thread.id,
      body: input.body,
      attachments: input.attachments,
      operator,
    });
    after(() =>
      deliverOperatorMessage({ ...posted, operator }).catch((error) =>
        console.error("[partner-chats] delivery failed:", error)
      )
    );
    return NextResponse.json({
      threadId: target.thread.id,
      redirected: target.redirected,
      message: posted.message,
    });
  } catch (error) {
    if (error instanceof SupportThreadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
