import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * P2.A.1 — GET /api/dashboard/most-urgent-journal
 *
 * Возвращает `{ code: string | null }` — code журнала с самым старым
 * pending-obligation для текущего пользователя в активной организации.
 * Если у юзера нет pending-obligations — `code: null` (UI fallback'нется
 * на /journals список).
 *
 * Используется hotkey'ем Ctrl+Shift+N на дашборде: один keystroke →
 * сразу прыг в форму заполнения самого срочного журнала.
 */
export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const orgId = getActiveOrgId(auth.session);

  const obligation = await db.journalObligation.findFirst({
    where: {
      organizationId: orgId,
      userId: auth.session.user.id,
      status: "pending",
    },
    orderBy: { dateKey: "asc" },
    select: { journalCode: true },
  });

  return NextResponse.json({ code: obligation?.journalCode ?? null });
}
