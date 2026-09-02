import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePartnerApi } from "@/lib/partners/api";
import { isPartnerAccessLevel } from "@/lib/partners/access-guard";
import { getActiveClientLink } from "@/lib/partners/client-card";
import { rewriteSessionClaims } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Открыть кабинет клиента». Единственное место, где в сессию попадает
 * claim partnerAccess: проверяем активную привязку именно этого партнёра
 * к этой организации и пишем уровень доступа, выбранный клиентом.
 * Дальше middleware и Prisma-расширение работают от этого claim.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { membership, session } = auth.ctx;
  const { orgId } = await ctx.params;

  const link = await getActiveClientLink(membership.partnerId, orgId);
  if (!link) {
    return NextResponse.json(
      { error: "Клиент отключил сопровождение или ещё не подключён", code: "not_attached" },
      { status: 403 },
    );
  }
  const level = isPartnerAccessLevel(link.accessLevel) ? link.accessLevel : "view";

  const rewrite = await rewriteSessionClaims({
    activeOrganizationId: orgId,
    partnerAccess: { partnerId: membership.partnerId, organizationId: orgId, level },
  });
  if (!rewrite.ok) return NextResponse.json({ error: rewrite.reason }, { status: 500 });

  // В журнал клиента: кто из партнёра и с каким уровнем открыл кабинет.
  await db.auditLog.create({
    data: {
      organizationId: orgId,
      userId: session.user.id,
      userName: `партнёр: ${membership.partner.brandName}, ${session.user.name ?? session.user.email ?? "сотрудник"}`,
      action: "partner.cabinet_opened",
      entity: "organization",
      entityId: orgId,
      details: { partnerId: membership.partnerId, level },
    },
  });

  return NextResponse.json({ ok: true, level });
}
