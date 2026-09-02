import { db } from "@/lib/db";
import type { SessionPartnerAccess } from "@/types/next-auth";

import { isPartnerAccessLevel, type PartnerAccessClaim } from "./access-guard";

/**
 * Проверяет claim партнёра из JWT по живым данным: партнёр активен,
 * человек в его команде, клиент привязан и не отвязан. Уровень доступа
 * берётся из БД (клиент мог изменить его после выдачи cookie).
 */
export async function resolvePartnerSessionAccess(
  userId: string,
  claim: PartnerAccessClaim,
): Promise<SessionPartnerAccess | null> {
  const membership = await db.partnerUser.findUnique({
    where: { userId },
    select: {
      partnerId: true,
      partner: {
        select: {
          status: true,
          companyName: true,
          branding: { select: { brandName: true } },
        },
      },
    },
  });
  if (!membership || membership.partnerId !== claim.partnerId) return null;
  if (membership.partner.status !== "active") return null;
  const client = await db.partnerClient.findFirst({
    where: {
      partnerId: claim.partnerId,
      organizationId: claim.organizationId,
      detachedAt: null,
    },
    select: { accessLevel: true },
  });
  if (!client) return null;
  const level = isPartnerAccessLevel(client.accessLevel) ? client.accessLevel : "view";
  return {
    partnerId: claim.partnerId,
    organizationId: claim.organizationId,
    level,
    brandName: membership.partner.branding?.brandName ?? membership.partner.companyName,
  };
}
