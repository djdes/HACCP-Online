import { NextResponse } from "next/server";

import { readJson, requirePartnerApi } from "@/lib/partners/api";
import { PartnerError, partnerErrorResponse } from "@/lib/partners/errors";
import { addTeamMember, listTeam } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const team = await listTeam(auth.ctx.membership.partnerId);
  return NextResponse.json({
    me: { userId: auth.ctx.session.user.id, role: auth.ctx.membership.role },
    team: team.map((m) => ({
      ...m,
      lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
      since: m.since.toISOString(),
    })),
  });
}

/** Добавить сотрудника партнёра — только владелец партнёра. */
export async function POST(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const body = await readJson<{ email?: string; name?: string }>(request);
  try {
    if (auth.ctx.membership.role !== "owner") throw new PartnerError("Команду меняет владелец партнёра", 403);
    const result = await addTeamMember({
      partnerId: auth.ctx.membership.partnerId,
      email: String(body.email ?? ""),
      name: String(body.name ?? ""),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
