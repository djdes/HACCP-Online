import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Сколько держим историю печати. */
const HISTORY_KEEP_DAYS = 60;

/** Через сколько незабранное задание считаем протухшим. */
const PENDING_EXPIRE_HOURS = 24;

/**
 * GET /api/cron/print-cleanup — уборка очереди печати.
 *
 * Два разных случая. Старая история печати просто копится и в какой-то
 * момент перестаёт быть историей — её чистим по сроку. А вот задание,
 * которое сутки провисело в очереди, уже бессмысленно: журнал за это
 * время изменился, и печатать его версию суточной давности при проверке
 * хуже, чем не печатать вовсе. Такие отменяем, а не печатаем задним
 * числом.
 */
export async function GET(request: Request) {
  const authError = checkCronSecret(request);
  if (authError) return authError;

  const now = Date.now();

  const [expired, purged] = await Promise.all([
    db.printJob.updateMany({
      where: {
        status: "pending",
        createdAt: {
          lt: new Date(now - PENDING_EXPIRE_HOURS * 60 * 60 * 1000),
        },
      },
      data: {
        status: "cancelled",
        errorMsg: "Задание протухло — принтер сутки был не на связи",
      },
    }),
    db.printJob.deleteMany({
      where: {
        status: { in: ["done", "error", "cancelled"] },
        createdAt: {
          lt: new Date(now - HISTORY_KEEP_DAYS * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    expired: expired.count,
    purged: purged.count,
  });
}
