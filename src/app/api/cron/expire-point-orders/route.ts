import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/platform-alerts";
import { expireStalePointOrders } from "@/lib/balance/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/expire-point-orders?secret=$CRON_SECRET
 *
 * Возвращает баллы по заказам, которые провисели неоплаченными дольше
 * суток. Это страховка: обычно холд снимается раньше — при оформлении
 * следующего заказа той же организацией.
 *
 * Порог на час больше, чем `ExpirationDate` у ссылки Робокассы, чтобы
 * оплата в последнюю минуту не пересеклась с возвратом баллов.
 * Дёргается каждые 10 минут внешним планировщиком. Идемпотентно.
 */
async function handle(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;

  try {
    const result = await expireStalePointOrders();
    await recordCronRun({ job: "expire-point-orders", ok: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordCronRun({ job: "expire-point-orders", ok: false, error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
