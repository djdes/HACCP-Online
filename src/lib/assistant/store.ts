import { db } from "@/lib/db";
import {
  ASSISTANT_TOKEN_TTL_MS,
  createAssistantToken,
  hashAssistantToken,
} from "@/lib/assistant/token";

/**
 * Хранилище диалогов ассистента.
 *
 * Один пользователь — один диалог на всё время. Отдельные «сессии» тут
 * ничего не дают: человек спрашивает про свои же журналы, и вчерашний
 * контекст завтра так же уместен.
 */

export const ASSISTANT_MAX_MESSAGE_LENGTH = 2000;
export const ASSISTANT_MIN_MESSAGE_LENGTH = 2;
/** Сколько последних реплик показываем и отдаём исполнителю. */
export const ASSISTANT_HISTORY_LIMIT = 60;

export type AssistantTurn = {
  userMessageId: string;
  assistantMessageId: string;
  token: string;
  conversationId: string;
};

export async function getOrCreateConversation(args: {
  userId: string;
  organizationId: string;
}) {
  return db.assistantConversation.upsert({
    where: { userId: args.userId },
    create: { userId: args.userId, organizationId: args.organizationId },
    // Организация могла смениться (перевод сотрудника) — держим свежую,
    // иначе ассистент покажет данные прежнего места работы.
    update: { organizationId: args.organizationId },
    select: { id: true },
  });
}

/**
 * Ход диалога — сразу две строки: вопрос человека и заготовка ответа.
 *
 * Заготовка нужна до всякой отправки: исполнитель придёт с ответом
 * асинхронно, и класть его будет некуда, если строки ещё нет. Заодно
 * пользователь сразу видит «печатает», а не пустоту.
 */
export async function createTurn(args: {
  conversationId: string;
  content: string;
}): Promise<AssistantTurn> {
  const token = createAssistantToken();
  const now = new Date();

  const [userMessage, assistantMessage] = await db.$transaction([
    db.assistantMessage.create({
      data: {
        conversationId: args.conversationId,
        role: "user",
        content: args.content,
        status: "done",
      },
      select: { id: true },
    }),
    db.assistantMessage.create({
      data: {
        conversationId: args.conversationId,
        role: "assistant",
        content: "",
        status: "pending",
        tokenHash: hashAssistantToken(token),
        tokenExpiresAt: new Date(now.getTime() + ASSISTANT_TOKEN_TTL_MS),
      },
      select: { id: true },
    }),
    db.assistantConversation.update({
      where: { id: args.conversationId },
      data: { lastMessageAt: now },
    }),
  ]);

  return {
    conversationId: args.conversationId,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    token,
  };
}

/**
 * Находит ход по токену и проверяет срок.
 *
 * Токен ищем по хэшу — это единственный способ найти строку, не храня
 * сам токен. Просроченный ход не отдаём: ответ на него уже никого не
 * ждёт, а пользователь получил ошибку.
 */
export async function findPendingByToken(token: string) {
  const message = await db.assistantMessage.findFirst({
    where: {
      tokenHash: hashAssistantToken(token),
      status: "pending",
    },
    select: {
      id: true,
      conversationId: true,
      tokenHash: true,
      tokenExpiresAt: true,
      conversation: {
        select: { id: true, organizationId: true, userId: true },
      },
    },
  });
  if (!message) return null;
  if (message.tokenExpiresAt && message.tokenExpiresAt.getTime() < Date.now()) {
    return null;
  }
  return message;
}

export async function markFetched(messageId: string) {
  await db.assistantMessage.update({
    where: { id: messageId },
    data: { fetchedAt: new Date() },
  });
}

/** Ответ пришёл: гасим токен, чтобы вторым запросом ответ не переписали. */
export async function resolveTurn(args: {
  messageId: string;
  content: string;
}) {
  await db.assistantMessage.update({
    where: { id: args.messageId },
    data: {
      content: args.content,
      status: "done",
      tokenHash: null,
      tokenExpiresAt: null,
    },
  });
}

export async function failTurn(args: { messageId: string; error: string }) {
  await db.assistantMessage.update({
    where: { id: args.messageId },
    data: {
      status: "error",
      error: args.error.slice(0, 500),
      tokenHash: null,
      tokenExpiresAt: null,
    },
  });
}

/**
 * Подметает ходы, до которых никто не дошёл.
 *
 * Без этого зависший ход крутит «печатает» вечно. Вызывается при каждом
 * чтении диалога — отдельного крона ради трёх строк заводить незачем.
 */
export async function sweepStale() {
  const result = await db.assistantMessage.updateMany({
    where: { status: "pending", tokenExpiresAt: { lt: new Date() } },
    data: {
      status: "error",
      error: "Ассистент не ответил вовремя. Попробуйте спросить ещё раз",
      tokenHash: null,
    },
  });
  return result.count;
}

export async function listMessages(conversationId: string) {
  return db.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: ASSISTANT_HISTORY_LIMIT,
    select: {
      id: true,
      role: true,
      content: true,
      status: true,
      error: true,
      createdAt: true,
    },
  });
}
