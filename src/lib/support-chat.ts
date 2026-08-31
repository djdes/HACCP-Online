/**
 * Онлайн-чат с поддержкой.
 *
 * Один пользователь — одна ветка на всё время. Человек, вернувшийся через
 * неделю, видит, о чём писал раньше, и не пересказывает всё заново; тот же
 * контекст видит оператор.
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
