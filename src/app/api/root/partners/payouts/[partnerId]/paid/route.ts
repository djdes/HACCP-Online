import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { markPartnerPaid } from "@/lib/partners/accruals";
import { readJson } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { paidAt: "YYYY-MM-DD", documentNo } — отметить выплату партнёру. */
export async function POST(request: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  await requireRoot();
  const { partnerId } = await ctx.params;
  const body = await readJson<{ paidAt?: unknown; documentNo?: unknown }>(request);
  const paidAt = typeof body.paidAt === "string" && body.paidAt ? new Date(body.paidAt) : new Date();
  try {
    const result = await markPartnerPaid({
      partnerId,
      paidAt,
      documentNo: typeof body.documentNo === "string" ? body.documentNo : "",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
