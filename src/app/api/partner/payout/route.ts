import { NextResponse } from "next/server";

import { readJson, requirePartnerApi } from "@/lib/partners/api";
import { PartnerError, partnerErrorResponse } from "@/lib/partners/errors";
import { parsePayoutDetails, savePayoutDetails } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Реквизиты для выплат: { payoutType: "ip"|"self_employed"|"company", details: {...} }. */
export async function PUT(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const body = await readJson<{ payoutType?: unknown; details?: unknown }>(request);
  try {
    if (auth.ctx.membership.role !== "owner") throw new PartnerError("Реквизиты меняет владелец партнёра", 403);
    const parsed = parsePayoutDetails(body.payoutType, body.details);
    await savePayoutDetails(auth.ctx.membership.partnerId, parsed.payoutType, parsed.details);
    return NextResponse.json({ ok: true, ...parsed });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
