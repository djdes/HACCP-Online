import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ocr/reading — распознать ОДНО число с дисплея прибора.
 *
 * Отличается от `/api/ocr/label` (та читает этикетку продукта и
 * возвращает десяток полей): здесь нужен ровно один показатель —
 * температура с термометра, влажность с гигрометра, наработка со
 * счётчика УФ-установки.
 *
 * Зачем: по журналам холодильников и климата набирается 240–720 чисел в
 * месяц, и ошибиться в «-18» против «18» на морозильнике проще, чем
 * кажется. Распознанное значение подставляется в поле, но сохраняет его
 * человек — подтверждение остаётся за ним.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Распознавание не настроено" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Фото не загружено" }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Файл слишком большой" }, { status: 413 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Поддерживаются только JPEG, PNG, WEBP или GIF" },
        { status: 415 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = file.type as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif";

    const client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      timeout: 30_000,
    });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `На фото — дисплей измерительного прибора (термометр, гигрометр или счётчик наработки).

Верни ТОЛЬКО JSON без markdown:
{"value": <число или null>, "unit": "C" | "%" | "h" | null, "confidence": "high" | "medium" | "low"}

Правила:
- value — ровно то число, что показывает дисплей. Десятичный разделитель — точка.
- Знак минус важен: на морозильниках показания отрицательные. Если минус не виден однозначно — confidence не выше "medium".
- Если чисел несколько (например, температура и влажность), верни то, что крупнее и является основным показанием.
- Если число не читается — value: null.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Не удалось распознать показание" },
        { status: 422 }
      );
    }

    const parsed = JSON.parse(textBlock.text.trim()) as {
      value?: unknown;
      unit?: unknown;
      confidence?: unknown;
    };

    const value =
      typeof parsed.value === "number" && Number.isFinite(parsed.value)
        ? parsed.value
        : null;

    return NextResponse.json({
      value,
      unit: typeof parsed.unit === "string" ? parsed.unit : null,
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium"
          ? parsed.confidence
          : "low",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Не удалось разобрать ответ. Попробуйте другое фото." },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Ошибка распознавания. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
