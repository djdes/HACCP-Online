import { db } from "@/lib/db";
import { normalizeSphere, type OrgSphere } from "@/lib/org-profile";
import { defaultDisabledCodesFor } from "@/lib/sphere-journal-rules";

/**
 * Создание организации внутри аккаунта.
 *
 * Одно место на всё приложение: мгновенная регистрация, подтверждение
 * регистрации, оплата и демо-организация ROOT'а раньше собирали
 * `organization.create` каждая по-своему, и набор журналов, тариф и
 * членство владельца расходились между этими путями.
 *
 * Шаблоны журналов глобальные, поэтому seed'ить новую организацию не
 * нужно — копируем только то, что живёт per-org: должности с их доступом
 * к журналам и оформление.
 */

export type CreateOrganizationInput = {
  name: string;
  sphere: OrgSphere | string;
  /** Аккаунт, которому принадлежит организация. */
  accountId: string;
  /** Кто становится владельцем — получает OrganizationMember(role="owner"). */
  ownerUserId: string;
  /** Организация-донор: копируем должности и набор журналов. */
  copyFromOrganizationId?: string | null;
};

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<{ organizationId: string }> {
  const sphere = normalizeSphere(input.sphere);

  const source = input.copyFromOrganizationId
    ? await db.organization.findUnique({
        where: { id: input.copyFromOrganizationId },
        select: {
          id: true,
          accountId: true,
          disabledJournalCodes: true,
          autoJournalCodes: true,
          locale: true,
          brandColor: true,
          logoUrl: true,
        },
      })
    : null;

  // Копировать можно только из своего же аккаунта — иначе через
  // подставленный id утекли бы чужие настройки и структура должностей.
  const donor = source && source.accountId === input.accountId ? source : null;

  const organization = await db.organization.create({
    data: {
      name: input.name.trim(),
      type: sphere,
      accountId: input.accountId,
      subscriptionPlan: "trial",
      disabledJournalCodes: donor
        ? (donor.disabledJournalCodes as never)
        : (defaultDisabledCodesFor(sphere) as never),
      ...(donor
        ? {
            autoJournalCodes: donor.autoJournalCodes as never,
            locale: donor.locale,
            brandColor: donor.brandColor,
            logoUrl: donor.logoUrl,
          }
        : {}),
    },
    select: { id: true },
  });

  await db.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: input.ownerUserId,
        organizationId: organization.id,
      },
    },
    create: {
      userId: input.ownerUserId,
      organizationId: organization.id,
      role: "owner",
    },
    update: { role: "owner" },
  });

  if (donor) {
    await copyPositions(donor.id, organization.id);
  }

  return { organizationId: organization.id };
}

/**
 * Должности с их доступом к журналам. Людей не копируем: сотрудник
 * работает в одной точке, и «клонировать» человека в другую — значит
 * завести второго с тем же именем.
 */
async function copyPositions(fromOrganizationId: string, toOrganizationId: string) {
  const positions = await db.jobPosition.findMany({
    where: { organizationId: fromOrganizationId },
    orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      categoryKey: true,
      sortOrder: true,
      journalAccess: { select: { templateId: true } },
    },
  });

  for (const position of positions) {
    const created = await db.jobPosition.create({
      data: {
        organizationId: toOrganizationId,
        name: position.name,
        categoryKey: position.categoryKey,
        sortOrder: position.sortOrder,
      },
      select: { id: true },
    });

    if (position.journalAccess.length === 0) continue;
    await db.jobPositionJournalAccess.createMany({
      data: position.journalAccess.map((access) => ({
        organizationId: toOrganizationId,
        jobPositionId: created.id,
        templateId: access.templateId,
      })),
      skipDuplicates: true,
    });
  }
}

/**
 * Аккаунт человека: свой (он владелец) либо тот, которому принадлежит его
 * домашняя организация. Нужен везде, где считается тариф и лимит мест.
 */
export async function resolveAccountId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      ownedAccount: { select: { id: true } },
      organization: { select: { accountId: true } },
    },
  });
  return user?.ownedAccount?.id ?? user?.organization?.accountId ?? null;
}
