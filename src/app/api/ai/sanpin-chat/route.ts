import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { aiChatRateLimiter } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { enqueueAndWait } from "@/lib/ai-assistant/pf-client";
import {
  buildChatJobText,
  parseAssistantReply,
  pathnameSchema,
} from "@/lib/ai-assistant/job-text";
import {
  prepareAction,
  verifyAndExecuteAction,
  type ActionActor,
} from "@/lib/ai-assistant/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Диспетчер отвечает 10–60 секунд; long-poll живёт в этом же запросе.
export const maxDuration = 120;

/**
 * POST /api/ai/sanpin-chat
 *
 * AI-помощник: СанПиН/ХАССП + контекст страницы + данные организации +
 * действия с подтверждением.
 *
 * Сайт к языковой модели НЕ ходит (Anthropic-ключа на проде нет).
 * Каждый вопрос — задание в невидимой очереди ProjectsFlow
 * `ai-prompt-jobs` (mode "assistant", карточек на доске не создаёт);
 * отвечает диспетчерская сессия Claude Code. См. `src/lib/ai-assistant/`.
 *
 * Body:
 *   { messages: [...], pathname?: string }            — обычный ход чата
 *   { messages: [...], confirmAction: { token } }     — подтверждение
 *     действия из карточки. Выполняется обычным серверным кодом (без AI
 *     и без расхода квоты) с полным набором guard'ов.
 */
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(20),
  pathname: pathnameSchema.optional(),
  confirmAction: z.object({ token: z.string().min(1).max(8000) }).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  // Per-user rate limit: 10 запросов в минуту. Защищает от спама и
  // от расхода очереди диспетчера одним юзером. Месячная quota по org —
  // отдельно ниже.
  if (!aiChatRateLimiter.consume(`user:${auth.session.user.id}`)) {
    return NextResponse.json(
      {
        error:
          "Слишком много запросов к AI. Подождите минуту и попробуйте снова.",
        retryAfterMs: aiChatRateLimiter.remainingMs(
          `user:${auth.session.user.id}`
        ),
      },
      { status: 429 }
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad body" },
        { status: 400 }
      );
    }
    throw err;
  }

  const orgId = getActiveOrgId(auth.session);
  const actor: ActionActor = {
    id: auth.session.user.id,
    role: auth.session.user.role,
    isRoot: auth.session.user.isRoot === true,
    name: auth.session.user.name ?? null,
  };

  // --- Подтверждение действия: без AI и без квоты. --------------------
  if (parsed.confirmAction) {
    const result = await verifyAndExecuteAction(parsed.confirmAction.token, {
      orgId,
      actor,
    });
    return NextResponse.json({ actionResult: result });
  }

  // --- Обычный ход чата. ----------------------------------------------
  // Free-tier quota: aiMonthlyMessagesLeft на org. -1 = unlimited.
  // Декремент атомарный (updateMany с условием > 0), иначе два
  // concurrent-запроса с left=1 загнали бы счётчик в -1 = «бесплатный
  // безлимит».
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { aiMonthlyMessagesLeft: true, aiMonthlyQuota: true },
  });
  const left = org?.aiMonthlyMessagesLeft ?? 0;
  const isUnlimited = left < 0;
  let messagesLeft: number = isUnlimited ? -1 : 0;
  if (!isUnlimited) {
    const updateResult = await db.organization.updateMany({
      where: { id: orgId, aiMonthlyMessagesLeft: { gt: 0 } },
      data: { aiMonthlyMessagesLeft: { decrement: 1 } },
    });
    if (updateResult.count === 0) {
      return NextResponse.json(
        {
          error: `Месячный лимит AI-сообщений исчерпан (${org?.aiMonthlyQuota ?? 20} в месяц). Перейдите на тариф Pro для безлимитного доступа.`,
          quotaExceeded: true,
          quota: org?.aiMonthlyQuota ?? 20,
        },
        { status: 402 }
      );
    }
    messagesLeft = Math.max(0, left - 1);
  }

  async function refundQuota() {
    if (isUnlimited) return;
    await db.organization
      .update({
        where: { id: orgId },
        data: { aiMonthlyMessagesLeft: { increment: 1 } },
      })
      .catch((err) => console.warn("[sanpin-chat] quota refund failed", err));
  }

  const question = parsed.messages[parsed.messages.length - 1];
  const history = parsed.messages.slice(0, -1);

  let jobText: string;
  try {
    jobText = await buildChatJobText({
      orgId,
      userId: actor.id,
      pathname: parsed.pathname,
      history,
      question: question.content,
    });
  } catch (err) {
    console.error("[sanpin-chat] job text build failed", err);
    await refundQuota();
    return NextResponse.json(
      { error: "Ошибка AI. Подробности в логах сервера." },
      { status: 502 }
    );
  }

  const result = await enqueueAndWait(jobText);
  if (!result.ok) {
    // Пользователь не должен терять сообщение из-за нашего upstream'а.
    await refundQuota();
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "not_configured" ? 503 : 502 }
    );
  }

  const { reply, action } = parseAssistantReply(result.text);

  // Действие от исполнителя — недоверенный вход: валидация + резолв в
  // превью-карточку. Невалидное действие не роняет ответ — просто нет
  // карточки, а причина дописывается к reply.
  let pendingAction = null;
  let replyOut = reply || "(пустой ответ)";
  if (action) {
    const prepared = await prepareAction(action, { orgId, actor });
    if (prepared.ok) {
      pendingAction = prepared.preview;
    } else {
      replyOut = `${replyOut}\n\nНе удалось подготовить действие: ${prepared.error}`;
    }
  }

  return NextResponse.json({
    reply: replyOut,
    pendingAction,
    messagesLeft,
    isUnlimited,
  });
}
