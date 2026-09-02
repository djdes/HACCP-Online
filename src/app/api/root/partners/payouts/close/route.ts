import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { closeMonth } from "@/lib/partners/accruals";
import { readJson } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { period?: "YYYY-MM" } — ручное закрытие месяца (обычно это делает cron 1-го числа). */
export async function POST(request: Request) {
  await requireRoot();
  const body = await readJson<{ period?: unknown }>(request);
  try {
    const result = await closeMonth(typeof body.period === "string" && body.period ? body.period : undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
