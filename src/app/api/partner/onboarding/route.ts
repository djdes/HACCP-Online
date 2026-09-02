import { NextResponse } from "next/server";

import { requirePartnerApi } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { markOnboardingDone } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Партнёр прошёл (или пропустил) три шага онбординга — больше не показываем. */
export async function POST() {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  try {
    await markOnboardingDone(auth.ctx.membership.partnerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
