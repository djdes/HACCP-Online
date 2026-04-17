import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { sendFeedbackAdminEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { escapeHtml } from "@/lib/html-escape";

const feedbackSchema = z.object({
  type: z.enum(["bug", "suggestion"], { message: "Выберите тип обращения" }),
  message: z
    .string()
    .trim()
    .min(3, "Сообщение слишком короткое")
    .max(4000, "Сообщение слишком длинное"),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
});

const APP_URL = process.env.NEXTAUTH_URL || "https://wesetup.ru";

function composeTelegramMessage(params: {
  type: "bug" | "suggestion";
  message: string;
  userName?: string | null;
  userEmail?: string | null;
  organizationName?: string | null;
  phone?: string | null;
}): string {
  const typeLabel = params.type === "bug" ? "🐞 Ошибка" : "💡 Предложение";
  const lines: string[] = [];
  lines.push(`<b>${typeLabel}</b>`);
  lines.push("");
  lines.push(escapeHtml(params.message));
  lines.push("");
  if (params.userName || params.userEmail) {
    const who = [params.userName, params.userEmail].filter(Boolean).join(" · ");
    lines.push(`👤 ${escapeHtml(who)}`);
  }
  if (params.organizationName) {
    lines.push(`🏢 ${escapeHtml(params.organizationName)}`);
  }
  if (params.phone) {
    lines.push(`📞 ${escapeHtml(params.phone)}`);
  }
  lines.push("");
  lines.push(
    `<a href="${APP_URL}/root/feedback">Открыть панель обращений</a>`
  );
  return lines.join("\n");
}

/**
 * POST /api/feedback
 *
 * Stores an in-app feedback report and fires notifications to the admin:
 *  - email to FEEDBACK_ADMIN_EMAIL
 *  - Telegram message to FEEDBACK_ADMIN_TG_CHAT_ID
 *
 * Both notifications are fire-and-forget so the request still succeeds even
 * if SMTP or Telegram transiently fails — the DB row is the source of truth.
 */
export async function POST(request: Request) {
  const session = await requireAuth();

  let parsed;
  try {
    parsed = feedbackSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Не удалось прочитать запрос" },
      { status: 400 }
    );
  }

  const orgId = getActiveOrgId(session);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const phone = parsed.phone ? parsed.phone : null;
  const organizationName =
    org?.name ?? session.user.organizationName ?? null;

  const report = await db.feedbackReport.create({
    data: {
      userId: session.user.id,
      userEmail: session.user.email ?? null,
      userName: session.user.name ?? null,
      organizationId: orgId || null,
      organizationName,
      type: parsed.type,
      message: parsed.message,
      phone,
    },
  });

  const adminEmail = process.env.FEEDBACK_ADMIN_EMAIL?.trim();
  const adminTgChatId = process.env.FEEDBACK_ADMIN_TG_CHAT_ID?.trim();

  // Fire-and-forget — never block the user on transport failures.
  if (adminEmail) {
    sendFeedbackAdminEmail({
      to: adminEmail,
      type: parsed.type,
      message: parsed.message,
      userName: session.user.name ?? null,
      userEmail: session.user.email ?? null,
      organizationName,
      phone,
      submittedAt: report.createdAt,
    }).catch((error) => {
      console.error("Feedback email failed:", error);
    });
  }

  if (adminTgChatId) {
    const text = composeTelegramMessage({
      type: parsed.type,
      message: parsed.message,
      userName: session.user.name ?? null,
      userEmail: session.user.email ?? null,
      organizationName,
      phone,
    });
    sendTelegramMessage(adminTgChatId, text).catch((error) => {
      console.error("Feedback telegram failed:", error);
    });
  }

  return NextResponse.json({ ok: true });
}
