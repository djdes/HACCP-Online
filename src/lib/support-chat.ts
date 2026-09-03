/**
 * Онлайн-чат с поддержкой.
 *
 * Одна ветка на организацию (гость с сайта — одна ветка на устройство).
 * Человек, вернувшийся через неделю, видит, о чём писал раньше, и не
 * пересказывает всё заново; тот же контекст видит оператор. Ключи веток и
 * маршрутизация «партнёр или WeSetup» — в support-threads.ts.
 *
 * Ответ оператора приходит из Telegram: админ-сообщение несёт якорь
 * `#chat_<threadId>`, свайп-реплай на него дописывает реплику в ветку.
 * Тот же приём уже работает для обращений (`#fb_<id>`) — второго механизма
 * заводить незачем.
 */

/** Машиночитаемый якорь ветки в админ-сообщении. */
const THREAD_TAG_PATTERN = /#chat_([A-Za-z0-9_-]+)/;

export function buildSupportChatTag(threadId: string): string {
  return `#chat_${threadId}`;
}

/** Достаёт id ветки из текста сообщения, на которое ответили реплаем. */
export function extractSupportThreadId(
  text: string | null | undefined
): string | null {
  if (!text) return null;
  const match = text.match(THREAD_TAG_PATTERN);
  return match ? match[1] : null;
}

export const SUPPORT_CHAT_MAX_LENGTH = 4000;
export const SUPPORT_CHAT_MIN_LENGTH = 2;

/** Сколько последних реплик отдаём клиенту. */
export const SUPPORT_CHAT_HISTORY_LIMIT = 200;

export type SupportChatAuthor = "client" | "operator";

/**
 * Шапка админ-сообщения: кто пишет и откуда.
 *
 * Оператор отвечает свайпом прямо из Telegram, поэтому весь контекст должен
 * быть в самом сообщении — переключаться в админку ради «кто это» нельзя.
 */
export function composeSupportChatAdminMessage(args: {
  threadId: string;
  body: string;
  userName?: string | null;
  userEmail?: string | null;
  organizationName?: string | null;
  phone?: string | null;
  /** Реплик в ветке до этой. Ноль — человек пишет впервые. */
  previousMessages: number;
  escape: (value: string) => string;
  appUrl: string;
}): string {
  const lines: string[] = [];
  lines.push(
    args.previousMessages === 0
      ? "<b>💬 Онлайн-чат · новое обращение</b>"
      : `<b>💬 Онлайн-чат</b> · реплик в ветке: ${args.previousMessages}`
  );
  lines.push("");
  lines.push(args.escape(args.body));
  lines.push("");

  const who = [args.userName, args.userEmail].filter(Boolean).join(" · ");
  if (who) lines.push(`👤 ${args.escape(who)}`);
  if (args.organizationName) lines.push(`🏢 ${args.escape(args.organizationName)}`);
  if (args.phone) lines.push(`📞 ${args.escape(args.phone)}`);

  lines.push("");
  lines.push(buildSupportChatTag(args.threadId));
  lines.push("Ответить: свайп-реплай на это сообщение.");
  lines.push(`<a href="${args.appUrl}/root/feedback">Открыть админку</a>`);
  return lines.join("\n");
}

/**
 * Сообщение клиента — партнёру, который сопровождает организацию.
 * Партнёр отвечает из своего кабинета, поэтому главное здесь — ссылка.
 */
export function composeSupportChatPartnerMessage(args: {
  threadId: string;
  body: string;
  organizationName?: string | null;
  authorName?: string | null;
  escape: (value: string) => string;
  appUrl: string;
}): string {
  const lines: string[] = [];
  lines.push("<b>💬 Клиент пишет в чат</b>");
  if (args.organizationName) lines.push(`🏢 ${args.escape(args.organizationName)}`);
  if (args.authorName) lines.push(`👤 ${args.escape(args.authorName)}`);
  lines.push("");
  lines.push(args.escape(args.body));
  lines.push("");
  lines.push(
    `<a href="${args.appUrl}/partner/chats?thread=${args.threadId}">Ответить в кабинете партнёра</a>`
  );
  return lines.join("\n");
}

/**
 * Тихое уведомление админу о переписке в партнёрской организации:
 * отвечает партнёр, просьбы ответить нет, но якорь ветки оставлен —
 * свайп-реплай по-прежнему работает, если захочется вмешаться.
 */
export function composePartnerHandoffAdminMessage(args: {
  threadId: string;
  body: string;
  organizationName?: string | null;
  brandName: string;
  authorName?: string | null;
  escape: (value: string) => string;
  appUrl: string;
}): string {
  const lines: string[] = [];
  lines.push(`<b>🤝 Чат клиента партнёра</b> · отвечает ${args.escape(args.brandName)}`);
  lines.push("");
  lines.push(args.escape(args.body));
  lines.push("");
  const who = [args.organizationName, args.authorName].filter(Boolean).join(" · ");
  if (who) lines.push(`🏢 ${args.escape(who)}`);
  lines.push("");
  lines.push(buildSupportChatTag(args.threadId));
  lines.push("Отвечать не нужно. Свайп-реплай — если хотите вмешаться.");
  lines.push(`<a href="${args.appUrl}/root/feedback">Открыть админку</a>`);
  return lines.join("\n");
}

/** Реплика оператора — руководству организации в Telegram. */
export function composeOperatorReplyTelegram(args: {
  operatorLabel: string;
  body: string;
  escape: (value: string) => string;
  appUrl: string;
}): string {
  return [
    `<b>💬 ${args.escape(args.operatorLabel)}</b>`,
    "",
    args.escape(args.body),
    "",
    `<a href="${args.appUrl}/dashboard?support=chat">Открыть чат</a>`,
  ].join("\n");
}
