import { NextResponse, type NextRequest } from "next/server";
import { syncSensorReadingsForAllOrganizations } from "@/lib/sensor-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/sensor-sync?secret=<CRON_SECRET>
 *
 * Один прогон по всем organisations + всем активным
 * EquipmentSensorMapping. Тянет свежие значения с Tuya и обновляет
 * `lastReadingAt / lastValue`. Идёт по device-cache, чтобы не дёргать
 * одно физическое устройство несколько раз.
 *
 * Cron schedule пока не настроен — endpoint можно дёргать вручную
 * curl-ом для smoke-test'а перед UI (шаг 2.4). Реальный планировщик
 * (Vercel cron / GitHub action / pm2 cron-process) подключается
 * в шаге 2.5 вместе с failover-логикой.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (!CRON_SECRET || url.searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const reports = await syncSensorReadingsForAllOrganizations(new Date());

  const summary = reports.reduce(
    (acc, r) => {
      acc.mappingsTotal += r.mappingsTotal;
      acc.fresh += r.fresh;
      acc.failed += r.failed;
      return acc;
    },
    { mappingsTotal: 0, fresh: 0, failed: 0 }
  );

  return NextResponse.json({ ok: true, summary, reports });
}
