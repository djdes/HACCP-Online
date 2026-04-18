import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";

/**
 * POST /api/mini/unlink-tg
 *
 * Clears `User.telegramChatId` for the calling user so the next Mini App
 * visit fails initData lookup and forces a fresh invite. Clients should
 * call `signOut()` from NextAuth after a successful response — that's a
 * client concern; this endpoint only touches the DB.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { telegramChatId: null },
  });
  return NextResponse.json({ ok: true });
}
