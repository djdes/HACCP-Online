import { NextResponse } from "next/server";

import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ tokensPerInterval: 60, intervalMs: 60 * 1000 });

/**
 * Тестовый приёмник вебхуков: `https://wesetup.ru/api/webhooks/echo`.
 * Подпишите его в «Настройки → Вебхуки», чтобы увидеть доставки в журнале
 * ещё до того, как поднят свой сервер. Ничего не хранит, отвечает 200.
 */
export async function POST(request: Request) {
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || "unknown";
  if (!limiter.consume(`webhook-echo:${ip}`)) return NextResponse.json({ error: "Слишком часто" }, { status: 429 });
  const body = await request.text();
  return NextResponse.json({
    ok: true,
    event: request.headers.get("x-wesetup-event"),
    delivery: request.headers.get("x-wesetup-delivery"),
    signed: Boolean(request.headers.get("x-wesetup-signature")),
    bytes: body.length,
  });
}

export function GET() {
  return NextResponse.json({ ok: true, hint: "Отправьте POST — приёмник ответит 200 и покажет заголовки события." });
}
