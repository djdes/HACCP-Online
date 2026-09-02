import { NextResponse } from "next/server";

import { checkCronSecret } from "@/lib/cron-auth";
import { closeMonth } from "@/lib/partners/accruals";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Закрытие партнёрского месяца: всё «начислено» за прошлый месяц и раньше
 * становится «к выплате». Идемпотентно — повторный запуск ничего не сдвинет.
 *
 * INFRA: cron 1-го числа каждого месяца, 00:10 MSK:
 *   10 0 1 * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://wesetup.ru/api/cron/partner-month-close
 */
async function handle(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;
  try {
    const result = await closeMonth();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;
