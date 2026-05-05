import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getInboundBot } from "@/lib/bot/bot-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mini/_smoke?secret=$CRON_SECRET
 *
 * Operational smoke-check endpoint для uptime-чекеров (Pingdom,
 * UptimeRobot, cron-job.org). Дёргает все critical зависимости из
 * одного места и отдаёт sum-up status:
 *
 *   { ok: boolean, checks: { db, telegram, build }, latencyMs }
 *
 * Status code 200 если все checks `ok`, 503 — если хотя бы один failed.
 *
 * Защищён `?secret=$CRON_SECRET`. Хотя в идеале endpoint должен быть
 * доступен пингерам, мы предпочитаем секретность над public-disclosure
 * метрик production стека (build sha, internal latency'и не должны
 * быть public). Если нужен public health-check — есть
 * `/api/telegram/health`, отдаёт generic info без credentials.
 */

type CheckResult = {
  ok: boolean;
  latencyMs: number;
  detail?: string;
};

async function checkDb(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message.slice(0, 200) : "error",
    };
  }
}

async function checkTelegram(): Promise<
  CheckResult & { username?: string }
> {
  const bot = getInboundBot();
  if (!bot) {
    return { ok: false, latencyMs: 0, detail: "bot not configured" };
  }
  const start = Date.now();
  // Race с 5s timeout — Bot API из России периодически отдаёт ETIMEDOUT
  // через cloudflare proxy. 5s достаточно: в норме getMe уезжает за ~200ms.
  const timeoutPromise = new Promise<{ kind: "timeout" }>((resolve) =>
    setTimeout(() => resolve({ kind: "timeout" }), 5000)
  );
  try {
    const result = await Promise.race([
      bot.api
        .getMe()
        .then((me) => ({ kind: "ok" as const, me }))
        .catch((err: unknown) => ({
          kind: "err" as const,
          message: err instanceof Error ? err.message : String(err),
        })),
      timeoutPromise,
    ]);
    const latencyMs = Date.now() - start;
    if (result.kind === "ok") {
      return {
        ok: true,
        latencyMs,
        username: result.me.username ?? undefined,
      };
    }
    if (result.kind === "timeout") {
      return { ok: false, latencyMs, detail: "getMe timeout > 5s" };
    }
    // Пакет err.message может содержать BOT_TOKEN если Telegram кинул
    // 401 с URL в стеке — log on server, отдаём generic.
    console.error("[mini/_smoke] getMe failed:", result.message);
    return { ok: false, latencyMs, detail: "telegram check failed" };
  } catch (err) {
    console.error("[mini/_smoke] getMe threw:", err);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      detail: "telegram check failed",
    };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = process.env.CRON_SECRET || "";
  if (!secret || searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const totalStart = Date.now();
  const [dbResult, telegramResult] = await Promise.all([
    checkDb(),
    checkTelegram(),
  ]);

  const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "unknown";
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || "unknown";

  const allOk = dbResult.ok && telegramResult.ok;
  const totalLatencyMs = Date.now() - totalStart;

  const payload = {
    ok: allOk,
    checks: {
      db: dbResult,
      telegram: telegramResult,
      build: {
        id: buildId,
        time: buildTime,
      },
    },
    latencyMs: totalLatencyMs,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status: allOk ? 200 : 503,
    // Hint для прокси/uptime-чекеров: ответ uniqueный, не кэшировать.
    headers: { "Cache-Control": "no-store" },
  });
}
