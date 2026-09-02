import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import { deleteDemoOrganization } from "@/lib/demo-organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/purge-demo-orgs
 *
 * Удаляет демо-организации, у которых вышел срок (`demoExpiresAt` в
 * прошлом). Cascade по Organization сносит сотрудников, документы и
 * записи. За один прогон — не больше BATCH штук: удаление одной
 * организации с записями за неделю занимает секунды, и мы не хотим
 * держать cron минуту, если демо накопилось много.
 *
 * Страховка без cron: `createDemoOrganization` сам удаляет протухшее
 * демо аккаунта перед созданием нового.
 *
 * INFRA NEXT: cron 03:20 ежедневно.
 */
const BATCH = 20;

async function handle(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;

  const now = new Date();
  const expired = await db.organization.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: now } },
    select: { id: true, name: true, accountId: true },
    orderBy: { demoExpiresAt: "asc" },
    take: BATCH,
  });

  // AuditLog требует organizationId — пишем в platform-org, чтобы запись
  // была видна ROOT'у на /root/audit. Если platform-org нет — пропускаем.
  const platformOrgId = (process.env.PLATFORM_ORG_ID ?? "").trim();
  const deleted: Array<{ id: string; name: string }> = [];

  for (const org of expired) {
    try {
      const counts = await deleteDemoOrganization(org.id);
      deleted.push({ id: org.id, name: org.name });
      if (platformOrgId) {
        await db.auditLog.create({
          data: {
            organizationId: platformOrgId,
            action: "org.demo.expired",
            entity: "organization",
            entityId: org.id,
            details: { name: org.name, accountId: org.accountId, ...counts },
          },
        });
      }
    } catch (error) {
      // Одно упавшее демо не должно останавливать остальные — их
      // подберёт следующий прогон.
      console.error("[purge-demo-orgs] failed", org.id, error);
    }
  }

  return NextResponse.json({
    ok: true,
    deleted: deleted.length,
    failed: expired.length - deleted.length,
    cutoff: now.toISOString(),
  });
}

export const GET = handle;
export const POST = handle;
