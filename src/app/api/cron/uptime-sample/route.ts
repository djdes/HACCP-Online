import { NextResponse } from "next/server";

import { checkCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { getInboundBot } from "@/lib/bot/bot-app";
import { takeUptimeSample } from "@/lib/uptime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Крон раз в 5 минут: замер базы и Telegram-бота в историю аптайма. */
async function handle(request: Request) {
  const denied = checkCronSecret(request);
  if (denied) return denied;
  let dbMs: number | null = null;
  let dbOk = false;
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbMs = Date.now() - t0;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  let telegramOk = false;
  try {
    const bot = getInboundBot();
    const me = bot ? await Promise.race([bot.api.getMe(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))]) : null;
    telegramOk = Boolean(me);
  } catch {
    telegramOk = false;
  }
  await takeUptimeSample({ ok: dbOk, dbMs, telegramOk });
  return NextResponse.json({ ok: dbOk, dbMs, telegramOk, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
