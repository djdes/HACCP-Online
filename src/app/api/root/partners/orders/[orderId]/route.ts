import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { markOrderRefunded, markOrderShipped } from "@/lib/partners/accruals";
import { readJson } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { action: "shipped" | "unshipped" | "refunded" } — события заказа,
 * влияющие на партнёрские начисления: отгрузка оборудования и возврат.
 */
export async function POST(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  await requireRoot();
  const { orderId } = await ctx.params;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Некорректный номер заказа" }, { status: 400 });
  }
  const body = await readJson<{ action?: unknown }>(request);
  try {
    switch (body.action) {
      case "shipped":
        return NextResponse.json({ ok: true, ...(await markOrderShipped(id, true)) });
      case "unshipped":
        return NextResponse.json({ ok: true, ...(await markOrderShipped(id, false)) });
      case "refunded":
        return NextResponse.json({ ok: true, ...(await markOrderRefunded(id)) });
      default:
        return NextResponse.json({ error: "action: shipped | unshipped | refunded" }, { status: 400 });
    }
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
