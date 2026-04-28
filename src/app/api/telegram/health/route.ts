import { NextResponse } from "next/server";
import { getInboundBot } from "@/lib/bot/bot-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/telegram/health
 *
 * Лёгкий health-check бота. Возвращает:
 *   - `tokenConfigured`     — выставлен ли `TELEGRAM_BOT_TOKEN`;
 *   - `webhookSecretConfigured` — выставлен ли `TELEGRAM_WEBHOOK_SECRET`;
 *   - `getMe`               — `{ ok, username, id, error? }` от
 *                             `bot.api.getMe()` с таймаутом ~5s;
 *   - `latencyMs`           — время `getMe()` до ответа.
 *
 * Используется в `/root/telegram-logs` (зелёный/красный индикатор) и
 * uptime-checker'ах. Не требует CRON_SECRET — endpoint anonymous, чтобы
 * uptime-сервисам было легче дёрнуть. Никакая чувствительная инфа в
 * ответе не светится (только bot username).
 */
export async function GET() {
  const tokenConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const webhookSecretConfigured = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);

  if (!tokenConfigured) {
    return NextResponse.json(
      {
        ok: false,
        tokenConfigured: false,
        webhookSecretConfigured,
        getMe: { ok: false, error: "TELEGRAM_BOT_TOKEN не настроен" },
        latencyMs: null,
      },
      { status: 503 }
    );
  }

  const bot = getInboundBot();
  if (!bot) {
    return NextResponse.json(
      {
        ok: false,
        tokenConfigured,
        webhookSecretConfigured,
        getMe: { ok: false, error: "Bot инстанс не инициализирован" },
        latencyMs: null,
      },
      { status: 503 }
    );
  }

  const start = Date.now();
  // grammy `bot.api.getMe()` уйдёт в Telegram Bot API; чтобы не висеть
  // дольше 5s (например, если Telegram блокирован) — race с таймаутом.
  const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
    setTimeout(() => resolve({ timeout: true }), 5000)
  );
  try {
    const result = await Promise.race([
      bot.api
        .getMe()
        .then((me) => ({ timeout: false as const, me }))
        .catch((err: unknown) => ({
          timeout: false as const,
          error: err instanceof Error ? err.message : String(err),
        })),
      timeoutPromise.then(() => ({ timeout: true as const })),
    ]);
    const latencyMs = Date.now() - start;

    if ("timeout" in result && result.timeout) {
      return NextResponse.json(
        {
          ok: false,
          tokenConfigured,
          webhookSecretConfigured,
          getMe: { ok: false, error: "getMe() timeout > 5s" },
          latencyMs,
        },
        { status: 504 }
      );
    }

    if ("error" in result && typeof result.error === "string") {
      return NextResponse.json(
        {
          ok: false,
          tokenConfigured,
          webhookSecretConfigured,
          getMe: { ok: false, error: result.error.slice(0, 300) },
          latencyMs,
        },
        { status: 503 }
      );
    }

    if ("me" in result) {
      return NextResponse.json({
        ok: true,
        tokenConfigured,
        webhookSecretConfigured,
        getMe: {
          ok: true,
          username: result.me.username,
          id: result.me.id,
        },
        latencyMs,
      });
    }

    // Defensive — не должно случиться.
    return NextResponse.json(
      {
        ok: false,
        tokenConfigured,
        webhookSecretConfigured,
        getMe: { ok: false, error: "unexpected race state" },
        latencyMs,
      },
      { status: 500 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        tokenConfigured,
        webhookSecretConfigured,
        getMe: {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    );
  }
}
