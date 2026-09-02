import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { readJson } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { reviewPartner, type ReviewAction } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: readonly ReviewAction[] = ["approve", "reject", "suspend", "reactivate"];

/** POST { action: approve|reject|suspend|reactivate, comment?: string } */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireRoot();
  const { id } = await ctx.params;
  const body = await readJson<{ action?: string; comment?: string }>(request);
  const action = body.action as ReviewAction;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "action: approve | reject | suspend | reactivate" }, { status: 400 });
  }
  try {
    const result = await reviewPartner(id, action, { userId: session.user.id }, String(body.comment ?? ""));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
