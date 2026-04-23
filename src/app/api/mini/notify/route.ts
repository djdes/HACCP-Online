import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { notifyEmployee } from "@/lib/telegram";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = getActiveOrgId(session);
  const isManager =
    session.user.isRoot === true || session.user.role === "manager";

  if (!isManager) {
    return NextResponse.json({ error: "Only managers can send notifications" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      message?: string;
      actionLabel?: string;
      actionUrl?: string;
    };

    const { userId, message, actionLabel, actionUrl } = body;

    if (!userId || !message) {
      return NextResponse.json(
        { error: "userId and message are required" },
        { status: 400 }
      );
    }

    // Verify user belongs to same org
    const targetUser = await db.user.findFirst({
      where: { id: userId, organizationId: orgId },
      select: { id: true, telegramChatId: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!targetUser.telegramChatId) {
      return NextResponse.json(
        { error: "User has no Telegram linked" },
        { status: 400 }
      );
    }

    const action = actionLabel && actionUrl
      ? { label: actionLabel, miniAppUrl: actionUrl }
      : undefined;

    await notifyEmployee(userId, message, action);

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[mini/notify] error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
