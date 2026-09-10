import { NextResponse } from "next/server";

import { checkCronSecret } from "@/lib/cron-auth";
import { purgeDueDeletions } from "@/lib/org-deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Крон раз в сутки: удалить организации, у которых истёк 30-дневный холд. */
async function handle(request: Request) {
  const denied = checkCronSecret(request);
  if (denied) return denied;
  const result = await purgeDueDeletions();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
