import { NextResponse } from "next/server";

import { requirePartnerApi } from "@/lib/partners/api";
import { loadPartnerOverview } from "@/lib/partners/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Обзор партнёра: плитки + таблица клиентов. Фильтры применяются на клиенте. */
export async function GET() {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const overview = await loadPartnerOverview(auth.ctx.membership.partnerId);
  return NextResponse.json(overview);
}
