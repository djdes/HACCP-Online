import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { TasksFlowSettingsClient } from "./tasksflow-settings-client";

export const dynamic = "force-dynamic";

export default async function TasksFlowSettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/journals");
  }
  const orgId = getActiveOrgId(session);

  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId: orgId },
    select: {
      id: true,
      baseUrl: true,
      apiKeyPrefix: true,
      tasksflowCompanyId: true,
      enabled: true,
      lastSyncAt: true,
      label: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { links: true, taskLinks: true } },
    },
  });

  return (
    <TasksFlowSettingsClient
      organizationName={session.user.organizationName ?? ""}
      initialIntegration={
        integration
          ? {
              id: integration.id,
              baseUrl: integration.baseUrl,
              apiKeyPrefix: integration.apiKeyPrefix,
              tasksflowCompanyId: integration.tasksflowCompanyId,
              enabled: integration.enabled,
              lastSyncAt: integration.lastSyncAt
                ? integration.lastSyncAt.toISOString()
                : null,
              label: integration.label,
              linkedUserCount: integration._count.links,
              taskLinkCount: integration._count.taskLinks,
            }
          : null
      }
    />
  );
}
