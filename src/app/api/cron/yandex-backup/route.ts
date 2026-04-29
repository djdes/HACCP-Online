import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import { buildOrgBackup } from "@/lib/org-backup";
import { uploadJson, YandexDiskError } from "@/lib/yandex-disk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/yandex-backup?secret=$CRON_SECRET
 *
 * Раз в неделю (рекомендуется понедельник 03:00 MSK) для каждой
 * организации с подключённым Я.Диском генерим JSON-дамп журналов за
 * последние 7 дней и заливаем на /WeSetup/backup-YYYY-MM-DD.json.
 *
 * Идемпотентно: повторный вызов в тот же день перезаписывает файл
 * с тем же именем (overwrite=true). Если у org токен невалидный —
 * пишем в AuditLog kind=yandex_backup.failed, чтобы было видно в
 * /settings/audit и в /settings/yandex-backup странице.
 *
 * INFRA NEXT: добавить в внешний cron-job.org weekly trigger,
 * Mon 03:00 MSK (UTC+3 = 00:00 UTC).
 */
async function handle(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;
  const orgs = await db.organization.findMany({
    where: { yandexDiskToken: { not: null } },
    select: {
      id: true,
      name: true,
      yandexDiskToken: true,
      yandexDiskFolder: true,
    },
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateStr = now.toISOString().slice(0, 10);

  const results: Array<{
    organizationId: string;
    organizationName: string;
    status: "ok" | "failed";
    path?: string;
    sizeBytes?: number;
    error?: string;
  }> = [];

  for (const org of orgs) {
    if (!org.yandexDiskToken) continue;
    try {
      const data = await buildOrgBackup(org.id, weekAgo, now);
      const filename = `wesetup-backup-${dateStr}.json`;
      const upload = await uploadJson(
        org.yandexDiskToken,
        org.yandexDiskFolder ?? "/WeSetup",
        filename,
        data
      );

      await db.organization.update({
        where: { id: org.id },
        data: { yandexDiskLastBackupAt: now },
      });

      await db.auditLog.create({
        data: {
          organizationId: org.id,
          action: "yandex_backup.success",
          entity: "yandex_backup",
          details: {
            path: upload.path,
            sizeBytes: upload.sizeBytes,
            humanSize: `${Math.round(upload.sizeBytes / 1024)} КБ`,
          },
        },
      });

      results.push({
        organizationId: org.id,
        organizationName: org.name,
        status: "ok",
        path: upload.path,
        sizeBytes: upload.sizeBytes,
      });
    } catch (err) {
      const reason =
        err instanceof YandexDiskError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Неизвестная ошибка";
      await db.auditLog.create({
        data: {
          organizationId: org.id,
          action: "yandex_backup.failed",
          entity: "yandex_backup",
          details: { error: reason },
        },
      });
      results.push({
        organizationId: org.id,
        organizationName: org.name,
        status: "failed",
        error: reason,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    organizationsProcessed: orgs.length,
    successful: results.filter((r) => r.status === "ok").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}

export const GET = handle;
export const POST = handle;
