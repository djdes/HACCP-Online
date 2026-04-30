import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/capa/[id]/suggest?step=root_cause|corrective|preventive
 *
 * Возвращает 3 варианта формулировки для текущего шага CAPA workflow,
 * сгенерированные Claude Haiku на основе контекста тикета. Менеджер
 * может выбрать один и доработать вручную.
 *
 * Стоимость одного вызова — ~2K input + ~600 output tokens на Haiku
 * 4.5 = ~$0.003 (≈ 0.30 ₽). Учитывается в общем месячном квоте AI.
 */

const SYSTEM_PROMPT = `Ты — эксперт ХАССП с 15 годами опыта внедрения CAPA (Corrective and Preventive Action) на пищевых производствах в РФ. Ты опираешься на ТР ТС 021/2011, ГОСТ Р 51705.1-2001, СанПиН 2.3/2.4.3590-20.

Твоя задача — на основе описания инцидента сгенерировать ровно 3 варианта формулировки запрошенного раздела CAPA. Варианты должны быть:
- РАЗНЫМИ по подходу (например, технический фикс vs процессный vs обучающий).
- КОНКРЕТНЫМИ — указывай реальные действия с глаголами «проверить», «заменить», «обучить», «провести», «составить».
- ПРИЕМЛЕМЫМИ для российской пищевой компании среднего размера (нет «закупите хроматограф за 5 млн»).
- КРАТКИМИ — каждый вариант 2-4 предложения, без воды.

Формат ответа — строго JSON:
{
  "suggestions": [
    { "title": "Краткая шапка варианта (5-7 слов)", "text": "Полный текст 2-4 предложения" },
    { "title": "...", "text": "..." },
    { "title": "...", "text": "..." }
  ]
}

Никаких комментариев вокруг JSON. Ничего не добавляй после закрывающей скобки.`;

const STEP_PROMPTS: Record<string, string> = {
  root_cause:
    'Сгенерируй 3 варианта формулировки **корневой причины** инцидента. Используй принцип "5 почему" — копай глубже чем «не соблюдали правила». Корневая причина — это _почему_ человек не соблюдал правила (нет инструкции, не было обучения, не работало оборудование, не выполнялся контроль).',
  corrective:
    "Сгенерируй 3 варианта **корректирующего действия** — что нужно сделать СЕЙЧАС, чтобы устранить непосредственное последствие инцидента. Это операция «здесь и теперь»: исправить, заменить, утилизировать, пересмотреть. НЕ путать с предупреждающим действием (что сделать, чтобы не повторилось).",
  preventive:
    "Сгенерируй 3 варианта **предупреждающего действия** — что нужно сделать СИСТЕМНО, чтобы инцидент не повторился. Это изменение процесса, обучение, добавление контрольной точки, регламент. ДОЛГОСРОЧНОЕ. НЕ путать с корректирующим (что прямо сейчас).",
};

type Suggestion = { title: string; text: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  // Раньше: только requireApiAuth — любой authenticated юзер мог
  // дёргать AI-suggest и сжигать месячный AI-квоту org-и. Cleaner
  // спамил endpoint в цикле — менеджер видит «лимит исчерпан» утром.
  // CAPA workflow — management-only по дизайну (см. /api/capa
  // POST/GET); согласовываем suggest с ним.
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI-помощник недоступен" },
      { status: 503 }
    );
  }

  const { id } = await params;
  const orgId = getActiveOrgId(auth.session);

  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "corrective";
  const stepInstruction = STEP_PROMPTS[step];
  if (!stepInstruction) {
    return NextResponse.json(
      {
        error: `step должен быть одним из: ${Object.keys(STEP_PROMPTS).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const ticket = await db.capaTicket.findUnique({ where: { id } });
  if (!ticket || ticket.organizationId !== orgId) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  // Quota — общая с sanpin-chat. -1 = unlimited.
  // Атомарный conditional decrement: read-then-decrement допускал
  // race-condition при котором два параллельных запроса с left=1
  // оба декрементировали → итоговое значение -1 → org получала
  // бесплатный безлимит (потому что -1 = unlimited).
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      aiMonthlyMessagesLeft: true,
      aiMonthlyQuota: true,
      type: true,
      name: true,
    },
  });
  const left = org?.aiMonthlyMessagesLeft ?? 0;
  const isUnlimited = left < 0;
  if (!isUnlimited) {
    const updateResult = await db.organization.updateMany({
      where: { id: orgId, aiMonthlyMessagesLeft: { gt: 0 } },
      data: { aiMonthlyMessagesLeft: { decrement: 1 } },
    });
    if (updateResult.count === 0) {
      return NextResponse.json(
        {
          error: `Месячный лимит AI-сообщений исчерпан (${
            org?.aiMonthlyQuota ?? 20
          }). Перейдите на тариф Pro.`,
          quotaExceeded: true,
        },
        { status: 402 }
      );
    }
  }

  const userPrompt = `Контекст организации:
- Тип: ${org?.type ?? "не указан"}
- Название: ${org?.name ?? "—"}

Инцидент:
- Заголовок: ${ticket.title}
- Категория: ${ticket.category}
- Приоритет: ${ticket.priority}
- Описание: ${ticket.description ?? "(не заполнено)"}
${
  ticket.rootCause
    ? `- Уже найденная корневая причина: ${ticket.rootCause}\n`
    : ""
}${
  ticket.correctiveAction
    ? `- Уже сформулированное корректирующее действие: ${ticket.correctiveAction}\n`
    : ""
}
Задача:
${stepInstruction}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const raw =
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

    let parsed: { suggestions?: Suggestion[] } = {};
    try {
      // Иногда Claude оборачивает в ```json ... ```
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Refund квоты — AI вернул мусор, пользователь не должен платить.
      if (!isUnlimited) {
        await db.organization
          .update({
            where: { id: orgId },
            data: { aiMonthlyMessagesLeft: { increment: 1 } },
          })
          .catch(() => null);
      }
      return NextResponse.json(
        {
          error: "AI вернул некорректный JSON",
          raw: raw.slice(0, 500),
        },
        { status: 502 }
      );
    }

    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      // Refund квоты — Anthropic ответил, но контент бесполезный.
      if (!isUnlimited) {
        await db.organization
          .update({
            where: { id: orgId },
            data: { aiMonthlyMessagesLeft: { increment: 1 } },
          })
          .catch(() => null);
      }
      return NextResponse.json(
        { error: "AI не вернул suggestions" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      suggestions: parsed.suggestions.slice(0, 3),
      step,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    console.error("[capa-suggest] anthropic error", err);
    // Refund квоты — пользователь не должен терять сообщение из-за
    // нашего upstream-сбоя.
    if (!isUnlimited) {
      await db.organization
        .update({
          where: { id: orgId },
          data: { aiMonthlyMessagesLeft: { increment: 1 } },
        })
        .catch((refundErr) =>
          console.warn("[capa-suggest] quota refund failed", refundErr)
        );
    }
    // err.message может содержать ANTHROPIC_API_KEY в URL fetch'а
    // при некоторых network-failures (Anthropic SDK логирует body
    // request'ов). Не отдаём raw в JSON, а только generic. Подробности
    // уже в console.error выше — админ видит в PM2 logs.
    return NextResponse.json(
      { error: "Ошибка AI. Подробности в логах сервера." },
      { status: 500 }
    );
  }
}
