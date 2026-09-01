import { NextResponse, after } from "next/server";
import { z } from "zod";
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
import { clientIp } from "@/lib/client-ip";
import {
  GUEST_ID_PATTERN,
  guestThreadKey,
  normalizeContact,
  publicContactLimiter,
} from "@/lib/public-support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXTAUTH_URL || "https://wesetup.ru";

/**
 * Онлайн-чат для гостя лендинга.
 *
 * Ветка та же самая, что у авторизованных (`SupportThread`) — оператор
 * отвечает свайп-реплаем в Telegram одинаково и не различает, откуда
 * пришёл человек. Отличается только ключ: вместо `userId` пишем
 * `guest:<uuid>`, где uuid лежит у гостя в localStorage. Аккаунта у него
 * нет, а переписку при возвращении показать надо.
 *
 * uuid — единственный ключ к ветке, поэтому он случайный и длинный.
 * Угадать чужую переписку перебором нереально, а знать свою достаточно
 * самому браузеру.
 */

const postSchema = z.object({
  guestId: z.string().regex(GUEST_ID_PATTERN, "Некорректный идентификатор"),
  message: z
    .string()
    .trim()
    .min(SUPPORT_CHAT_MIN_LENGTH, "Сообщение слишком короткое")
    .max(SUPPORT_CHAT_MAX_LENGTH, "Сообщение слишком длинное"),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().max(200).optional().or(z.literal("")),
});

export async function GET(request: Request) {
  const guestId = new URL(request.url).searchParams.get("guestId") ?? "";
  if (!GUEST_ID_PATTERN.test(guestId)) {
    return NextResponse.json({ threadId: null, messages: [] });
  }

  const thread = await db.supportThread.findUnique({
    where: { userId: guestThreadKey(guestId) },
    select: { id: true, userEmail: true, phone: true },
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
          createdAt: true,
        },
      })
    : [];

  return NextResponse.json({
    threadId: thread?.id ?? null,
    messages,
    contact: { email: thread?.userEmail ?? null, phone: thread?.phone ?? null },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректное сообщение" },
      { status: 400 }
    );
  }
  if (parsed.data.company) return NextResponse.json({ ok: true });

  const key = guestThreadKey(parsed.data.guestId);
  const existing = await db.supportThread.findUnique({
    where: { userId: key },
    select: { id: true, userEmail: true, phone: true },
  });

  // Контакты спрашиваем один раз — на первой реплике. Дальше они уже в
  // ветке, и переспрашивать в каждом сообщении незачем.
  const given = normalizeContact(parsed.data);
  const email = given.email ?? existing?.userEmail ?? null;
  const phone = given.phone ?? existing?.phone ?? null;
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Оставьте телефон или почту — иначе некуда ответить" },
      { status: 400 }
    );
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Проверьте адрес почты" }, { status: 400 });
  }

  const ip = clientIp(request) ?? "unknown";
  if (!publicContactLimiter.consume(`chat:${ip}`)) {
    return NextResponse.json(
      { error: "Слишком много сообщений подряд. Попробуйте через 10 минут" },
      { status: 429 }
    );
  }

  const now = new Date();
  const thread = await db.supportThread.upsert({
    where: { userId: key },
    create: {
      userId: key,
      userEmail: email,
      userName: "Гость с сайта",
      phone,
      lastMessageAt: now,
      unreadForStaff: 1,
    },
    update: {
      userEmail: email,
      phone,
      lastMessageAt: now,
      unreadForStaff: { increment: 1 },
    },
    select: { id: true },
  });

  const previousMessages = await db.supportMessage.count({
    where: { threadId: thread.id },
  });

  const message = await db.supportMessage.create({
    data: { threadId: thread.id, author: "client", body: parsed.data.message },
    select: {
      id: true,
      author: true,
      body: true,
      operatorName: true,
      createdAt: true,
    },
  });

  const adminText = composeSupportChatAdminMessage({
    threadId: thread.id,
    body: parsed.data.message,
    userName: "Гость с сайта",
    userEmail: email,
    organizationName: null,
    phone,
    previousMessages,
    escape: escapeTelegramHtml,
    appUrl: APP_URL,
  });

  after(async () => {
    const adminEmail = getPlatformAdminEmail();
    await Promise.all([
      notifyPlatformAdmin(adminText, { kind: "support-chat" }).catch((error) => {
        console.error("Public chat telegram failed:", error);
        return false;
      }),
      adminEmail
        ? sendFeedbackAdminEmail({
            to: adminEmail,
            type: "support",
            message: parsed.data.message,
            userName: "Гость с сайта",
            userEmail: email,
            organizationName: null,
            phone,
            submittedAt: message.createdAt,
          }).catch((error) => {
            console.error("Public chat email failed:", error);
            return false;
          })
        : Promise.resolve(false),
    ]);
  });

  return NextResponse.json({ ok: true, message });
}
