import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { createRateLimiter } from "@/lib/rate-limit";
import { resolveAssistantConfig } from "@/lib/assistant/config";
import { dispatchAssistantTurn } from "@/lib/assistant/dispatch";
import {
  ASSISTANT_MAX_MESSAGE_LENGTH,
  ASSISTANT_MIN_MESSAGE_LENGTH,
  createTurn,
  getOrCreateConversation,
  listMessages,
  sweepStale,
} from "@/lib/assistant/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Диалог пользователя с ассистентом.
 *
 * GET — вся переписка (её же опрашивает виджет, пока ждёт ответа).
 * POST — новый вопрос: заводим ход и ставим задание в очередь.
 *
 * Ассистент отвечает ТОЛЬКО авторизованным. Гость с лендинга попадает к
 * живому оператору: пускать анонимный трафик из интернета в языковую
 * модель — это открытый счётчик расходов и открытая дверь для
 * накрутки.
 */

const limiter = createRateLimiter({
  tokensPerInterval: 15,
  intervalMs: 60_000,
});

const schema = z.object({
  message: z
    .string()
    .trim()
    .min(ASSISTANT_MIN_MESSAGE_LENGTH, "Вопрос слишком короткий")
    .max(ASSISTANT_MAX_MESSAGE_LENGTH, "Вопрос слишком длинный"),
});

export async function GET() {
  const session = await requireAuth();
  const organizationId = getActiveOrgId(session);

  // Подметаем зависшие ходы прямо здесь: отдельный крон ради этого
  // заводить незачем, а «печатает» навсегда — худшее, что может быть.
  await sweepStale().catch(() => 0);

  const conversation = await getOrCreateConversation({
    userId: session.user.id,
    organizationId,
  });
  const messages = await listMessages(conversation.id);
  const config = await resolveAssistantConfig();

  return NextResponse.json({
    conversationId: conversation.id,
    messages,
    available: Boolean(config),
  });
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = getActiveOrgId(session);

  if (!limiter.consume(`assistant:${session.user.id}`)) {
    return NextResponse.json(
      { error: "Слишком много вопросов подряд. Подождите минуту" },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный вопрос" },
      { status: 400 }
    );
  }

  const config = await resolveAssistantConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Ассистент сейчас выключен. Напишите в поддержку" },
      { status: 503 }
    );
  }

  const conversation = await getOrCreateConversation({
    userId: session.user.id,
    organizationId,
  });
  const turn = await createTurn({
    conversationId: conversation.id,
    content: parsed.data.message,
  });

  // Постановку задания выносим за ответ: пользователь сразу видит свой
  // вопрос и «печатает», а не ждёт, пока ответит чужой сервис.
  after(async () => {
    await dispatchAssistantTurn({
      messageId: turn.assistantMessageId,
      question: parsed.data.message,
      token: turn.token,
    });
  });

  const messages = await listMessages(conversation.id);
  return NextResponse.json({ ok: true, messages });
}
