import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireApiAuth } from "@/lib/auth-helpers";
import { aiHeavyRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * L7 — AI-перевод инструкций для иностранных рабочих.
 *
 * POST /api/ai/translate
 * Body: { text: string, to: "tg" | "uz" | "ky" | "tk" | "en" }
 *
 * В РФ много мигрантов — повара, посудомойки, уборщики из СА. Помощь
 * руководителю быстро перевести «инструкцию по гигиене» / «как
 * заполнять журнал» на их язык.
 *
 * Auth: management только. Расходует общую AI-квоту.
 */

const Schema = z.object({
  text: z.string().min(1).max(4000),
  to: z.enum(["tg", "uz", "ky", "tk", "en", "ar"]),
});

const LANG_NAMES: Record<string, string> = {
  tg: "таджикский",
  uz: "узбекский",
  ky: "киргизский",
  tk: "туркменский",
  en: "английский",
  ar: "арабский",
};

const SYSTEM_PROMPT = `Ты — переводчик-консультант для пищевой индустрии. Переводишь инструкции и подсказки для рабочих ресторанов и кухонь с русского на указанный язык.

Стиль:
- Простые слова. Рабочий не имеет высшего образования и читает язык на bytового уровня.
- Сохраняй термины СанПиН/ХАССП в скобках с оригиналом если они нелегко переводимы.
- Числа и температуры оставляй как есть.
- Без приветствий и вступлений — сразу перевод.

Возвращай ТОЛЬКО переведённый текст. Никаких пояснений.`;

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI-помощник недоступен" },
      { status: 503 }
    );
  }
  if (!aiHeavyRateLimiter.consume(`ai-translate:${auth.session.user.id}`)) {
    return NextResponse.json(
      { error: "Слишком много запросов на перевод" },
      { status: 429 }
    );
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 }
      );
    }
    throw err;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Переведи на ${LANG_NAMES[body.to]}:\n\n${body.text}`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    const translated =
      block && block.type === "text" ? block.text.trim() : "";
    return NextResponse.json({
      translated,
      languageCode: body.to,
      languageName: LANG_NAMES[body.to],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? `Ошибка AI: ${err.message}` : "Ошибка AI",
      },
      { status: 500 }
    );
  }
}
