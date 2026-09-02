import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { getPartnerForAdmin } from "@/lib/partners/admin";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRoot();
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await getPartnerForAdmin(id));
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
