import type { TasksFlowIntegration, TasksFlowTaskLink } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";

export function extractTasksFlowBearer(authHeader: string): string | null {
  const match = /^Bearer\s+(tfk_[A-Za-z0-9_-]+)$/.exec(authHeader);
  return match?.[1] ?? null;
}

export async function getMatchingTasksFlowIntegrations(
  presentedKey: string
): Promise<TasksFlowIntegration[]> {
  const prefix = presentedKey.slice(0, 12);
  const candidates = await db.tasksFlowIntegration.findMany({
    where: { enabled: true, apiKeyPrefix: prefix },
  });

  const matches: TasksFlowIntegration[] = [];
  for (const candidate of candidates) {
    try {
      if (decryptSecret(candidate.apiKeyEncrypted) === presentedKey) {
        matches.push(candidate);
      }
    } catch {
      /* skip broken candidate */
    }
  }
  return matches;
}

export async function findTaskLinkForAuthorizedIntegrations(params: {
  integrations: TasksFlowIntegration[];
  tasksflowTaskId: number;
  preferredIntegrationId?: string | null;
}): Promise<
  | {
      integration: TasksFlowIntegration;
      link: TasksFlowTaskLink;
    }
  | null
> {
  const preferredId = params.preferredIntegrationId?.trim() || null;
  const authorizedIds = params.integrations.map((integration) => integration.id);
  if (authorizedIds.length === 0) return null;
  if (preferredId && !authorizedIds.includes(preferredId)) return null;

  const link = await db.tasksFlowTaskLink.findFirst({
    where: {
      tasksflowTaskId: params.tasksflowTaskId,
      integrationId: preferredId ?? { in: authorizedIds },
    },
  });
  if (!link) return null;

  const integration = params.integrations.find((item) => item.id === link.integrationId);
  return integration ? { integration, link } : null;
}
