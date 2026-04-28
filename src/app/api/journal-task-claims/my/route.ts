import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { getActiveClaimForUser } from "@/lib/journal-task-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/journal-task-claims/my — мой текущий active claim, если есть.
 *
 * Используется UI: пока возвращает claim, кнопки «Взять» в других
 * журналах disabled с tooltip «Сначала заверши <parentHint>».
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const claim = await getActiveClaimForUser(
    session.user.id,
    getActiveOrgId(session)
  );
  return NextResponse.json({ claim });
}
