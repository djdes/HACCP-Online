import { db } from "@/lib/db";
import {
  tasksflowClientFor,
  TasksFlowError,
} from "@/lib/tasksflow-client";

/**
 * Bi-directional bridge между WeSetup `JournalTaskClaim` и TasksFlow.
 *
 * Поток:
 *   1. Existing tasksflow-adapters (cleaningAdapter и др.) создают TF
 *      tasks через /api/integrations/tasksflow/sync-tasks для активных
 *      журналов организации. Каждый TF-task связан с rowKey, который
 *      совпадает с нашим JournalTaskClaim.scopeKey.
 *   2. Когда сотрудник в WeSetup mini-app делает claim — мы находим
 *      существующий TasksFlowTaskLink по rowKey=scopeKey, делаем
 *      updateTask({ workerId }) в TF: TF теперь знает кто конкретно
 *      выполняет.
 *   3. При complete — POST completeTask в TF.
 *   4. При release — updateTask(workerId=null) или просто оставляем как
 *      есть (worker может прийти и взять снова).
 *
 * Inbound (из TF в WeSetup) уже работает через /api/integrations/
 * tasksflow/complete handler — нам нужно только дополнить его, чтобы
 * он также обновлял JournalTaskClaim status=completed.
 */

type ClaimMirrorEvent = "claim" | "release" | "complete";

/**
 * Зеркалит изменение состояния claim'а в TasksFlow. Безопасно
 * вызывать когда integration отключён или taskLink не существует —
 * graceful degrade без ошибок.
 *
 * Возвращает tasksFlowTaskId если был обновлён (для записи в claim).
 */
export async function mirrorClaimToTasksFlow(args: {
  organizationId: string;
  journalCode: string;
  scopeKey: string;
  /** ID документа — используется для lookup'а TasksFlowTaskLink. */
  journalDocumentId?: string | null;
  userId: string;
  event: ClaimMirrorEvent;
}): Promise<{ tasksFlowTaskId?: number; mirrored: boolean; reason?: string }> {
  // 1. Активная TF integration?
  const integration = await db.tasksFlowIntegration.findFirst({
    where: { organizationId: args.organizationId, enabled: true },
  });
  if (!integration) return { mirrored: false, reason: "no_integration" };

  // 2. Линк по rowKey=scopeKey?
  const link = args.journalDocumentId
    ? await db.tasksFlowTaskLink.findFirst({
        where: {
          integrationId: integration.id,
          journalCode: args.journalCode,
          journalDocumentId: args.journalDocumentId,
          rowKey: args.scopeKey,
        },
      })
    : await db.tasksFlowTaskLink.findFirst({
        where: {
          integrationId: integration.id,
          journalCode: args.journalCode,
          rowKey: args.scopeKey,
        },
      });
  if (!link) return { mirrored: false, reason: "no_link" };

  // 3. Mapped TF user?
  const userLink = await db.tasksFlowUserLink.findFirst({
    where: { integrationId: integration.id, wesetupUserId: args.userId },
    select: { tasksflowUserId: true },
  });

  const client = tasksflowClientFor(integration);

  try {
    if (args.event === "claim") {
      if (!userLink?.tasksflowUserId) {
        return { mirrored: false, reason: "no_tf_user_link" };
      }
      // Переназначаем TF-task на этого worker'а.
      await client.updateTask(link.tasksflowTaskId, {
        workerId: userLink.tasksflowUserId,
      });
      await db.tasksFlowTaskLink.update({
        where: { id: link.id },
        data: { lastDirection: "push" },
      });
      return { tasksFlowTaskId: link.tasksflowTaskId, mirrored: true };
    }

    if (args.event === "complete") {
      await client.completeTask(link.tasksflowTaskId);
      await db.tasksFlowTaskLink.update({
        where: { id: link.id },
        data: {
          remoteStatus: "completed",
          completedAt: new Date(),
          lastDirection: "push",
        },
      });
      return { tasksFlowTaskId: link.tasksflowTaskId, mirrored: true };
    }

    if (args.event === "release") {
      // Reopen — uncomplete на стороне TF (если был complete) или просто
      // ничего не делаем. Намеренно не очищаем workerId — другой
      // сотрудник может claim'нуть и переназначить.
      await db.tasksFlowTaskLink.update({
        where: { id: link.id },
        data: { lastDirection: "push" },
      });
      return { tasksFlowTaskId: link.tasksflowTaskId, mirrored: true };
    }
  } catch (err) {
    const status = err instanceof TasksFlowError ? err.status : 0;
    console.error(`[tasksflow-mirror] ${args.event} failed (${status}):`, err);
    return { mirrored: false, reason: `tf_error_${status}` };
  }

  return { mirrored: false, reason: "noop" };
}

/**
 * Inbound side: вызывается из /api/integrations/tasksflow/complete после
 * adapter.applyRemoteCompletion. Если у нас есть JournalTaskClaim с тем
 * же scopeKey за сегодня — обновляем status=completed.
 *
 * Это покрывает случай: сотрудник нажал "Готово" в TF Telegram бот —
 * мы видим это в WeSetup mini-app сразу же.
 */
export async function syncTasksFlowCompletionToClaim(args: {
  organizationId: string;
  journalCode: string;
  scopeKey: string;
  isCompleted: boolean;
  tasksFlowTaskId: number;
}): Promise<{ updated: boolean; claimId?: string }> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const claim = await db.journalTaskClaim.findFirst({
    where: {
      organizationId: args.organizationId,
      journalCode: args.journalCode,
      scopeKey: args.scopeKey,
      status: { in: ["active", "pending"] },
    },
  });
  if (!claim) return { updated: false };

  if (args.isCompleted) {
    await db.journalTaskClaim.update({
      where: { id: claim.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        tasksFlowTaskId: String(args.tasksFlowTaskId),
      },
    });
    return { updated: true, claimId: claim.id };
  }
  // isCompleted=false → реоткрытие (TF uncomplete). Возвращаем active.
  await db.journalTaskClaim.update({
    where: { id: claim.id },
    data: {
      status: "active",
      completedAt: null,
    },
  });
  return { updated: true, claimId: claim.id };
}
