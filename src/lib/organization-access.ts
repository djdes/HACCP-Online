import { db } from "@/lib/db";

/**
 * Организации, в которых человек имеет право работать: домашняя плюс
 * все, где у него есть членство. Один запрос на список — им пользуются и
 * меню профиля, и проверка переключения.
 */
export type AccessibleOrganization = {
  id: string;
  name: string;
  role: "owner" | "manager" | "home";
  isHome: boolean;
};

export async function listAccessibleOrganizations(
  userId: string,
): Promise<AccessibleOrganization[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      organizationId: true,
      organization: { select: { id: true, name: true } },
      organizationMemberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!user) return [];

  const byId = new Map<string, AccessibleOrganization>();
  if (user.organization) {
    byId.set(user.organization.id, {
      id: user.organization.id,
      name: user.organization.name,
      role: "home",
      isHome: true,
    });
  }
  for (const membership of user.organizationMemberships) {
    const existing = byId.get(membership.organization.id);
    byId.set(membership.organization.id, {
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role === "owner" ? "owner" : "manager",
      isHome: existing?.isHome ?? false,
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

/**
 * Единственная проверка доступа к организации. Всё, что меняет активную
 * организацию, обязано пройти через неё — иначе подставленный id в теле
 * запроса открывал бы чужой кабинет.
 */
export async function assertOrgMembership(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user) return false;
  if (user.organizationId === organizationId) return true;
  const member = await db.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true },
  });
  return Boolean(member);
}
