import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { sendFeedbackAdminEmail } from "@/lib/email";
import { getPlatformAdminEmail, notifyPlatformAdmin } from "@/lib/platform-admin";
import {
  SUPPORT_CHAT_HISTORY_LIMIT,
  SUPPORT_CHAT_MAX_LENGTH,
  SUPPORT_CHAT_MIN_LENGTH,
  composeSupportChatAdminMessage,
} from "@/lib/support-chat";
import { escapeTelegramHtml } from "@/lib/telegram";
import {
  emailAttachmentPayload,
  parseStoredAttachments,
  sendAttachmentsToPlatformAdmins,
  validateSignedAttachments,
} from "@/lib/support-attachments";

/**
 * Онлайн-чат с поддержкой.
 *
 * GET — вся история ветки этого пользователя (её же видит оператор).
 * POST — реплика клиента: пишем в БД, шлём админу в Telegram с якорем
 * для свайп-ответа и дублируем на почту поддержки.
 *
 * Ветку заводим лениво, только на первой реплике: пустые ветки в админке
 * не нужны, а просто открытый виджет обращением не является.
 */

const APP_URL = process.env.NEXTAUTH_URL || "https://wesetup.ru";

const messageSchema = z.object({
  // Пустой текст допустим, когда есть вложения («просто скинул скрин») —
  // проверка «текст или файл» ниже, после валидации вложений.
  message: z
    .string()
    .trim()
    .max(SUPPORT_CHAT_MAX_LENGTH, "Сообщение слишком длинное")
    .default(""),
  attachments: z.unknown().optional(),
});

async function loadProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      organization: { select: { id: true, name: true } },
    },
  });
}

export async function GET() {
  const session = await requireAuth();
  const userId = session.user.id;

  const thread = await db.supportThread.findUnique({
    where: { userId },
    select: { id: true },
  });

  const messages = thread
    ? await db.supportMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "asc" },
        take: SUPPORT_CHAT_HISTORY_LIMIT,
        select: {
          id: true,
          author: true,
          body: true,
          operatorName: true,
          attachments: true,
          createdAt: true,
        },
      })
    : [];

  const profile = await loadProfile(userId);

  return NextResponse.json({
    threadId: thread?.id ?? null,
    messages: messages.map((m) => ({
      ...m,
      attachments: parseStoredAttachments(m.attachments),
    })),
    // Шапку виджета («под кем авторизован») рисуем из тех же данных,
    // что уходят оператору — расхождений между «кем я вижусь» и «кого
    // видит поддержка» быть не должно.
    identity: {
      organizationName: profile?.organization?.name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      name: profile?.name ?? null,
    },
  });
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректное сообщение" },
      { status: 400 }
    );
  }

  // Вложения: только загруженные этим же пользователем (HMAC-подпись мет).
  const attachments = validateSignedAttachments(parsed.data.attachments, userId);
  if (attachments === null) {
    return NextResponse.json(
      { error: "Вложения не прошли проверку — прикрепите файлы заново" },
      { status: 400 }
    );
  }
  if (parsed.data.message.length < SUPPORT_CHAT_MIN_LENGTH && attachments.length === 0) {
    return NextResponse.json(
      { error: "Сообщение слишком короткое" },
      { status: 400 }
    );
  }

  const profile = await loadProfile(userId);
  const now = new Date();

  const thread = await db.supportThread.upsert({
    where: { userId },
    create: {
      userId,
      userEmail: profile?.email ?? null,
      userName: profile?.name ?? null,
      phone: profile?.phone ?? null,
      organizationId: profile?.organization?.id ?? null,
      organizationName: profile?.organization?.name ?? null,
      lastMessageAt: now,
      unreadForStaff: 1,
    },
    update: {
      // Контакты могли поменяться с прошлого раза — оператору нужны свежие.
      userEmail: profile?.email ?? null,
      userName: profile?.name ?? null,
      phone: profile?.phone ?? null,
      organizationId: profile?.organization?.id ?? null,
      organizationName: profile?.organization?.name ?? null,
      lastMessageAt: now,
      unreadForStaff: { increment: 1 },
    },
    select: { id: true },
  });

  const previousMessages = await db.supportMessage.count({
    where: { threadId: thread.id },
  });

  const message = await db.supportMessage.create({
    data: {
      threadId: thread.id,
      author: "client",
      body: parsed.data.message,
      ...(attachments.length > 0 ? { attachments } : {}),
    },
    select: {
      id: true,
      author: true,
      body: true,
      operatorName: true,
      attachments: true,
      createdAt: true,
    },
  });

  const attachmentsNote =
    attachments.length > 0
      ? `\n📎 ${attachments.map((a) => a.filename).join(", ")}`
      : "";
  const adminText = composeSupportChatAdminMessage({
    threadId: thread.id,
    body: (parsed.data.message || "(вложение без текста)") + attachmentsNote,
    userName: profile?.name ?? null,
    userEmail: profile?.email ?? null,
    organizationName: profile?.organization?.name ?? null,
    phone: profile?.phone ?? null,
    previousMessages,
    escape: escapeTelegramHtml,
    appUrl: APP_URL,
  });

  // Доставку выносим за ответ: клиент не должен ждать Telegram и SMTP,
  // а упавший канал не должен терять уже сохранённую реплику.
  after(async () => {
    const emailAtts = emailAttachmentPayload(attachments);
    await Promise.all([
      notifyPlatformAdmin(adminText, { kind: "support-chat" }),
      // Файлы — отдельными сообщениями с якорем ветки в подписи: реплай
      // на текст уже работает, файлы оператор просто видит рядом.
      sendAttachmentsToPlatformAdmins(
        attachments,
        `Вложения к чату #chat_${thread.id}`,
        "support-chat"
      ),
      (async () => {
        const adminEmail = getPlatformAdminEmail();
        if (!adminEmail) return false;
        return sendFeedbackAdminEmail({
          to: adminEmail,
          type: "support",
          message: parsed.data.message || "(вложение без текста)",
          userName: profile?.name ?? null,
          userEmail: profile?.email ?? null,
          organizationName: profile?.organization?.name ?? null,
          phone: profile?.phone ?? null,
          submittedAt: message.createdAt,
          attachmentLinks: emailAtts.links,
          attachments: emailAtts.files,
        });
      })(),
    ]);
  });

  return NextResponse.json({
    threadId: thread.id,
    message: {
      ...message,
      attachments: parseStoredAttachments(message.attachments),
    },
  });
}
