import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Публичный health-endpoint для UptimeRobot / cron-job.org / любого
 * внешнего monitor'а. Без auth — только проверка живости + БД.
 *
 * Возвращает:
 *   200 { ok: true, db: "ok", version, uptime }  — всё хорошо
 *   503 { ok: false, db: "fail", ... }            — БД недоступна
 *
 * НЕ заменяет /api/external/healthz который проверяет integrations
 * (token-auth required).
 */
const startedAt = Date.now();

export async function GET() {
  let dbOk = true;
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbOk = false;
  }

  // Читаем `.build-sha` файл (пишется в deploy.yml на проде).
  // Через env BUILD_SHA — fallback для контейнерных деплоев.
  let buildSha = process.env.BUILD_SHA ?? "unknown";
  try {
    const fileSha = (await readFile(".build-sha", "utf-8")).trim().slice(0, 7);
    if (fileSha) buildSha = fileSha;
  } catch {
    /* file not present — keep env fallback */
  }
  const uptimeSec = Math.round((Date.now() - startedAt) / 1000);

  const status = dbOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dbOk,
      db: dbOk ? "ok" : "fail",
      dbLatencyMs,
      buildSha,
      uptimeSec,
      now: new Date().toISOString(),
    },
    { status }
  );
}
