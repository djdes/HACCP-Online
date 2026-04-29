import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/auto-pause-inactive?secret=$CRON_SECRET
 *
 * Раз в неделю смотрит на org'и без активности (никаких журнальных
 * entries) за последние 30 дней → переводит subscriptionPlan на
 * "paused". Пишем audit-log так что владелец видит почему отключилось.
 *
 * Зачем: ресторан закрылся / на ремонте — мы не должны автоматически
 * биллить. Менеджер может в /settings/subscription включить обратно.
 *
 * НЕ автоматически меняет на trial/free — оставляем на менеджере.
 *
 * INFRA NEXT: cron еженедельно (например, понедельник 05:00 MSK).
 */
const INACTIVITY_DAYS = 30;
const PROTECTED_PLANS = ["paused", "cancelled"]; // не двигаем

async function handle(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;
  const cutoff = new Date(
    Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000
  );

  const orgs = await db.organization.findMany({
    where: {
      subscriptionPlan: { notIn: PROTECTED_PLANS },
    },
    select: {
      id: true,
      name: true,
      subscriptionPlan: true,
    },
  });

  let paused = 0;
  const results: Array<{ orgId: string; name: string; oldPlan: string }> = [];

  for (const org of orgs) {
    const lastFieldEntry = await db.journalEntry.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastDocEntry = await db.journalDocumentEntry.findFirst({
      where: { document: { organizationId: org.id } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastActivity =
      [lastFieldEntry?.createdAt, lastDocEntry?.createdAt]
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    if (lastActivity && lastActivity > cutoff) continue;

    // Pause.
    await db.organization.update({
      where: { id: org.id },
      data: { subscriptionPlan: "paused" },
    });
    await db.auditLog.create({
      data: {
        organizationId: org.id,
        action: "subscription.auto_paused",
        entity: "organization",
        entityId: org.id,
        details: {
          reason: `Нет активности > ${INACTIVITY_DAYS} дней`,
          lastActivity: lastActivity?.toISOString() ?? null,
          previousPlan: org.subscriptionPlan,
        },
      },
    });
    paused += 1;
    results.push({
      orgId: org.id,
      name: org.name,
      oldPlan: org.subscriptionPlan,
    });
  }

  return NextResponse.json({
    ok: true,
    organizationsScanned: orgs.length,
    paused,
    cutoff: cutoff.toISOString(),
    results,
  });
}

export const GET = handle;
export const POST = handle;
