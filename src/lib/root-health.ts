import { db } from "@/lib/db";
import { getDbRoleValuesWithLegacy, MANAGEMENT_ROLES } from "@/lib/user-roles";

/**
 * Здоровье клиентов для ROOT: у каких организаций признаки ухода.
 * Чистая часть — `riskFlags`; сбор данных — `collectClientHealth`.
 */
export type ClientHealthInput = {
  id: string;
  name: string;
  createdAt: Date;
  subscriptionPlan: string | null;
  subscriptionEnd: Date | null;
  lastEntryAt: Date | null;
  openIncidents: number;
  managersWithTelegram: number;
  activeUsers: number;
};

export type RiskFlag = { key: "no-entries" | "never-started" | "subscription" | "incidents" | "no-telegram" | "solo"; label: string; weight: number };

export const RISK_LABEL: Record<RiskFlag["key"], string> = {
  "no-entries": "нет записей 14+ дней",
  "never-started": "ни одной записи с регистрации",
  subscription: "подписка кончается или кончилась",
  incidents: "незакрытые отклонения температуры",
  "no-telegram": "у руководства не привязан Telegram",
  solo: "один пользователь",
};

export function riskFlags(org: ClientHealthInput, now: Date): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const day = 86_400_000;
  const ageDays = (now.getTime() - org.createdAt.getTime()) / day;
  if (!org.lastEntryAt) {
    if (ageDays >= 3) flags.push({ key: "never-started", label: RISK_LABEL["never-started"], weight: 3 });
  } else if (now.getTime() - org.lastEntryAt.getTime() > 14 * day) {
    flags.push({ key: "no-entries", label: RISK_LABEL["no-entries"], weight: 3 });
  }
  if (org.subscriptionPlan && org.subscriptionPlan !== "free" && org.subscriptionEnd && org.subscriptionEnd.getTime() - now.getTime() < 7 * day) {
    flags.push({ key: "subscription", label: RISK_LABEL.subscription, weight: 2 });
  }
  if (org.openIncidents > 0) flags.push({ key: "incidents", label: RISK_LABEL.incidents, weight: 1 });
  if (org.managersWithTelegram === 0) flags.push({ key: "no-telegram", label: RISK_LABEL["no-telegram"], weight: 1 });
  if (org.activeUsers <= 1 && ageDays >= 7) flags.push({ key: "solo", label: RISK_LABEL.solo, weight: 1 });
  return flags;
}

export type ClientHealthRow = ClientHealthInput & { flags: RiskFlag[]; score: number };

export async function collectClientHealth(now: Date = new Date()): Promise<ClientHealthRow[]> {
  const orgs = await db.organization.findMany({
    where: { isDemo: false, id: { not: process.env.PLATFORM_ORG_ID ?? "platform" } },
    select: { id: true, name: true, createdAt: true, subscriptionPlan: true, subscriptionEnd: true },
  });
  if (orgs.length === 0) return [];
  const ids = orgs.map((o) => o.id);
  const managementRoles = getDbRoleValuesWithLegacy(MANAGEMENT_ROLES);
  const [docEntries, fieldEntries, incidents, users] = await Promise.all([
    db.journalDocumentEntry.groupBy({ by: ["documentId"], _max: { createdAt: true }, where: { document: { organizationId: { in: ids } } } }),
    db.journalEntry.groupBy({ by: ["organizationId"], _max: { createdAt: true }, where: { organizationId: { in: ids } } }),
    db.temperatureDeviationIncident.groupBy({ by: ["organizationId"], _count: { _all: true }, where: { organizationId: { in: ids }, resolvedAt: null } }),
    db.user.findMany({ where: { organizationId: { in: ids }, isActive: true }, select: { organizationId: true, role: true, telegramChatId: true } }),
  ]);
  const docOrg = await db.journalDocument.findMany({ where: { id: { in: docEntries.map((d) => d.documentId) } }, select: { id: true, organizationId: true } });
  const orgOfDoc = new Map(docOrg.map((d) => [d.id, d.organizationId]));
  const lastEntry = new Map<string, Date>();
  const bump = (orgId: string | undefined, at: Date | null) => {
    if (!orgId || !at) return;
    const prev = lastEntry.get(orgId);
    if (!prev || at > prev) lastEntry.set(orgId, at);
  };
  for (const d of docEntries) bump(orgOfDoc.get(d.documentId), d._max.createdAt);
  for (const f of fieldEntries) bump(f.organizationId, f._max.createdAt);
  const incidentsByOrg = new Map(incidents.map((i) => [i.organizationId, i._count._all]));
  const usersByOrg = new Map<string, { active: number; tgManagers: number }>();
  for (const u of users) {
    const row = usersByOrg.get(u.organizationId) ?? { active: 0, tgManagers: 0 };
    row.active += 1;
    if (managementRoles.includes(u.role) && u.telegramChatId) row.tgManagers += 1;
    usersByOrg.set(u.organizationId, row);
  }
  return orgs
    .map((o) => {
      const input: ClientHealthInput = {
        ...o,
        lastEntryAt: lastEntry.get(o.id) ?? null,
        openIncidents: incidentsByOrg.get(o.id) ?? 0,
        managersWithTelegram: usersByOrg.get(o.id)?.tgManagers ?? 0,
        activeUsers: usersByOrg.get(o.id)?.active ?? 0,
      };
      const flags = riskFlags(input, now);
      return { ...input, flags, score: flags.reduce((s, f) => s + f.weight, 0) };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ru"));
}
