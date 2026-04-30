import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireApiAuth } from "@/lib/auth-helpers";
import { aiHeavyRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * L4 — AI-проверка качества photo evidence в журналах.
 *
 * POST /api/ai/check-photo
 * Body: { imageUrl: string, expectedKind: "food" | "equipment" | "document" | "any" }
 *
 * Возвращает оценку валидности фото — содержит ли оно ожидаемый
 * объект, либо это случайный палец / размытое / тёмное.
 *
 * Используется опционально на upload — менеджер получает hint
 * «фото №3 не похоже на еду, перезалить?».
 *
 * Auth: management. Расходует AI-квоту.
 *
 * SECURITY: imageUrl ограничен путями `/uploads/<safe-name>` —
 * читаем файл напрямую с диска, никаких сетевых fetch'ей. Раньше
 * принимался произвольный URL и `fetch(imageUrl)` уходил на любой
 * адрес, включая 169.254.169.254 / 127.0.0.1 / 10.0.0.0 — это была
 * SSRF-уязвимость через user-controlled URL.
 */
const PHOTO_URL_PATTERN = /^\/uploads\/[a-zA-Z0-9._-]{1,128}$/;

const Schema = z.object({
  imageUrl: z
    .string()
    .min(1)
    .regex(PHOTO_URL_PATTERN, "imageUrl должен быть из /uploads/"),
  expectedKind: z.enum(["food", "equipment", "document", "any"]).default("any"),
});

function inferMediaType(filename: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

const KIND_HINTS: Record<string, string> = {
  food: "Это должна быть еда / готовое блюдо / продукт.",
  equipment: "Это должно быть кухонное оборудование (холодильник, печь, посуда).",
  document: "Это должна быть накладная / маркировка / документ с текстом.",
  any: "Это должно быть какое-то осмысленное изображение, относящееся к работе кухни.",
};

const SYSTEM_PROMPT = `Ты — контролёр качества фото-документации в системе журналов СанПиН/ХАССП. Твоя задача — оценить, пригодно ли загруженное фото как evidence в журнале.

Ответ строго в JSON:
{
  "valid": true | false,
  "confidence": 0.0-1.0,
  "kind": "food" | "equipment" | "document" | "blur" | "finger" | "dark" | "other",
  "reason": "Кратко (1 предложение) что на фото и можно ли использовать"
}

Правила:
- Если фото размытое / тёмное / палец / пустое — valid=false
- Если фото содержит ожидаемый объект — valid=true
- confidence 0.7+ для уверенных случаев, 0.4-0.7 для borderline.
- Reason на русском, 1 предложение.

Никаких комментариев вокруг JSON.`;

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI недоступен" }, { status: 503 });
  }
  if (!aiHeavyRateLimiter.consume(`ai-vision:${auth.session.user.id}`)) {
    return NextResponse.json(
      { error: "Слишком много запросов" },
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

  // Читаем файл с диска, не через сеть — никаких SSRF-векторов.
  let imageBase64: string;
  const filename = body.imageUrl.split("/").pop() ?? "photo.jpg";
  const mediaType = inferMediaType(filename);
  try {
    const filepath = join(process.cwd(), "public", body.imageUrl);
    const buf = await readFile(filepath);
    if (buf.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Фото больше 5 МБ — оптимизируйте перед проверкой" },
        { status: 400 }
      );
    }
    imageBase64 = buf.toString("base64");
  } catch {
    return NextResponse.json(
      { error: "Не удалось прочитать фото" },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
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
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Контекст: ${KIND_HINTS[body.expectedKind]}\n\nОцени фото и верни JSON.`,
            },
          ],
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text.trim() : "";
    let parsed: Record<string, unknown> = {};
    try {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "AI вернул некорректный JSON", raw: raw.slice(0, 300) },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed);
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
