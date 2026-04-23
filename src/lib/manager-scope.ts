import { db } from "./db";

export type ManagerScope = {
  id: string;
  managerId: string;
  viewMode: "all" | "job_positions" | "specific_users" | "none";
  viewJobPositionIds: string[];
  viewUserIds: string[];
  assignableJournalCodes: string[];
};

export async function getManagerScope(
  managerId: string,
  organizationId: string
): Promise<ManagerScope | null> {
  const scope = await db.managerScope.findUnique({
    where: { organizationId_managerId: { organizationId, managerId } },
  });
  if (!scope) return null;
  return {
    id: scope.id,
    managerId: scope.managerId,
    viewMode: scope.viewMode as ManagerScope["viewMode"],
    viewJobPositionIds: scope.viewJobPositionIds,
    viewUserIds: scope.viewUserIds,
    assignableJournalCodes: scope.assignableJournalCodes,
  };
}

export async function getOrCreateDefaultManagerScope(
  managerId: string,
  organizationId: string
): Promise<ManagerScope> {
  const existing = await getManagerScope(managerId, organizationId);
  if (existing) return existing;

  const created = await db.managerScope.create({
    data: {
      organizationId,
      managerId,
      viewMode: "all",
      viewJobPositionIds: [],
      viewUserIds: [],
      assignableJournalCodes: [],
    },
  });

  return {
    id: created.id,
    managerId: created.managerId,
    viewMode: created.viewMode as ManagerScope["viewMode"],
    viewJobPositionIds: created.viewJobPositionIds,
    viewUserIds: created.viewUserIds,
    assignableJournalCodes: created.assignableJournalCodes,
  };
}

/**
 * Filters a list of users according to the manager's scope.
 * Always includes the manager themselves.
 */
export function filterSubordinates<T extends { id: string; jobPositionId: string | null }>(
  users: T[],
  scope: ManagerScope | null,
  managerId: string
): T[] {
  if (!scope) return users; // no scope = sees all (backward compat)
  if (scope.viewMode === "all") return users;
  if (scope.viewMode === "none") return users.filter((u) => u.id === managerId);

  if (scope.viewMode === "job_positions") {
    const allowedPositions = new Set(scope.viewJobPositionIds);
    return users.filter(
      (u) => u.id === managerId || (u.jobPositionId && allowedPositions.has(u.jobPositionId))
    );
  }

  if (scope.viewMode === "specific_users") {
    const allowedUsers = new Set(scope.viewUserIds);
    return users.filter((u) => u.id === managerId || allowedUsers.has(u.id));
  }

  return users;
}

/**
 * Checks if a manager can assign a specific journal.
 * Empty assignableJournalCodes means "all journals they have access to".
 */
export function canAssignJournal(
  scope: ManagerScope | null,
  journalCode: string
): boolean {
  if (!scope) return true;
  if (scope.assignableJournalCodes.length === 0) return true;
  return scope.assignableJournalCodes.includes(journalCode);
}

/**
 * Get assignable journal codes for a manager.
 * If scope.assignableJournalCodes is empty, returns all allowed codes.
 */
export function getAssignableJournalCodes(
  scope: ManagerScope | null,
  allAllowedCodes: string[] | null
): string[] | null {
  if (!scope || scope.assignableJournalCodes.length === 0) return allAllowedCodes;
  return scope.assignableJournalCodes;
}
