import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth-helpers";
import { rewriteSessionClaims } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Выйти из кабинета клиента»: снимаем claim partnerAccess и активную
 * организацию — дальше сессия падает в свою организацию (или в кабинет
 * партнёра, если своей нет). Доступен любому залогиненному: даже если
 * партнёр уже приостановлен, выйти из чужого кабинета он должен мочь.
 */
export async function POST() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const rewrite = await rewriteSessionClaims({ activeOrganizationId: null, partnerAccess: null });
  if (!rewrite.ok) return NextResponse.json({ error: rewrite.reason }, { status: 500 });
  return NextResponse.json({ ok: true });
}
