import { NextResponse } from "next/server";

import { readJson, requirePartnerApi } from "@/lib/partners/api";
import { getBrandingSettings, updateBrandingSettings, type BrandingInput } from "@/lib/partners/branding-admin";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await getBrandingSettings(auth.ctx.membership.partnerId));
  } catch (error) {
    return partnerErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const body = await readJson<BrandingInput>(request);
  try {
    const { accent } = await updateBrandingSettings(auth.ctx.membership.partnerId, body);
    const settings = await getBrandingSettings(auth.ctx.membership.partnerId);
    return NextResponse.json({ ok: true, accentWarning: accent?.warning ?? null, settings });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
