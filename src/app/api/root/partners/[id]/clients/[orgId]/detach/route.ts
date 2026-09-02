import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { detachOrganizationFromPartner } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Админ платформы отвязывает клиента от партнёра. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string; orgId: string }> }) {
  const session = await requireRoot();
  const { id, orgId } = await ctx.params;
  try {
    const result = await detachOrganizationFromPartner({
      organizationId: orgId,
      by: "admin",
      actorUserId: session.user.id,
      partnerId: id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
