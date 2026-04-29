import { NextResponse } from "next/server";
import { expireStaleClaims } from "@/lib/journal-task-claims";
import { checkCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron — раз в час: помечает active claims, висящие > 4 часов
 * без завершения, как expired. Освобождает scope для повторного
 * взятия другим сотрудником.
 *
 * Реальный сценарий: сотрудник взял задачу, началась смена в баре,
 * забыл закрыть, ушёл со смены. Без auto-expire коллеге пришлось бы
 * руками сбрасывать через DELETE endpoint.
 *
 * Cadence: hourly. CRON_SECRET в query.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  {
    const cronAuth = checkCronSecret(request);
    if (cronAuth) return cronAuth;
  }
  const expired = await expireStaleClaims(4);
  return NextResponse.json({ ok: true, expired });
}

export const GET = handle;
export const POST = handle;
