import { NextResponse } from "next/server";

import { partnerErrorResponse } from "@/lib/partners/errors";
import { declineInviteByToken } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { token } — получатель письма отказался от приглашений партнёра. Без входа. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "Нет токена" }, { status: 400 });
  try {
    const result = await declineInviteByToken(token);
    return NextResponse.json(result);
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
