import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasksflowClientFor, TasksFlowError } from "@/lib/tasksflow-client";
import { checkCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/tasksflow-cleanup-old
 *
 * Cron: ежедневно в 03:00. Удаляет в TasksFlow задачи которые завершены
 * более 30 дней назад. Реализует П-16 спека 2026-05-09:
 *
 *   "Wesetup управляет: cron в 03:00 ежедневно удаляет в TF задачи
 *    remoteStatus IN ('done','verified','claimed_by_other') AND
 *    completedAt < NOW() - INTERVAL '30 days'.
 *    Compliance-данные (JournalDocumentEntry) остаются навсегда."
 *
 * Зачем: TF лента задач у уборщика разрастается без bound, через год
 * у активного worker'а будут тысячи закрытых задач. Wesetup владеет
 * lifecycle (создаёт + удаляет) — П-13. JournalDocumentEntry с фото и
 * compliance-логом не трогаем — это другая БД-сущность.
 *
 * Sync-подход (не через outbox): batch retention, latency не критична,
 * 100 строк × 200ms = 20s максимум. При недоставленных — оставляем
 * TaskLink в DB, следующий cron-tick (через сутки) повторит.
 *
 * Limit 100 строк за запуск — защита от долгих циклов и таймаутов.
 *
 * Auth: Bearer CRON_SECRET через checkCronSecret().
 */
export async function GET(request: Request) {
  const authError = checkCronSecret(request);
  if (authError) return authError;

  const RETENTION_DAYS = 30;
  const BATCH_LIMIT = 100;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db.tasksFlowTaskLink.findMany({
    where: {
      // remoteStatus 'completed' — единственный записываемый сейчас (Phase 1).
      // 'claimed_by_other' появится в Phase 2.1 после правок в TF — поэтому
      // включаем заранее, чтобы cron'у не понадобились правки тогда.
      remoteStatus: { in: ["completed", "claimed_by_other"] },
      completedAt: { lt: cutoff },
    },
    take: BATCH_LIMIT,
    orderBy: { completedAt: "asc" },
    include: { integration: true },
  });

  if (stale.length === 0) {
    return NextResponse.json({
      ok: true,
      scanned: 0,
      deleted: 0,
      errors: 0,
      cutoff: cutoff.toISOString(),
    });
  }

  let deleted = 0;
  let errors = 0;
  let alreadyGone = 0;
  let skippedDisabled = 0;
  const errorSamples: Array<{ linkId: string; reason: string }> = [];

  for (const link of stale) {
    if (!link.integration.enabled) {
      // Integration отключён — пропускаем, не удаляем link (вдруг включат
      // обратно). При длинной паузе link будет в pending bucket навсегда —
      // это OK, retention-cron не строгий.
      skippedDisabled += 1;
      continue;
    }

    const client = tasksflowClientFor(link.integration);
    let deletedRemotely = false;

    try {
      await client.deleteTask(link.tasksflowTaskId, {
        idempotencyKey: `cleanup::${link.id}`,
      });
      deletedRemotely = true;
    } catch (err) {
      if (
        err instanceof TasksFlowError &&
        (err.status === 404 || err.status === 410)
      ) {
        // Задача уже удалена в TF — наш link мог отстать от реальности.
        // Считаем deletion успешной, удалим local-link ниже.
        alreadyGone += 1;
        deletedRemotely = true;
      } else {
        errors += 1;
        const reason =
          err instanceof TasksFlowError
            ? `${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "unknown";
        if (errorSamples.length < 10) {
          errorSamples.push({ linkId: link.id, reason });
        }
        // Не удаляем local-link — следующий cron-tick попробует снова.
        continue;
      }
    }

    if (deletedRemotely) {
      // TF задача удалена (или уже отсутствовала) — убираем local-link.
      // Это безопасно: TasksFlowTaskLink — это только связка для sync,
      // compliance-данные живут в JournalDocumentEntry и не трогаются.
      await db.tasksFlowTaskLink
        .delete({ where: { id: link.id } })
        .catch((err) => {
          // P2025 (запись уже удалена) — гонка с другим cron-tick'ом, ОК.
          console.warn(
            `[cleanup-old] local-link delete failed link=${link.id}`,
            err,
          );
        });
      deleted += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stale.length,
    deleted,
    errors,
    alreadyGone,
    skippedDisabled,
    cutoff: cutoff.toISOString(),
    errorSamples: errorSamples.length > 0 ? errorSamples : undefined,
  });
}
