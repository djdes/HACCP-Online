import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  notifyEmployee,
  notifyOrganization,
  escapeTelegramHtml as esc,
} from "@/lib/telegram";
import { tasksflowClientFor, TasksFlowError } from "@/lib/tasksflow-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/tasksflow-escalations?secret=$CRON_SECRET
 *
 * Раз в 6 часов проходит по всем активным TasksFlowTaskLink:
 *   - >24 ч без выполнения → push непосредственному руководителю
 *     по ManagerScope (либо management в целом если scope не задан);
 *   - >48 ч без выполнения → push owner'у/manager'у уровнем выше +
 *     помечается уже escalated_owner.
 *
 * Дедупликация — через AuditLog с entity="tasksflow_task_link",
 * entityId=link.id, action ∈ {`escalated_l1`, `escalated_l2`}.
 *
 * INFRA NEXT: добавить в внешний cron 4 раза в день (06/12/18/00 MSK)
 * на /api/cron/tasksflow-escalations.
 */
async function handle(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Все активные task-link'и старше 24 ч. Заодно подтянем integration,
  // чтобы найти organizationId и сходить в TF API за заголовком.
  const links = await db.tasksFlowTaskLink.findMany({
    where: {
      remoteStatus: "active",
      createdAt: { lte: since24h },
    },
    include: {
      integration: {
        select: {
          id: true,
          organizationId: true,
          baseUrl: true,
          apiKeyEncrypted: true,
          enabled: true,
          tasksflowCompanyId: true,
          label: true,
        },
      },
    },
  });

  const enabledLinks = links.filter((l) => l.integration.enabled);
  let escalatedL1 = 0;
  let escalatedL2 = 0;
  let skipped = 0;

  // Соберём существующие AuditLog'и оптом.
  const linkIds = enabledLinks.map((l) => l.id);
  const existing = await db.auditLog.findMany({
    where: {
      entity: "tasksflow_task_link",
      entityId: { in: linkIds },
      action: { in: ["escalated_l1", "escalated_l2"] },
    },
    select: { entityId: true, action: true },
  });
  const dedupe = new Set(
    existing.map((e) => `${e.entityId}:${e.action}`)
  );

  for (const link of enabledLinks) {
    const isOver48h = link.createdAt < since48h;
    const stage = isOver48h ? "escalated_l2" : "escalated_l1";

    if (dedupe.has(`${link.id}:${stage}`)) {
      skipped += 1;
      continue;
    }

    // На L2 хотим быть уверены что L1 уже отправлен (для чистоты лога).
    if (stage === "escalated_l2" && !dedupe.has(`${link.id}:escalated_l1`)) {
      // Допускаем — если задача висит >48h и пропустили L1, сразу L2.
    }

    // Title задачи нужен для красивого пуша; берём из TF (лёгкий запрос).
    let taskTitle: string | null = null;
    let assignedWorkerId: number | null = null;
    try {
      const tfClient = tasksflowClientFor(link.integration);
      const task = await tfClient.getTask(link.tasksflowTaskId);
      if (task.isCompleted) {
        // TF уже выполнил — синхронизируем remoteStatus и пропускаем.
        await db.tasksFlowTaskLink.update({
          where: { id: link.id },
          data: { remoteStatus: "completed", completedAt: new Date() },
        });
        skipped += 1;
        continue;
      }
      taskTitle = task.title;
      assignedWorkerId = task.workerId;
    } catch (err) {
      if (err instanceof TasksFlowError && err.status === 404) {
        // Задача удалена в TF — закрываем link.
        await db.tasksFlowTaskLink.update({
          where: { id: link.id },
          data: { remoteStatus: "completed", completedAt: new Date() },
        });
        skipped += 1;
        continue;
      }
      // На сетевые ошибки тихо пропускаем — следующий cron повторит.
      skipped += 1;
      continue;
    }

    // Найдём WeSetup-юзера-исполнителя по TF workerId, чтобы ManagerScope
    // мог дать руководителя.
    let employeeId: string | null = null;
    let employeeName: string | null = null;
    if (assignedWorkerId) {
      const userLink = await db.tasksFlowUserLink.findFirst({
        where: {
          integrationId: link.integration.id,
          tasksflowWorkerId: assignedWorkerId,
        },
        select: {
          wesetupUserId: true,
          user: { select: { name: true } } as never,
        } as never,
      });
      if (userLink) {
        employeeId = (userLink as { wesetupUserId: string }).wesetupUserId;
        employeeName =
          (userLink as { user?: { name?: string } }).user?.name ?? null;
      }
    }

    // Для L1: ищем непосредственного руководителя через ManagerScope.
    // ManagerScope.viewMode определяет, кого видит manager. Нам надо
    // обратное: найти manager'ов, которые видят этого employee.
    let managerToPing: string | null = null;
    if (employeeId) {
      const scopes = await db.managerScope.findMany({
        where: {
          organizationId: link.integration.organizationId,
          OR: [
            { viewMode: "all" },
            {
              viewMode: "specific_users",
              viewUserIds: { has: employeeId },
            },
          ],
        },
        select: { managerId: true, viewMode: true },
      });
      // Предпочитаем не "all" (более конкретный manager).
      const specific = scopes.find((s) => s.viewMode === "specific_users");
      managerToPing = specific?.managerId ?? scopes[0]?.managerId ?? null;
    }

    const titleText = taskTitle ?? `Задача #${link.tasksflowTaskId}`;
    const employeeText = employeeName ?? "не назначен";
    const ageHours = Math.floor(
      (now.getTime() - link.createdAt.getTime()) / (60 * 60 * 1000)
    );

    if (stage === "escalated_l1" && managerToPing) {
      // Soft-ping: «у Иван висит просроченная задача».
      const message =
        `🟡 <b>Просроченная задача в TasksFlow</b>\n\n` +
        `«${esc(titleText)}»\n` +
        `Исполнитель: ${esc(employeeText)}\n` +
        `Не выполнено уже ${ageHours} ч (норма ≤ 24 ч).`;
      await notifyEmployee(managerToPing, message);
      escalatedL1 += 1;
    } else if (stage === "escalated_l2") {
      // Hard-ping: всему management.
      const message =
        `🚨 <b>Срочно! Просроченная задача >48 ч</b>\n\n` +
        `«${esc(titleText)}»\n` +
        `Исполнитель: ${esc(employeeText)}\n` +
        `Не выполнено ${ageHours} ч — это критическое отставание.\n` +
        `Проверьте ${
          link.integration.label
            ? `«${esc(link.integration.label)}»`
            : "TasksFlow"
        } и переназначьте либо отмените.`;
      await notifyOrganization(
        link.integration.organizationId,
        message,
        ["owner"]
      );
      escalatedL2 += 1;
    } else {
      skipped += 1;
      continue;
    }

    await db.auditLog.create({
      data: {
        organizationId: link.integration.organizationId,
        action: stage,
        entity: "tasksflow_task_link",
        entityId: link.id,
        details: {
          tasksflowTaskId: link.tasksflowTaskId,
          journalCode: link.journalCode,
          rowKey: link.rowKey,
          ageHours,
          employeeId,
          employeeName,
          managerPinged: managerToPing,
        },
      },
    });
  }

  return NextResponse.json({
    ok: true,
    linksScanned: enabledLinks.length,
    escalatedL1,
    escalatedL2,
    skipped,
  });
}

export const GET = handle;
export const POST = handle;
