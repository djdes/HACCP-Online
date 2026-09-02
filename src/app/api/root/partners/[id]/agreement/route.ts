import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { readJson } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { setAgreementSigned } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT { signed: boolean, number?: string } — статус «договор подписан». */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRoot();
  const { id } = await ctx.params;
  const body = await readJson<{ signed?: unknown; number?: unknown }>(request);
  try {
    await setAgreementSigned(id, body.signed === true, typeof body.number === "string" ? body.number : null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
