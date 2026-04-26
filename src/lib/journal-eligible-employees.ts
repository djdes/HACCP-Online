import { db } from "@/lib/db";

/**
 * Returns users eligible to fill journal `templateCode` in `organizationId`.
 *
 * Logic:
 *   1. Find templateId by code.
 *   2. Find positions that have JobPositionJournalAccess to this template.
 *   3. If at least one position is granted — return only users in those
 *      positions.
 *   4. If no positions are granted yet (empty access for this template,
 *      typical for back-compat orgs) — return ALL active users (legacy
 *      behaviour: «нет ACL — доступно всем»).
 *
 * Все adapter'ы fan-out которые «выдают всем» rows должны фильтровать
 * через эту функцию — иначе на bulk-assign задача попадёт даже бармену
 * и грузчику.
 */
export async function getEligibleEmployeesForJournal<
  TUser extends { id: string; jobPositionId: string | null }
>(args: {
  organizationId: string;
  templateCode: string;
  /** Дополнительные select-поля. Минимум должно содержать id+jobPositionId. */
  select: Record<string, true | { select: Record<string, unknown> }>;
}): Promise<TUser[]> {
  const template = await db.journalTemplate.findFirst({
    where: { code: args.templateCode },
    select: { id: true },
  });
  if (!template) {
    return (await db.user.findMany({
      where: {
        organizationId: args.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: args.select,
      orderBy: [{ role: "asc" }, { name: "asc" }],
    })) as unknown as TUser[];
  }

  const accessRows = await db.jobPositionJournalAccess.findMany({
    where: {
      organizationId: args.organizationId,
      templateId: template.id,
    },
    select: { jobPositionId: true },
  });
  const allowedPositionIds = new Set(accessRows.map((r) => r.jobPositionId));

  if (allowedPositionIds.size === 0) {
    // Back-compat: org не настроил per-position access — все могут.
    return (await db.user.findMany({
      where: {
        organizationId: args.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: args.select,
      orderBy: [{ role: "asc" }, { name: "asc" }],
    })) as unknown as TUser[];
  }

  return (await db.user.findMany({
    where: {
      organizationId: args.organizationId,
      isActive: true,
      archivedAt: null,
      jobPositionId: { in: [...allowedPositionIds] },
    },
    select: args.select,
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })) as unknown as TUser[];
}
