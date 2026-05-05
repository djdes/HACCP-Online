import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { isManagementRole } from "@/lib/user-roles";
import { escapeTelegramHtml, notifyEmployee } from "@/lib/telegram";
import { db } from "@/lib/db";
import { miniNotifyRateLimiter } from "@/lib/rate-limit";

// Telegram message limit — 4096 chars; cap гораздо строже, чтобы:
//  (а) длинная portyanka из manager'а не лагала Bot API;
//  (б) защита от accidental paste огромного JSON / лога в форму notify.
const MAX_MESSAGE_LEN = 2000;
const MAX_LABEL_LEN = 64;

// actionUrl whitelist'ится по hostname'у — Telegram WebApp кнопка
// открывает URL внутри Telegram-iframe, и без проверки менеджер мог
// бы ссылку на phishing-домен с похожей вёрсткой. Принимаем только
// origin основного prod-домена (плюс localhost для dev/preview).
const URL_WHITELIST_HOSTS = new Set<string>([
  "wesetup.ru",
  "www.wesetup.ru",
  "localhost",
  "127.0.0.1",
]);

const POST_SCHEMA = z.object({
  userId: z.string().min(1).max(100),
  message: z.string().min(1).max(MAX_MESSAGE_LEN),
  actionLabel: z.string().min(1).max(MAX_LABEL_LEN).optional(),
  actionUrl: z
    .string()
    .url()
    .refine(
      (raw) => {
        try {
          const u = new URL(raw);
          if (u.protocol !== "https:" && u.protocol !== "http:") return false;
          return URL_WHITELIST_HOSTS.has(u.hostname);
        } catch {
          return false;
        }
      },
      { message: "actionUrl должен указывать на wesetup.ru" }
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = getActiveOrgId(session);
  const isManager =
    session.user.isRoot === true || isManagementRole(session.user.role);

  if (!isManager) {
    return NextResponse.json(
      { error: "Only managers can send notifications" },
      { status: 403 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = POST_SCHEMA.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.issues.map((i) => i.message),
      },
      { status: 400 }
    );
  }
  const { userId, message, actionLabel, actionUrl } = parsed.data;

  // Rate-limit per (manager, target) пара. Менеджер может legitimate-но
  // слать многим разным сотрудникам, но 5 раз в минуту на одного — потолок.
  const rateKey = `${session.user.id}:${userId}`;
  if (!miniNotifyRateLimiter.consume(rateKey)) {
    return NextResponse.json(
      {
        error:
          "Слишком много уведомлений на одного сотрудника. Подождите минуту.",
      },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    // Verify target user belongs to same org (предотвращаем cross-org
    // notify у ROOT'а в impersonation если что-то пошло не так).
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

    // HTML-escape для message — он идёт в sendMessage с parse_mode: HTML.
    // НО actionLabel НЕ escape'им: Telegram inline-button.text — это
    // plain-text по контракту Bot API, и `&lt;` будет показан буквально
    // как «&lt;» вместо «<». Pass-3 review нашёл это как CRITICAL.
    // Length limit (max 64) уже даёт ограничение через zod-schema.
    const safeMessage = escapeTelegramHtml(message);
    const action =
      actionLabel && actionUrl
        ? { label: actionLabel, miniAppUrl: actionUrl }
        : undefined;

    await notifyEmployee(userId, safeMessage, action);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mini/notify] error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
