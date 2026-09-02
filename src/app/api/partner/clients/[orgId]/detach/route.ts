import { NextResponse } from "next/server";

import { requirePartnerApi } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { detachOrganizationFromPartner } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Партнёр сам отключает сопровождение клиента. */
export async function POST(_request: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { orgId } = await ctx.params;
  try {
    const result = await detachOrganizationFromPartner({
      organizationId: orgId,
      by: "partner",
      actorUserId: auth.ctx.session.user.id,
      partnerId: auth.ctx.membership.partnerId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
