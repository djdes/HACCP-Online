import { isManagementRole } from "@/lib/user-roles";

export type RoleAccessActor = {
  role?: string | null;
  isRoot?: boolean | null;
};

const STAFF_WEB_ALLOWED_PREFIXES = ["/journals"] as const;
const STAFF_MINI_ALLOWED_PREFIXES = ["/mini", "/mini/journals"] as const;

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function hasFullWorkspaceAccess(actor: RoleAccessActor): boolean {
  return actor.isRoot === true || isManagementRole(actor.role);
}

export function canAccessWebPath(
  actor: RoleAccessActor,
  pathname: string
): boolean {
  if (hasFullWorkspaceAccess(actor)) return true;
  const normalized = normalizePathname(pathname);
  return STAFF_WEB_ALLOWED_PREFIXES.some((prefix) =>
    matchesPrefix(normalized, prefix)
  );
}

export function canAccessMiniPath(
  actor: RoleAccessActor,
  pathname: string
): boolean {
  if (hasFullWorkspaceAccess(actor)) return true;
  const normalized = normalizePathname(pathname);
  return (
    normalized === STAFF_MINI_ALLOWED_PREFIXES[0] ||
    matchesPrefix(normalized, STAFF_MINI_ALLOWED_PREFIXES[1])
  );
}

export function getWebHomeHref(actor: RoleAccessActor): string {
  return hasFullWorkspaceAccess(actor) ? "/dashboard" : "/journals";
}

export function getBotMiniAppLabel(actor: RoleAccessActor): string {
  return hasFullWorkspaceAccess(actor)
    ? "Открыть кабинет"
    : "Открыть журналы";
}
