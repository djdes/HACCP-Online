import { NextResponse } from "next/server";
import { resolveOrgFromTasksflowBearerOrSession } from "@/lib/tasksflow-auth";
import { syncHierarchyToTasksflow } from "@/lib/tasksflow-hierarchy-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/tasksflow/sync-hierarchy
 *
 * Кнопка «Применить иерархию в TasksFlow» в /settings/staff-hierarchy.
 * Считает для каждого ManagerScope этой организации список TF user
 * id-ов, которыми менеджер руководит, и пушит на TF через
 * `PUT /api/admin/users/:id/managed-workers`.
 *
 * Без тела. Возвращает сводку: сколько менеджеров обновили,
 * сколько пропустили (не привязаны к TF), сколько упало.
 *
 * Auth: WeSetup admin session ИЛИ `Bearer tfk_…` (TasksFlow proxy).
 */
export async function POST(request: Request) {
  const auth = await resolveOrgFromTasksflowBearerOrSession(request);
  if (!auth.ok) return auth.response;
  const report = await syncHierarchyToTasksflow(auth.organizationId);
  return NextResponse.json(report);
}
