import { db } from "@/lib/db";
import { isManagementRole } from "@/lib/user-roles";

/**
 * Per-user per-journal access control.
 *
 * Rule:
 *   1. Root bypasses everything.
 *   2. Managers/head_chefs bypass everything (org owners see all journals).
 *   3. Users with journalAccessMigrated=false bypass too — this is the
 *      zero-regression default; every pre-existing employee sees what they
 *      saw yesterday until their owner explicitly saves an ACL for them.
 *   4. Otherwise, an explicit row in UserJournalAccess with canRead=true is
 *      required for that templateCode.
 *
 * Writes and finalize (`canWrite`, `canFinalize`) are separate fields on
 * UserJournalAccess; this lib exposes per-op helpers.
 *
 * A 60-second in-memory LRU cache keeps the hot path off the DB. Invalidated
 * on any /settings/users/[id]/access save via `invalidateJournalAcl(userId)`.
 */

type CachedEntry = {
  fetchedAt: number;
  migrated: boolean;
  rows: Array<{
    templateCode: string;
    canRead: boolean;
    canWrite: boolean;
    canFinalize: boolean;
  }>;
};

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, CachedEntry>();

function cacheGet(userId: string): CachedEntry | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(userId);
    return null;
  }
  // Touch for LRU order.
  cache.delete(userId);
  cache.set(userId, entry);
  return entry;
}

function cacheSet(userId: string, entry: CachedEntry): void {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(userId, entry);
}

export function invalidateJournalAcl(userId: string): void {
  cache.delete(userId);
}

async function loadAcl(userId: string): Promise<CachedEntry> {
  const hit = cacheGet(userId);
  if (hit) return hit;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { journalAccessMigrated: true },
  });
  if (!user) {
    const empty: CachedEntry = {
      fetchedAt: Date.now(),
      migrated: true,
      rows: [],
    };
    cacheSet(userId, empty);
    return empty;
  }

  const rows = await db.userJournalAccess.findMany({
    where: { userId },
    select: {
      templateCode: true,
      canRead: true,
      canWrite: true,
      canFinalize: true,
    },
  });

  const entry: CachedEntry = {
    fetchedAt: Date.now(),
    migrated: user.journalAccessMigrated === true,
    rows,
  };
  cacheSet(userId, entry);
  return entry;
}

export type JournalAclActor = {
  id: string;
  role: string;
  isRoot: boolean;
};

function bypasses(actor: JournalAclActor): boolean {
  return actor.isRoot || isManagementRole(actor.role);
}

export async function hasJournalAccess(
  actor: JournalAclActor,
  templateCode: string
): Promise<boolean> {
  if (bypasses(actor)) return true;
  const acl = await loadAcl(actor.id);
  if (!acl.migrated) return true;
  const row = acl.rows.find((r) => r.templateCode === templateCode);
  return row?.canRead === true;
}

export async function canWriteJournal(
  actor: JournalAclActor,
  templateCode: string
): Promise<boolean> {
  if (bypasses(actor)) return true;
  const acl = await loadAcl(actor.id);
  if (!acl.migrated) return true;
  const row = acl.rows.find((r) => r.templateCode === templateCode);
  return row?.canWrite === true;
}

export async function canFinalizeJournal(
  actor: JournalAclActor,
  templateCode: string
): Promise<boolean> {
  if (bypasses(actor)) return true;
  const acl = await loadAcl(actor.id);
  if (!acl.migrated) return true;
  const row = acl.rows.find((r) => r.templateCode === templateCode);
  return row?.canFinalize === true;
}

/**
 * Returns the list of templateCodes the caller can at least READ. Managers
 * / root / unmigrated users get `null` meaning "no filter applied — show
 * every template the org has". Explicit employees get the intersection of
 * their ACL with `canRead=true`.
 *
 * Null-returning is important: upstream code must treat `null` as
 * "no restriction" and skip the filter clause entirely; passing an empty
 * array would hide every template.
 */
export async function getAllowedJournalCodes(
  actor: JournalAclActor
): Promise<string[] | null> {
  if (bypasses(actor)) return null;
  const acl = await loadAcl(actor.id);
  if (!acl.migrated) return null;
  return acl.rows.filter((r) => r.canRead).map((r) => r.templateCode);
}

/**
 * Convenience for Session objects. Server handlers that already called
 * `requireAuth()` can go straight to the actor shape.
 */
export function aclActorFromSession(session: {
  user: { id: string; role: string; isRoot: boolean };
}): JournalAclActor {
  return {
    id: session.user.id,
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  };
}
