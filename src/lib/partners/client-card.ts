import { db } from "@/lib/db";

import type { PartnerAccessLevel } from "./access-guard";
import { listAccruals, summarizeBalances, type AccrualView } from "./accruals";
import { PartnerError } from "./errors";

/**
 * Карточка клиента в партнёрском кабинете: сведения об организации,
 * привязка, заметки партнёра (клиент их не видит), начисления по клиенту.
 */
export type PartnerClientCard = {
  link: {
    partnerClientId: string;
    accessLevel: PartnerAccessLevel;
    source: string;
    attachedAt: string;
    detachedAt: string | null;
    detachedBy: string | null;
    clientHidesBranding: boolean;
    firstPaymentAt: string | null;
  };
  organization: {
    id: string;
    name: string;
    type: string;
    address: string | null;
    phone: string | null;
    plan: string;
    subscriptionEnd: string | null;
    createdAt: string;
    usersCount: number;
    activeUsersCount: number;
  };
  notes: Array<{ id: string; text: string; authorName: string; createdAt: string }>;
  accruals: AccrualView[];
  balances: ReturnType<typeof summarizeBalances>;
};

export async function getPartnerClientCard(partnerId: string, organizationId: string): Promise<PartnerClientCard> {
  const link = await db.partnerClient.findFirst({
    where: { partnerId, organizationId },
    orderBy: { attachedAt: "desc" },
    select: {
      id: true,
      accessLevel: true,
      source: true,
      attachedAt: true,
      detachedAt: true,
      detachedBy: true,
      clientHidesBranding: true,
      firstPaymentAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          phone: true,
          subscriptionPlan: true,
          subscriptionEnd: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
      },
    },
  });
  if (!link) throw new PartnerError("Клиент не найден", 404);

  const [activeUsers, notes, accruals] = await Promise.all([
    db.user.count({ where: { organizationId, isActive: true } }),
    db.partnerClientNote.findMany({
      where: { partnerId, partnerClientId: link.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, text: true, authorName: true, createdAt: true },
    }),
    listAccruals({ partnerId, organizationId, take: 500 }),
  ]);

  return {
    link: {
      partnerClientId: link.id,
      accessLevel: link.accessLevel === "edit" ? "edit" : "view",
      source: link.source,
      attachedAt: link.attachedAt.toISOString(),
      detachedAt: link.detachedAt ? link.detachedAt.toISOString() : null,
      detachedBy: link.detachedBy,
      clientHidesBranding: link.clientHidesBranding,
      firstPaymentAt: link.firstPaymentAt ? link.firstPaymentAt.toISOString() : null,
    },
    organization: {
      id: link.organization.id,
      name: link.organization.name,
      type: link.organization.type,
      address: link.organization.address,
      phone: link.organization.phone,
      plan: link.organization.subscriptionPlan,
      subscriptionEnd: link.organization.subscriptionEnd ? link.organization.subscriptionEnd.toISOString() : null,
      createdAt: link.organization.createdAt.toISOString(),
      usersCount: link.organization._count.users,
      activeUsersCount: activeUsers,
    },
    notes: notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    accruals,
    balances: summarizeBalances(accruals),
  };
}

/** Активная привязка клиента к партнёру — для «Открыть кабинет». */
export async function getActiveClientLink(partnerId: string, organizationId: string) {
  return db.partnerClient.findFirst({
    where: { partnerId, organizationId, detachedAt: null },
    select: { id: true, accessLevel: true },
  });
}
