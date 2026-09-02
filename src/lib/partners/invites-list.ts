import { db } from "@/lib/db";

export type ClientInviteRow = {
  id: string;
  email: string;
  status: string;
  sentAt: string;
  registeredAt: string | null;
  declinedAt: string | null;
  organizationId: string | null;
  organizationName: string | null;
};

/** Email-приглашения партнёра со статусами — для страницы и API. */
export async function listClientInvites(partnerId: string): Promise<ClientInviteRow[]> {
  const invites = await db.partnerInvite.findMany({
    where: { partnerId },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      email: true,
      status: true,
      sentAt: true,
      registeredAt: true,
      declinedAt: true,
      registeredOrganizationId: true,
    },
  });
  const orgIds = invites.map((i) => i.registeredOrganizationId).filter((v): v is string => Boolean(v));
  const orgs = orgIds.length
    ? await db.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
    : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return invites.map((i) => ({
    id: i.id,
    email: i.email,
    status: i.status,
    sentAt: i.sentAt.toISOString(),
    registeredAt: i.registeredAt ? i.registeredAt.toISOString() : null,
    declinedAt: i.declinedAt ? i.declinedAt.toISOString() : null,
    organizationId: i.registeredOrganizationId,
    organizationName: i.registeredOrganizationId ? (orgName.get(i.registeredOrganizationId) ?? null) : null,
  }));
}
