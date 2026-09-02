import { NextResponse } from "next/server";

import { requirePartnerApi } from "@/lib/partners/api";
import { getPartnerClientCard } from "@/lib/partners/client-card";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Карточка клиента: организация, привязка, заметки, начисления по клиенту. */
export async function GET(_request: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { orgId } = await ctx.params;
  try {
    return NextResponse.json(await getPartnerClientCard(auth.ctx.membership.partnerId, orgId));
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
