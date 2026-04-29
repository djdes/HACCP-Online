import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import {
  TasksFlowError,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/tasksflow/cleanup-pending
 *
 * Удаляет в TasksFlow все НЕвыполненные задачи, привязанные к этой
 * организации (через TasksFlowTaskLink). Полезно когда:
 *   • Тестировали и насоздавали мусор
 *   • Поменялись ответственные и старые задачи стали неактуальны
 *   • Просто хочется начать заполнение журналов с чистого листа
 *
 * Логика:
 *   1. Берём все TasksFlowTaskLink для интеграции, у которых
 *      remoteStatus != "completed".
 *   2. Для каждого DELETE /api/tasks/:id на TF.
 *   3. Локальный TasksFlowTaskLink удаляем при любом исходе кроме
 *      400/404 (которые означают «задача уже удалена в TF»).
 *
 * Не трогает:
 *   • Задачи без TasksFlowTaskLink (созданные вручную в TF, не через
 *     bulk-assign — мы про них не знаем).
 *   • Уже выполненные (remoteStatus = "completed") — они нужны для
 *     compliance-истории.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !hasFullWorkspaceAccess({
      role: session.user.role,
      isRoot: session.user.isRoot,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);

  const integration = await db.tasksFlowIntegration.findFirst({
    where: { organizationId, enabled: true },
  });
  if (!integration) {
    return NextResponse.json(
      { error: "Интеграция с TasksFlow не настроена" },
      { status: 400 }
    );
  }

  const pendingLinks = await db.tasksFlowTaskLink.findMany({
    where: {
      integrationId: integration.id,
      remoteStatus: { not: "completed" },
    },
    select: {
      id: true,
      tasksflowTaskId: true,
      journalCode: true,
      rowKey: true,
    },
  });

  if (pendingLinks.length === 0) {
    return NextResponse.json({
      ok: true,
      deletedTfTasks: 0,
      removedLocalLinks: 0,
      message: "Нет невыполненных задач — TasksFlow уже чистый",
    });
  }

  const client = tasksflowClientFor(integration);

  let deletedTfTasks = 0;
  let removedLocalLinks = 0;
  let alreadyGone = 0;
  const errors: string[] = [];

  for (const link of pendingLinks) {
    try {
      await client.deleteTask(link.tasksflowTaskId);
      deletedTfTasks += 1;
    } catch (err) {
      // 404/410 — задача уже удалена в TF: чистим локальный link.
      if (
        err instanceof TasksFlowError &&
        (err.status === 404 || err.status === 410 || err.status === 400)
      ) {
        alreadyGone += 1;
      } else {
        errors.push(
          `${link.journalCode}/${link.rowKey}: ${err instanceof Error ? err.message : "unknown"}`
        );
        // Не удаляем локальный link, чтобы можно было повторить попытку.
        continue;
      }
    }
    await db.tasksFlowTaskLink
      .delete({ where: { id: link.id } })
      .then(() => {
        removedLocalLinks += 1;
      })
      .catch(() => {
        /* race с другим cleanup'ом — игнорируем */
      });
  }

  await db.auditLog.create({
    data: {
      organizationId,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? null,
      action: "tasksflow.cleanup_pending",
      entity: "TasksFlowTaskLink",
      entityId: integration.id,
      details: {
        deletedTfTasks,
        removedLocalLinks,
        alreadyGone,
        errorsCount: errors.length,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    deletedTfTasks,
    removedLocalLinks,
    alreadyGone,
    errors: errors.slice(0, 10),
    errorsTotal: errors.length,
  });
}
