import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePartnerApi } from "@/lib/partners/api";
import { latestMessageOf, listPartnerOrgIds } from "@/lib/support-threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Статус чатов партнёра для фонового опроса: сколько реплик ждёт ответа
 * и какая ветка написала последней. Формат `latest` совпадает с клиентским
 * статусом, чтобы один и тот же хук решал «пора ли сигналить».
 */
export async function GET() {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const headers = { "Cache-Control": "no-store" };
  const orgIds = await listPartnerOrgIds(auth.ctx.membership.partnerId);
  if (orgIds.length === 0) {
    return NextResponse.json({ threadId: null, unreadForClient: 0, latest: null, organizationName: null }, { headers });
  }

  const [sum, newest] = await Promise.all([
    db.supportThread.aggregate({
      where: { organizationId: { in: orgIds }, unreadForStaff: { gt: 0 } },
      _sum: { unreadForStaff: true },
    }),
    db.supportThread.findFirst({
      where: { organizationId: { in: orgIds }, unreadForStaff: { gt: 0 } },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true, organizationName: true },
    }),
  ]);
  const latest = newest ? await latestMessageOf(newest.id) : null;
  return NextResponse.json(
    {
      threadId: newest?.id ?? null,
      // Для партнёра «непрочитанное» — реплики клиентов без ответа.
      unreadForClient: sum._sum.unreadForStaff ?? 0,
      // Хук ждёт реплику «оператора» как чужую; для партнёра чужая — клиентская.
      latest: latest ? { ...latest, author: "operator" as const, operatorName: newest?.organizationName ?? null } : null,
      organizationName: newest?.organizationName ?? null,
    },
    { headers }
  );
}
