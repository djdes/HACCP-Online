import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Раньше: ЛЮБОЙ authenticated сотрудник мог прочитать весь
  // audit-log своей org через mini-app, включая sensitive события:
  //   - user.role_changed, user.password_reset
  //   - impersonate.start/stop
  //   - closed_day.override
  //   - детали JSON всех изменений
  // Web-side /api/audit имеет isManagerRole-check, mini-side не имел.
  // Согласовано через `audit.view` capability (admin/head_chef).
  const canSee =
    hasCapability(session.user, "admin.full") ||
    hasCapability(session.user, "tasks.verify");
  if (!canSee) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const orgId = getActiveOrgId(session);

  const logs = await db.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      userName: true,
      action: true,
      entity: true,
      entityId: true,
      details: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
