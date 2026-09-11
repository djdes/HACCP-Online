import { NextResponse } from "next/server";

import { readJson, requirePartnerApi } from "@/lib/partners/api";
import {
  createClientOrganization,
  parseCreateClientOrganization,
} from "@/lib/partners/client-organizations";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — партнёр заводит организацию нового клиента.
 *
 * Организация принадлежит клиенту: своя подписка, свой аккаунт. Партнёр
 * получает к ней доступ как консультант и может настроить журналы,
 * должности и сотрудников до того, как клиент впервые войдёт.
 *
 * Владельца можно указать сразу (тогда ему уйдёт приглашение) или позже,
 * через `POST /api/partner/clients/[orgId]/owner`.
 */
export async function POST(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { session, membership } = auth.ctx;

  try {
    const data = parseCreateClientOrganization(await readJson(request));
    const result = await createClientOrganization({
      partnerId: membership.partnerId,
      actorUserId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "сотрудник",
      brandName: membership.partner.brandName,
      data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
