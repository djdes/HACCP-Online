import type { PartnerAccessLevel } from "./access-guard";

/**
 * Типы и чистые функции обзора партнёрского кабинета, безопасные для
 * клиентского бандла (без Prisma). Загрузка из БД — в `overview.ts`.
 */

export type OverviewFilter = "all" | "active" | "inactive" | "overdue" | "medbooks" | "detached";

export const OVERVIEW_FILTER_LABELS: Record<OverviewFilter, string> = {
  all: "Все клиенты",
  active: "Активные 7 дней",
  inactive: "Без записей",
  overdue: "Просрочка сегодня",
  medbooks: "Медкнижки истекают",
  detached: "Отключённые",
};

export function isOverviewFilter(value: unknown): value is OverviewFilter {
  return typeof value === "string" && value in OVERVIEW_FILTER_LABELS;
}

export type OverviewClientRow = {
  partnerClientId: string;
  organizationId: string;
  name: string;
  type: string;
  plan: string;
  subscriptionEnd: string | null;
  attachedAt: string;
  detachedAt: string | null;
  accessLevel: PartnerAccessLevel;
  clientHidesBranding: boolean;
  lastActivityAt: string | null;
  activeLast7Days: boolean;
  overdueToday: number;
  medBooksExpiring: number;
};

export type OverviewTiles = {
  clientsTotal: number;
  activeLast7Days: number;
  overdueToday: number;
  medBooksExpiring30: number;
};

export type PartnerOverview = {
  generatedAt: string;
  tiles: OverviewTiles;
  clients: OverviewClientRow[];
};

export function filterOverviewClients(rows: OverviewClientRow[], filter: OverviewFilter): OverviewClientRow[] {
  switch (filter) {
    case "active":
      return rows.filter((r) => !r.detachedAt && r.activeLast7Days);
    case "inactive":
      return rows.filter((r) => !r.detachedAt && !r.activeLast7Days);
    case "overdue":
      return rows.filter((r) => !r.detachedAt && r.overdueToday > 0);
    case "medbooks":
      return rows.filter((r) => !r.detachedAt && r.medBooksExpiring > 0);
    case "detached":
      return rows.filter((r) => !!r.detachedAt);
    default:
      return rows.filter((r) => !r.detachedAt);
  }
}
