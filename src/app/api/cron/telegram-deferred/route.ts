import { NextResponse } from "next/server";

import { checkCronSecret } from "@/lib/cron-auth";
import { sendDeferredTelegramLogs } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Крон каждые 5 минут: отправить сообщения, отложенные тихими часами, у которых время вышло. */
async function handle(request: Request) {
  const denied = checkCronSecret(request);
  if (denied) return denied;
  const result = await sendDeferredTelegramLogs(new Date());
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
