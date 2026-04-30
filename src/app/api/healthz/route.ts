import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/healthz
 *
 * Внутренний health-check для мониторинга прода. Возвращает 200 OK
 * с JSON-ом, если все критичные подсистемы отвечают, иначе 503.
 *
 * Проверяет:
 *   - DB: `SELECT 1` через Prisma
 *   - Telegram bot: getMe (если TELEGRAM_BOT_TOKEN настроен)
 *   - Build SHA из process.env.BUILD_SHA или .build-sha
 *
 * Использовать в:
 *   - Внешний uptime-мониторинг (UptimeRobot, BetterStack) — пингует
 *     раз в минуту на https://wesetup.ru/api/healthz
 *   - PM2 healthchecks
 *   - Docker HEALTHCHECK (если в будущем будет контейнер)
 *
 * Без авторизации (read-only). Чтобы предотвратить злоупотребление —
 * cache-control: no-cache + лёгкие запросы.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: Record<
    string,
    { ok: boolean; ms: number; detail?: string; error?: string }
  > = {};

  // 1. DB ping
  {
    const t0 = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      checks.db = { ok: true, ms: Date.now() - t0 };
    } catch (err) {
      // Public endpoint — error.message от Prisma может включать
      // host/port БД, имена таблиц, причины auth-failure → recon.
      // Логируем server-side, отдаём generic.
      console.error("[healthz] db check failed", err);
      checks.db = {
        ok: false,
        ms: Date.now() - t0,
        error: "db unavailable",
      };
    }
  }

  // 2. Telegram bot getMe (если токен есть)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const t0 = Date.now();
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
        { signal: AbortSignal.timeout(3000) }
      );
      const data = (await r.json()) as { ok: boolean; result?: { username?: string } };
      checks.telegram = {
        ok: data.ok === true,
        ms: Date.now() - t0,
        detail: data.result?.username ? `@${data.result.username}` : undefined,
      };
    } catch (err) {
      console.error("[healthz] telegram check failed", err);
      checks.telegram = {
        ok: false,
        ms: Date.now() - t0,
        error: "telegram unreachable",
      };
    }
  } else {
    checks.telegram = { ok: true, ms: 0, detail: "skipped (no token)" };
  }

  // 3. Build SHA
  const buildSha =
    process.env.BUILD_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? null;
  const buildTime =
    process.env.BUILD_TIME ?? process.env.NEXT_PUBLIC_BUILD_TIME ?? null;

  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      uptimeSec: Math.round(process.uptime()),
      totalMs: Date.now() - startedAt,
      buildSha,
      buildTime,
      checks,
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    }
  );
}
