import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getJournalGuide } from "@/lib/journal-guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/journal-guides/[code] — гайд по journalCode для UI / бота.
 * Любой залогиненный пользователь может прочитать (это методичка,
 * не приватные данные).
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { code } = await ctx.params;
  return NextResponse.json(getJournalGuide(code));
}
