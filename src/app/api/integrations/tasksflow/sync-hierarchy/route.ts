import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
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
 * Management-only.
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
  const report = await syncHierarchyToTasksflow(organizationId);
  return NextResponse.json(report);
}
