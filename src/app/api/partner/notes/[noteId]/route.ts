import { NextResponse } from "next/server";

import { requirePartnerApi } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { deleteClientNote } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, ctx: { params: Promise<{ noteId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { noteId } = await ctx.params;
  try {
    await deleteClientNote({ partnerId: auth.ctx.membership.partnerId, noteId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
