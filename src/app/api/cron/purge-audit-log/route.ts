import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/purge-audit-log?secret=$CRON_SECRET
 *
 * Раз в день удаляет AuditLog-записи старше `RETENTION_DAYS`
 * (по умолчанию 90). Для compliance ХАССП требуется хранить минимум
 * 30 дней. Нам нет смысла держать миллионы записей — лог растёт
 * бесконечно от cron'ов и автоматизаций.
 *
 * Сохраняем особо ценные действия (impersonate, override, deletion)
 * дольше — те держим 365 дней.
 *
 * INFRA NEXT: cron 03:30 MSK ежедневно.
 */
const RETENTION_DAYS = 90;
const CRITICAL_RETENTION_DAYS = 365;
const CRITICAL_ACTIONS = [
  "impersonate.start",
  "impersonate.stop",
  "closed_day.override",
  "offboarding.complete",
  "user.first_login",
  "1c_losses_export.sent",
  "yandex_backup.success",
  "yandex_backup.failed",
];

async function handle(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoffNormal = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const cutoffCritical = new Date(
    Date.now() - CRITICAL_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  // Удаляем обычные старше 90 дней.
  const normalDeleted = await db.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffNormal },
      action: { notIn: CRITICAL_ACTIONS },
    },
  });

  // Удаляем критичные старше 365 дней.
  const criticalDeleted = await db.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffCritical },
      action: { in: CRITICAL_ACTIONS },
    },
  });

  return NextResponse.json({
    ok: true,
    normalDeleted: normalDeleted.count,
    criticalDeleted: criticalDeleted.count,
    cutoffNormal: cutoffNormal.toISOString(),
    cutoffCritical: cutoffCritical.toISOString(),
  });
}

export const GET = handle;
export const POST = handle;
