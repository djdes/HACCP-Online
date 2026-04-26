import { NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";
import { tasksflowClientFor } from "@/lib/tasksflow-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/root/organizations/[id]
 *
 * ROOT-only удаление организации со всеми зависимостями (cascade на
 * Prisma-уровне покрывает users, journals, telegram-логи и т.д.).
 *
 * Безопасность:
 *   - 401 если не авторизован, 403 если не root.
 *   - 404 если организация не найдена.
 *   - Защита от удаления platform-org (id из PLATFORM_ORG_ID).
 *   - Запись в AuditLog (organizationId платформы).
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireRoot();
  const { id } = await context.params;

  const platformOrgId = (process.env.PLATFORM_ORG_ID ?? "").trim();
  if (platformOrgId && id === platformOrgId) {
    return NextResponse.json(
      { error: "Нельзя удалить platform-organization" },
      { status: 400 }
    );
  }

  const org = await db.organization.findUnique({
    where: { id },
    select: { id: true, name: true, type: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  }

  // Best-effort cleanup TasksFlow-задач до DELETE org. Cascade prisma
  // удалит TasksFlowTaskLink/TasksFlowIntegration в БД, но в TF
  // remote-таски останутся «зомби» (с baseUrl на удалённую WeSetup org)
  // и будут показываться у TF-юзеров с битым task-fill flow. Чтобы
  // этого избежать — проходим по интеграциям org'а и DELETE-каждого
  // task'а через TF API.
  let tfTasksDeleted = 0;
  let tfTasksFailed = 0;
  try {
    const integrations = await db.tasksFlowIntegration.findMany({
      where: { organizationId: id, enabled: true },
    });
    for (const integration of integrations) {
      const taskLinks = await db.tasksFlowTaskLink.findMany({
        where: { integrationId: integration.id },
        select: { tasksflowTaskId: true },
      });
      if (taskLinks.length === 0) continue;
      const client = tasksflowClientFor(integration);
      for (const link of taskLinks) {
        try {
          await client.deleteTask(link.tasksflowTaskId);
          tfTasksDeleted += 1;
        } catch (err) {
          tfTasksFailed += 1;
          console.warn(
            `[org-delete] TF task ${link.tasksflowTaskId} delete failed`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
  } catch (err) {
    console.error("[org-delete] TF cleanup failed", err);
  }

  await db.organization.delete({ where: { id } });

  // AuditLog требует organizationId — пишем в platform-org, чтобы запись
  // была видна root-у на /root/audit. Если platform-org нет — пропускаем.
  if (platformOrgId) {
    await recordAuditLog({
      request,
      session: {
        user: {
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
        },
      },
      organizationId: platformOrgId,
      action: "root.organization.delete",
      entity: "Organization",
      entityId: id,
      details: {
        name: org.name,
        type: org.type,
        tfTasksDeleted,
        tfTasksFailed,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    tfTasksDeleted,
    tfTasksFailed,
  });
}
