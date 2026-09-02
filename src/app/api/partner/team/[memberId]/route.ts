import { NextResponse } from "next/server";

import { requirePartnerApi } from "@/lib/partners/api";
import { PartnerError, partnerErrorResponse } from "@/lib/partners/errors";
import { removeTeamMember } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, ctx: { params: Promise<{ memberId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { memberId } = await ctx.params;
  try {
    if (auth.ctx.membership.role !== "owner") throw new PartnerError("Команду меняет владелец партнёра", 403);
    await removeTeamMember({
      partnerId: auth.ctx.membership.partnerId,
      memberId,
      actorUserId: auth.ctx.session.user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
