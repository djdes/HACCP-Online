import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { supportBroadcastLimiter } from "@/lib/rate-limit";
import { SUPPORT_CHAT_MAX_LENGTH } from "@/lib/support-chat";
import {
  deliverOperatorMessage,
  getOrCreateOrgThread,
  getPartnerThreadOwnership,
  postOperatorMessage,
} from "@/lib/support-threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Сотни организаций × Telegram: обработка идёт в after(), но лимит на
// всякий случай поднимаем.
export const maxDuration = 300;

const PLATFORM_ORG_ID = (process.env.PLATFORM_ORG_ID ?? "platform").trim();

const schema = z.object({
  message: z.string().trim().min(10, "Напишите хотя бы пару предложений").max(SUPPORT_CHAT_MAX_LENGTH),
  /** Генерируется клиентом при открытии диалога: повтор не дублирует рассылку. */
  broadcastId: z.string().uuid("Некорректный id рассылки"),
  includePartnerManaged: z.boolean().default(true),
});

/**
 * Рассылка ROOT «всем организациям»: сообщение в чат каждой организации,
 * Telegram руководству и колокольчик. Отвечаем сразу числом организаций,
 * сами сообщения пишем в after() последовательно — Telegram не любит залпы.
 */
export async function POST(request: Request) {
  const session = await requireRoot();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }
  if (!supportBroadcastLimiter.consume(session.user.id)) {
    return NextResponse.json(
      { error: "Рассылка уже запущена недавно — подождите 10 минут" },
      { status: 429 }
    );
  }

  const { message, broadcastId, includePartnerManaged } = parsed.data;
  let orgs = await db.organization.findMany({
    where: { isDemo: false, id: { not: PLATFORM_ORG_ID } },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!includePartnerManaged) {
    const owned = await getPartnerThreadOwnership(orgs.map((o) => o.id));
    orgs = orgs.filter((o) => !owned.has(o.id));
  }

  const operator = {
    kind: "admin" as const,
    name: "Поддержка WeSetup",
    userId: session.user.id,
    partnerId: null,
  };

  after(async () => {
    let sent = 0;
    for (const org of orgs) {
      try {
        const thread = await getOrCreateOrgThread(org.id, {
          organizationName: org.name,
          userEmail: null,
          userName: null,
          phone: null,
        });
        const duplicate = await db.supportMessage.findFirst({
          where: { threadId: thread.id, broadcastId },
          select: { id: true },
        });
        if (duplicate) continue;
        const posted = await postOperatorMessage({
          threadId: thread.id,
          body: message,
          attachments: [],
          operator,
          broadcastId,
        });
        await deliverOperatorMessage({ ...posted, operator });
        sent += 1;
      } catch (error) {
        console.error(`[root-support] broadcast to ${org.id} failed:`, error);
      }
    }
    console.info(`[root-support] broadcast ${broadcastId}: ${sent}/${orgs.length}`);
  });

  return NextResponse.json({ organizations: orgs.length, broadcastId });
}
