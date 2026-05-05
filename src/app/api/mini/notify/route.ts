import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { isManagementRole } from "@/lib/user-roles";
import { escapeTelegramHtml, notifyEmployee } from "@/lib/telegram";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = getActiveOrgId(session);
  // Раньше: только role === "manager" — head_chef и legacy owner
  // получали 403, хотя в остальной системе они — full management.
  // Используем централизованный isManagementRole helper.
  const isManager =
    session.user.isRoot === true || isManagementRole(session.user.role);

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

    // HTML-escape user-controlled fields. notifyEmployee пускает их в
    // sendMessage с parse_mode: "HTML" — без escape менеджер мог бы
    // инъектировать <a href="phishing">, <b>, <pre> и т.п. в чужой
    // Telegram-чат сотрудника той же орги.
    const safeMessage = escapeTelegramHtml(message);
    const action =
      actionLabel && actionUrl
        ? { label: escapeTelegramHtml(actionLabel), miniAppUrl: actionUrl }
        : undefined;

    await notifyEmployee(userId, safeMessage, action);

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[mini/notify] error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
