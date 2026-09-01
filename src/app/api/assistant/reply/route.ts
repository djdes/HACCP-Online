import { NextResponse } from "next/server";
import { z } from "zod";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { failTurn, findPendingByToken, resolveTurn } from "@/lib/assistant/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ответ исполнителя.
 *
 * Токен гасится в тот же момент — ход закрывается ровно один раз.
 * Повторный POST с тем же токеном уже не найдёт pending-строки и получит
 * 404: иначе ответ можно было бы переписать задним числом.
 */

const limiter = createRateLimiter({
  tokensPerInterval: 60,
  intervalMs: 60_000,
});

const schema = z.object({
  text: z.string().trim().min(1, "Пустой ответ").max(8000, "Ответ слишком длинный"),
  /// Исполнитель может честно сказать, что не справился.
  error: z.string().trim().max(500).optional(),
});

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  if (!limiter.consume(`assistant-cb:${ip}`)) {
    return NextResponse.json({ error: "Слишком часто" }, { status: 429 });
  }

  const token = bearer(request);
  if (!token) {
    return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный ответ" },
      { status: 400 }
    );
  }

  const message = await findPendingByToken(token);
  if (!message) {
    return NextResponse.json(
      { error: "Ход не найден или уже закрыт" },
      { status: 404 }
    );
  }

  if (parsed.data.error) {
    await failTurn({ messageId: message.id, error: parsed.data.error });
    return NextResponse.json({ ok: true });
  }

  await resolveTurn({ messageId: message.id, content: parsed.data.text });
  return NextResponse.json({ ok: true });
}
