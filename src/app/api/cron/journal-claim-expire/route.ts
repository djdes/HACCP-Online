import { NextResponse } from "next/server";
import { expireStaleClaims } from "@/lib/journal-task-claims";

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
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireStaleClaims(4);
  return NextResponse.json({ ok: true, expired });
}

export const GET = handle;
export const POST = handle;
