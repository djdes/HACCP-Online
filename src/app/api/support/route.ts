import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-helpers";
import { sendTelegramMessage, escapeTelegramHtml as esc } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/support
 *
 * Body: { message: string }
 *
 * Принимает сообщение от management-юзера, шлёт в support-Telegram-
 * канал команды WeSetup. Канал-id в env SUPPORT_TELEGRAM_CHAT_ID.
 *
 * Сообщение содержит контекст: org name, кто пишет (name + email +
 * phone), URL откуда отправлено, текст. Команда WeSetup отвечает
 * напрямую через Telegram.
 *
 * Если SUPPORT_TELEGRAM_CHAT_ID не настроен — endpoint логирует в БД
 * как fallback (новая модель не нужна, используем AuditLog с
 * action="support.message").
 */
const bodySchema = z.object({
  message: z.string().min(5).max(2000),
  url: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            err.issues[0]?.message ??
            "Сообщение должно быть от 5 до 2000 символов",
        },
        { status: 400 }
      );
    }
    throw err;
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      organization: { select: { id: true, name: true } },
    },
  });

  const orgName = user?.organization?.name ?? "?";
  const orgId = user?.organization?.id ?? "?";

  const text =
    `<b>📨 Поддержка</b>\n\n` +
    `<b>Организация:</b> ${esc(orgName)} (id: <code>${esc(orgId)}</code>)\n` +
    `<b>От:</b> ${esc(user?.name ?? "?")} ` +
    (user?.email ? `· ${esc(user.email)}` : "") +
    (user?.phone ? ` · ${esc(user.phone)}` : "") +
    `\n` +
    (parsed.url ? `<b>Откуда:</b> ${esc(parsed.url)}\n` : "") +
    `\n${esc(parsed.message)}`;

  const supportChatId = process.env.SUPPORT_TELEGRAM_CHAT_ID;

  if (supportChatId) {
    try {
      await sendTelegramMessage(supportChatId, text, {
        userId: session.user.id,
      });
    } catch (err) {
      console.error("[support] telegram send failed", err);
      // Fallback в audit-log если TG недоступен.
      await db.auditLog.create({
        data: {
          organizationId: orgId,
          userId: session.user.id,
          userName: user?.name ?? null,
          action: "support.message-failed",
          entity: "Support",
          details: {
            text: parsed.message,
            url: parsed.url ?? null,
            error: err instanceof Error ? err.message : String(err),
          },
        },
      });
      return NextResponse.json(
        { error: "Не удалось отправить — попробуйте позже" },
        { status: 502 }
      );
    }
  } else {
    // Fallback — без TG-канала кладём в audit-log, чтобы команда могла
    // прочитать через ROOT-страницу.
    await db.auditLog.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        userName: user?.name ?? null,
        action: "support.message",
        entity: "Support",
        details: {
          text: parsed.message,
          url: parsed.url ?? null,
        },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
