import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { actorName, readJson, requirePartnerApi } from "@/lib/partners/api";
import { supportOperatorLimiter } from "@/lib/rate-limit";
import {
  MESSAGE_SELECT,
  deliverOperatorMessage,
  getOrCreateOrgThread,
  listPartnerOrgIds,
  parseOperatorInput,
  postOperatorMessage,
  toMessageDto,
} from "@/lib/support-threads";
import { previewOf, threadKindOf } from "@/lib/support-threads-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Чаты партнёра: ветки организаций с активной привязкой.
 *
 * GET — список веток (последняя реплика, непрочитанное) и список
 *       клиентов, чтобы «написать первым» тем, у кого ветки ещё нет.
 * POST — партнёр пишет организации первым: `{ organizationId, message, attachments }`.
 */
export async function GET() {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const orgIds = await listPartnerOrgIds(auth.ctx.membership.partnerId);

  const [threads, clients] = await Promise.all([
    orgIds.length
      ? db.supportThread.findMany({
          where: { organizationId: { in: orgIds } },
          orderBy: { lastMessageAt: "desc" },
          take: 200,
          select: {
            id: true,
            key: true,
            organizationId: true,
            organizationName: true,
            userName: true,
            lastMessageAt: true,
            unreadForStaff: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: MESSAGE_SELECT,
            },
          },
        })
      : [],
    orgIds.length
      ? db.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  const threadByOrg = new Map<string, string>();
  for (const t of threads) {
    if (t.organizationId && threadKindOf(t.key) === "org") {
      threadByOrg.set(t.organizationId, t.id);
    }
  }

  return NextResponse.json({
    threads: threads.map((t) => {
      const last = t.messages[0] ? toMessageDto(t.messages[0]) : null;
      return {
        id: t.id,
        kind: threadKindOf(t.key),
        organizationId: t.organizationId,
        organizationName: t.organizationName,
        userName: t.userName,
        lastMessageAt: t.lastMessageAt.toISOString(),
        unreadForStaff: t.unreadForStaff,
        last: last
          ? {
              author: last.author,
              preview: previewOf(last.body, last.attachments.length),
              createdAt: last.createdAt.toISOString(),
            }
          : null,
      };
    }),
    clients: clients.map((c) => ({
      organizationId: c.id,
      name: c.name,
      threadId: threadByOrg.get(c.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { session, membership } = auth.ctx;

  const body = await readJson<{ organizationId?: string }>(request);
  const organizationId = String(body.organizationId ?? "");
  const orgIds = await listPartnerOrgIds(membership.partnerId);
  if (!organizationId || !orgIds.includes(organizationId)) {
    return NextResponse.json({ error: "Организация не привязана к вам" }, { status: 404 });
  }
  const input = parseOperatorInput(body, session.user.id);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  if (!supportOperatorLimiter.consume(session.user.id)) {
    return NextResponse.json({ error: "Слишком много сообщений подряд" }, { status: 429 });
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const thread = await getOrCreateOrgThread(organizationId, {
    organizationName: organization?.name ?? null,
    userEmail: null,
    userName: null,
    phone: null,
  });
  const operator = {
    kind: "partner" as const,
    name: `${membership.partner.brandName} · ${actorName(session)}`,
    userId: session.user.id,
    partnerId: membership.partnerId,
  };
  const posted = await postOperatorMessage({
    threadId: thread.id,
    body: input.body,
    attachments: input.attachments,
    operator,
  });
  after(() =>
    deliverOperatorMessage({ ...posted, operator }).catch((error) =>
      console.error("[partner-chats] delivery failed:", error)
    )
  );
  return NextResponse.json({ threadId: thread.id, message: posted.message });
}
