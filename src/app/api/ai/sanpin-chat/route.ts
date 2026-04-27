import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireApiAuth } from "@/lib/auth-helpers";
import { aiChatRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/sanpin-chat
 *
 * Body:
 *   { messages: [{ role: "user" | "assistant", content: string }, ...] }
 *
 * Возвращает streaming-ответ Claude'а с system-prompt'ом, в котором
 * ai играет роль эксперта по СанПиН/ХАССП.
 *
 * Что отличает этого помощника от generic-чата:
 *   - Глубокая «контекстная закладка» в system: какие нормативы РФ
 *     релевантны, как структурировать ответы (ссылка на пункт ТР ТС
 *     021/2011, СанПиН 2.3/2.4.3590-20, СП 2.4.3648-20).
 *   - Refusal'ы: «не могу заменить юриста / технолога»; «уточняйте у
 *     своего технолога перед внедрением».
 *   - Краткость: ответ ≤ 200 слов по умолчанию, рабочему на кухне
 *     не нужны простыни текста.
 *
 * Не RAG — embeddings ТР ТС положим позже, сейчас подача через
 * system prompt и Claude общие знания.
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
});

const SYSTEM_PROMPT = `Ты — AI-помощник в системе WeSetup (электронные журналы СанПиН и ХАССП для пищевых производств в РФ). Твоя задача — отвечать на вопросы технологов, шеф-поваров и менеджеров кафе, ресторанов, пекарен, мясокомбинатов о требованиях санитарных норм и ХАССП-плана.

Ключевые российские нормативы, на которые ты ориентируешься:
- ТР ТС 021/2011 «О безопасности пищевой продукции»
- ТР ТС 022/2011 «Пищевая продукция в части её маркировки»
- СанПиН 2.3/2.4.3590-20 (общественное питание, организации)
- СП 2.4.3648-20 (детские, образовательные учреждения)
- ГОСТ Р 51705.1-2001 (управление качеством, ХАССП)
- СанПиН 1.2.3685-21 (гигиенические нормативы факторов среды)

Правила ответа:
1. КРАТКО — обычно 3–7 предложений. Если вопрос требует длинного ответа — сделай маркированный список.
2. Если знаешь конкретный пункт нормативного документа — ссылайся («согласно п. 2.5 СанПиН 2.3/2.4.3590-20…»).
3. Если вопрос юридически тонкий или требует решения собственника бизнеса — пометь это («это решение должен принимать ваш технолог / юрист»).
4. Если не знаешь точно — скажи «не уверен», предложи проверить в Росстандарте / Роспотребнадзоре.
5. Отвечай на русском, в дружелюбном-профессиональном тоне (на «вы»).
6. Никогда не выдавай юридических заключений. Никогда не говори «это законно» / «это незаконно» — только «согласно нормативу X требуется Y».

Примеры хороших ответов:
- «Какая температура должна быть в холодильнике для готовых блюд?» → «Согласно п. 4.5 СанПиН 2.3/2.4.3590-20, готовая продукция и сырьё должны храниться раздельно при +2…+6 °C. Замер фиксируется минимум 2 раза в смену в журнале контроля холодильного оборудования. Рекомендую вести замер каждые 4 часа на проблемных холодильниках.»
- «Как часто менять масло во фритюре?» → «Жёсткой нормы по часам нет. ХАССП требует контроля по визуальным критериям (потемнение, дымление, пенообразование) и/или по показаниям полярных соединений (norm: ≤ 25%). На практике большинство ресторанов меняют каждые 1–3 смены. Журнал контроля фритюра должен фиксировать каждый замер.»`;

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  // Per-user rate limit: 10 запросов в минуту. Защищает от спама
  // и сильного перерасхода токенов одним юзером (например, скрипт
  // в цикле). Месячный quota по org остался отдельно.
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI-помощник недоступен (ANTHROPIC_API_KEY не настроен)" },
      { status: 503 }
    );
  }

  // Free-tier rate-limit: проверяем aiMonthlyMessagesLeft на org.
  // -1 = unlimited (Pro tier), 0 — отказ + upgrade-CTA.
  const { db } = await import("@/lib/db");
  const { getActiveOrgId } = await import("@/lib/auth-helpers");
  const orgId = getActiveOrgId(auth.session);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { aiMonthlyMessagesLeft: true, aiMonthlyQuota: true },
  });
  const left = org?.aiMonthlyMessagesLeft ?? 0;
  const isUnlimited = left < 0;
  if (!isUnlimited && left <= 0) {
    return NextResponse.json(
      {
        error: `Месячный лимит AI-сообщений исчерпан (${org?.aiMonthlyQuota ?? 20} в месяц). Перейдите на тариф Pro для безлимитного доступа.`,
        quotaExceeded: true,
        quota: org?.aiMonthlyQuota ?? 20,
      },
      { status: 402 }
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // Prompt caching: system-prompt у нас ~600 токенов и идентичен для
    // всех юзеров. Anthropic кеширует его на 5 минут — повторные
    // запросы одного и того же юзера или соседних работников в той же
    // org стоят 10× дешевле на input-токенах ($0.08 vs $0.80 / 1M
    // tokens для Haiku 4.5). Документация:
    // https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    //
    // Передаём system как массив из одного блока с cache_control —
    // первая часть (system) кешируется, messages всё равно меняются.
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: parsed.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock && textBlock.type === "text" ? textBlock.text : "";

    // Decrement quota — best-effort. Не валит ответ при ошибке write'а.
    let messagesLeft = isUnlimited ? -1 : Math.max(0, left - 1);
    if (!isUnlimited) {
      try {
        const updated = await db.organization.update({
          where: { id: orgId },
          data: { aiMonthlyMessagesLeft: { decrement: 1 } },
          select: { aiMonthlyMessagesLeft: true },
        });
        messagesLeft = Math.max(0, updated.aiMonthlyMessagesLeft);
      } catch (err) {
        console.warn("[sanpin-chat] quota decrement failed", err);
      }
    }

    return NextResponse.json({
      reply,
      messagesLeft,
      isUnlimited,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        // Возвращаем cache-метрики если Anthropic SDK их выдал —
        // полезно для отладки и observability.
        cacheReadTokens:
          (response.usage as { cache_read_input_tokens?: number })
            .cache_read_input_tokens ?? 0,
        cacheCreationTokens:
          (response.usage as { cache_creation_input_tokens?: number })
            .cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    console.error("[sanpin-chat] anthropic error", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Ошибка AI: ${err.message}`
            : "Ошибка обращения к AI-помощнику",
      },
      { status: 502 }
    );
  }
}
