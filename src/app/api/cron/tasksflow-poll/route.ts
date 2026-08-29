import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pullCompletionsForOrganization } from "@/lib/tasksflow-sync";
import { checkCronSecret } from "@/lib/cron-auth";
import {
  FAIL_STREAK_ALERT_THRESHOLD,
  raisePlatformAlert,
  recordCronRun,
} from "@/lib/platform-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/tasksflow-poll
 *
 * Страховочный polling fallback (П-9 спека 2026-05-09):
 *
 *   "Sync TF → Wesetup — гибрид:
 *      1. Webhook (быстрый, 1-2 сек) — основной канал.
 *      2. Polling (страховочный, раз в 10 мин) — на случай если webhook
 *         потерялся. Ходит в TF API, догоняет потерянные события."
 *
 * Запускается по cron'у (через crontab) каждые 10 минут. Для каждой
 * активной TasksFlowIntegration вызывает pullCompletionsForOrganization
 * — она внутри:
 *   1. client.listTasks() для всей компании TF.
 *   2. Для каждой completed-задачи проверяет, есть ли соответствующая
 *      TasksFlowTaskLink с remoteStatus='active'.
 *   3. Если есть → adapter.applyRemoteCompletion + update link →
 *      запись в журнал догоняется. Race-siblings cleanup тоже стартанёт
 *      через webhook complete handler если он сработает (или через
 *      следующий polling tick).
 *
 * Важно: webhook handler (POST /api/integrations/tasksflow/complete)
 * имеет AuditLog dedup — если событие уже было обработано в течение
 * часа, polling вернёт no-op без двойной записи в журнал.
 *
 * Race-siblings cleanup: pullCompletionsForOrganization сейчас НЕ
 * вызывает markSiblingsAsClaimedByOther напрямую (siblings cleanup
 * работает только через webhook flow). Это OK для Phase 2.4 — main
 * recovery flow это journal-mark + claim sync. Phase 2.4-bis (отдельный
 * commit если понадобится) добавит siblings cleanup в pull-flow.
 *
 * Auth: Bearer CRON_SECRET через checkCronSecret().
 *
 * Ограничения:
 * - 50 организаций за один запуск (если orgs больше — обрабатываются в
 *   несколько cron-tick'ов).
 * - Per-org error не валит других — итогово возвращаем counts.
 */
export async function GET(request: Request) {
  const authError = checkCronSecret(request);
  if (authError) return authError;

  const ORG_BATCH_LIMIT = 50;

  const integrations = await db.tasksFlowIntegration.findMany({
    where: { enabled: true },
    select: { organizationId: true, id: true },
    take: ORG_BATCH_LIMIT,
  });

  if (integrations.length === 0) {
    return NextResponse.json({
      ok: true,
      orgsScanned: 0,
      checked: 0,
      newlyCompleted: 0,
      reopened: 0,
      errors: 0,
    });
  }

  let totalChecked = 0;
  let totalNewlyCompleted = 0;
  let totalReopened = 0;
  let totalErrors = 0;
  const orgErrors: Array<{ organizationId: string; reason: string }> = [];

  for (const integration of integrations) {
    try {
      const summary = await pullCompletionsForOrganization({
        organizationId: integration.organizationId,
      });
      totalChecked += summary.checked;
      totalNewlyCompleted += summary.newlyCompleted;
      totalReopened += summary.reopened;
      totalErrors += summary.errors;
    } catch (err) {
      totalErrors += 1;
      const reason = err instanceof Error ? err.message : "unknown";
      if (orgErrors.length < 10) {
        orgErrors.push({
          organizationId: integration.organizationId,
          reason,
        });
      }
      console.error(
        `[tasksflow-poll] org=${integration.organizationId} failed:`,
        err,
      );
    }
  }

  // Провалом считаем запуск, где НИ ОДНА организация не синхронизировалась,
  // хотя интеграции есть: одна упавшая организация — это её проблема
  // (отозванный токен, удалённая компания в TF), а не поломка канала.
  const runFailed = orgErrors.length > 0 && orgErrors.length === integrations.length;
  const streak = await recordCronRun({
    job: "tasksflow-poll",
    ok: !runFailed,
    error: runFailed ? orgErrors[0]?.reason : null,
  });

  // Со второго подряд провала: разовая сетевая ошибка чинится следующим
  // тиком через 10 минут, и будить из-за неё человека незачем.
  if (runFailed && streak >= FAIL_STREAK_ALERT_THRESHOLD) {
    await raisePlatformAlert({
      kind: "tasksflow-poll",
      dedupeKey: "down",
      text:
        `<b>TasksFlow: синхронизация не работает</b>\n` +
        `${streak} запуска подряд не смогли опросить ни одну из ` +
        `${integrations.length} организаций.\n` +
        `Причина: ${orgErrors[0]?.reason ?? "неизвестна"}\n` +
        `Статусы задач перестали приезжать в журналы.`,
    });
  }

  if (totalNewlyCompleted > 0 || totalReopened > 0) {
    console.info(
      `[tasksflow-poll] orgs=${integrations.length} checked=${totalChecked} newlyCompleted=${totalNewlyCompleted} reopened=${totalReopened} errors=${totalErrors}`,
    );
  }

  return NextResponse.json({
    ok: true,
    orgsScanned: integrations.length,
    checked: totalChecked,
    newlyCompleted: totalNewlyCompleted,
    reopened: totalReopened,
    errors: totalErrors,
    orgErrors: orgErrors.length > 0 ? orgErrors : undefined,
    failStreak: streak,
  });
}
