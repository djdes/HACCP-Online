import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureTasksflowUserLinks } from "@/lib/tasksflow-ensure-links";
import { checkCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/tasksflow-autolink-retry
 *
 * Реализует П-8 спека 2026-05-09: «Связка аккаунтов — авто по номеру.
 * Старые аккаунты без номера могут быть «подружены» позже —
 * управляющая просто добавляет им номер.»
 *
 * Cron каждый час: для каждой активной TasksFlowIntegration вызывает
 * ensureTasksflowUserLinks, которая:
 *   1. Берёт всех Wesetup-юзеров организации с phone.
 *   2. Сравнивает с TF /api/users.
 *   3. Создаёт TasksFlowUserLink для совпадений по phone.
 *   4. Создаёт TF-юзера если phone есть в Wesetup но нет в TF.
 *
 * Зачем cron, а не только on-create:
 * - Управляющая добавила номер существующему юзеру (на форме редактирования)
 *   — на стороне users/[id]/route.ts уже есть autolink, но если TF был
 *   недоступен — связь не создалась. Этот cron подхватит при следующем
 *   запуске.
 * - TF-юзер был создан после Wesetup-юзера (например, через приглашение
 *   в TF) — autolink при create на стороне Wesetup не нашёл TF-юзера,
 *   но через час cron его уже видит.
 * - Существующие orgs которые включают TF integration впервые — все их
 *   старые юзеры с phone сразу получат TF-аккаунты и линк.
 *
 * Idempotent: ensureTasksflowUserLinks использует findFirst+upsert
 * паттерн, повторный вызов — no-op для уже-связанных юзеров.
 *
 * Auth: Bearer CRON_SECRET через checkCronSecret().
 */
export async function GET(request: Request) {
  const authError = checkCronSecret(request);
  if (authError) return authError;

  const ORG_BATCH_LIMIT = 50;

  const integrations = await db.tasksFlowIntegration.findMany({
    where: { enabled: true },
    select: {
      id: true,
      baseUrl: true,
      apiKeyEncrypted: true,
      enabled: true,
      organizationId: true,
    },
    take: ORG_BATCH_LIMIT,
  });

  if (integrations.length === 0) {
    return NextResponse.json({
      ok: true,
      orgsScanned: 0,
      created: 0,
      linked: 0,
      withoutPhone: 0,
      failures: 0,
    });
  }

  let totalCreated = 0;
  let totalLinked = 0;
  let totalWithoutPhone = 0;
  let totalFailures = 0;
  const orgErrors: Array<{ organizationId: string; reason: string }> = [];

  for (const integration of integrations) {
    try {
      const summary = await ensureTasksflowUserLinks({
        organizationId: integration.organizationId,
        integration: {
          id: integration.id,
          baseUrl: integration.baseUrl,
          apiKeyEncrypted: integration.apiKeyEncrypted,
          enabled: integration.enabled,
        },
      });
      totalCreated += summary.created;
      totalLinked += summary.linked;
      totalWithoutPhone += summary.withoutPhone;
      totalFailures += summary.failures;
    } catch (err) {
      totalFailures += 1;
      const reason = err instanceof Error ? err.message : "unknown";
      if (orgErrors.length < 10) {
        orgErrors.push({
          organizationId: integration.organizationId,
          reason,
        });
      }
      console.error(
        `[tasksflow-autolink-retry] org=${integration.organizationId} failed:`,
        err,
      );
    }
  }

  if (totalCreated > 0 || totalLinked > 0) {
    console.info(
      `[tasksflow-autolink-retry] orgs=${integrations.length} created=${totalCreated} linked=${totalLinked} withoutPhone=${totalWithoutPhone} failures=${totalFailures}`,
    );
  }

  return NextResponse.json({
    ok: true,
    orgsScanned: integrations.length,
    created: totalCreated,
    linked: totalLinked,
    withoutPhone: totalWithoutPhone,
    failures: totalFailures,
    orgErrors: orgErrors.length > 0 ? orgErrors : undefined,
  });
}
