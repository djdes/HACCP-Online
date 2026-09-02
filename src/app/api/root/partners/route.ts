import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { listPartnersForAdmin } from "@/lib/partners/admin";
import { PARTNER_STATUSES, PARTNER_STATUS_LABELS, type PartnerStatus } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/root/partners?status=pending|active|rejected|suspended|all */
export async function GET(request: Request) {
  await requireRoot();
  const raw = new URL(request.url).searchParams.get("status") ?? "all";
  const status = (PARTNER_STATUSES as readonly string[]).includes(raw) ? (raw as PartnerStatus) : "all";
  const data = await listPartnersForAdmin(status);
  return NextResponse.json({ ...data, status, statusLabels: PARTNER_STATUS_LABELS });
}
