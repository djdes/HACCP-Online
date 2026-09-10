import { NextResponse } from "next/server";

import { checkCronSecret } from "@/lib/cron-auth";
import { deliverDue } from "@/lib/webhooks/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Крон раз в минуту: отправить доставки вебхуков, которым пришло время (включая повторы). */
async function handle(request: Request) {
  const denied = checkCronSecret(request);
  if (denied) return denied;
  const results = await deliverDue();
  return NextResponse.json({ ok: true, delivered: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
}

export const GET = handle;
export const POST = handle;
