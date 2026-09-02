import { NextResponse } from "next/server";

import { actorName, readJson, requirePartnerApi } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { addClientNote } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Заметка партнёра о клиенте — клиент её не видит. */
export async function POST(request: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { orgId } = await ctx.params;
  const body = await readJson<{ text?: string }>(request);
  try {
    const note = await addClientNote({
      partnerId: auth.ctx.membership.partnerId,
      organizationId: orgId,
      author: { userId: auth.ctx.session.user.id, name: actorName(auth.ctx.session) },
      text: String(body.text ?? ""),
    });
    return NextResponse.json({ ok: true, note: { ...note, createdAt: note.createdAt.toISOString() } });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
