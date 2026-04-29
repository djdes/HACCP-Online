import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/reset-ai-quota?secret=$CRON_SECRET
 *
 * Сбрасывает aiMonthlyMessagesLeft на aiMonthlyQuota для всех org.
 * Дёргается 1-го числа каждого месяца внешним шедулером.
 *
 * Идемпотентно — повторный вызов в тот же день безопасен.
 */
async function handle(request: Request) {
  {
    const cronAuth = checkCronSecret(request);
    if (cronAuth) return cronAuth;
  }

  // Reset для всех org разом — устанавливаем left = quota.
  // Для unlimited (quota < 0) тоже устанавливаем — обнуление не страшно.
  const orgs = await db.organization.findMany({
    select: { id: true, aiMonthlyQuota: true },
  });

  let updated = 0;
  for (const org of orgs) {
    await db.organization.update({
      where: { id: org.id },
      data: { aiMonthlyMessagesLeft: org.aiMonthlyQuota },
    });
    updated += 1;
  }

  return NextResponse.json({ ok: true, organizationsReset: updated });
}

export const GET = handle;
export const POST = handle;
