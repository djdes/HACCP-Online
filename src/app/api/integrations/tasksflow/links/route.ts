import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveOrgFromTasksflowBearerOrSession } from "@/lib/tasksflow-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-employee mapping for the active org. Joins WeSetup `User` rows with
 * any existing `TasksFlowUserLink` so the settings UI can render one row
 * per employee with status «Связан / Не найден / Без телефона».
 *
 * Auth: либо WeSetup admin session (UI вызов из /settings/integrations),
 * либо `Bearer tfk_…` (TasksFlow proxy `/api/wesetup/links`).
 */
export async function GET(request: Request) {
  const auth = await resolveOrgFromTasksflowBearerOrSession(request);
  if (!auth.ok) return auth.response;
  const orgId = auth.organizationId;

  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json({ links: [] });
  }

  const wesetupUsers = await db.user.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      positionTitle: true,
    },
    orderBy: { name: "asc" },
  });

  const links = await db.tasksFlowUserLink.findMany({
    where: { integrationId: integration.id },
    select: {
      id: true,
      wesetupUserId: true,
      phone: true,
      tasksflowUserId: true,
      tasksflowWorkerId: true,
      source: true,
      updatedAt: true,
    },
  });
  const linkByUser = new Map(links.map((l) => [l.wesetupUserId, l]));

  const rows = wesetupUsers.map((u) => {
    const link = linkByUser.get(u.id) ?? null;
    let status: "linked" | "no_phone" | "no_match" | "pending";
    if (!u.phone) status = "no_phone";
    else if (!link) status = "pending";
    else if (link.tasksflowUserId) status = "linked";
    else status = "no_match";
    return {
      wesetupUserId: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      positionTitle: u.positionTitle,
      link: link
        ? {
            tasksflowUserId: link.tasksflowUserId,
            source: link.source,
            updatedAt: link.updatedAt,
          }
        : null,
      status,
    };
  });

  return NextResponse.json({ links: rows });
}
