import { BADGE_CODE_RE, BADGE_DAYS } from "@/lib/badge/render";
import { db } from "@/lib/db";
import { parseDisabledCodes } from "@/lib/disabled-journals";
import { sphereLabel } from "@/lib/org-profile";
import { getTemplatesFilledToday } from "@/lib/today-compliance";

export type BadgeStatus = {
  organizationId: string;
  name: string;
  sphere: string;
  /** null — журналов нет или ещё не заполнялись. */
  percent: number | null;
  filledSlots: number;
  totalSlots: number;
  days: number;
  computedAt: string;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: BadgeStatus }>();

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Процент заполнения за последние 30 полных дней (сегодня не считаем — день ещё идёт). */
export async function computeBadgeCompliance(
  org: { id: string; disabledJournalCodes: unknown },
  now: Date = new Date()
): Promise<{ percent: number | null; filledSlots: number; totalSlots: number }> {
  const templates = await db.journalTemplate.findMany({ where: { isActive: true }, select: { id: true, code: true } });
  const disabled = parseDisabledCodes(org.disabledJournalCodes);
  const visible = templates.filter((t) => !disabled.has(t.code));
  if (visible.length === 0) return { percent: null, filledSlots: 0, totalSlots: 0 };
  const today = utcDayStart(now);
  let filledSlots = 0;
  for (let i = 1; i <= BADGE_DAYS; i += 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - i);
    const filled = await getTemplatesFilledToday(org.id, day, visible, disabled, { treatAperiodicAsFilled: false });
    filledSlots += filled.size;
  }
  const totalSlots = visible.length * BADGE_DAYS;
  return { percent: Math.round((filledSlots / totalSlots) * 100), filledSlots, totalSlots };
}

export async function getBadgeStatusForOrganization(organizationId: string, now: Date = new Date()): Promise<BadgeStatus | null> {
  const cached = cache.get(organizationId);
  if (cached && now.getTime() - cached.at < CACHE_TTL_MS) return cached.value;
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, type: true, disabledJournalCodes: true },
  });
  if (!org) return null;
  const compliance = await computeBadgeCompliance(org, now);
  const value: BadgeStatus = {
    organizationId: org.id,
    name: org.name,
    sphere: sphereLabel(org.type),
    ...compliance,
    days: BADGE_DAYS,
    computedAt: now.toISOString(),
  };
  cache.set(organizationId, { at: now.getTime(), value });
  return value;
}

/** По публичному коду: только включённые бейджи, иначе null. */
export async function getBadgeStatusByCode(code: string, now: Date = new Date()): Promise<BadgeStatus | null> {
  if (!BADGE_CODE_RE.test(code)) return null;
  const org = await db.organization.findFirst({ where: { badgeCode: code, badgeEnabled: true }, select: { id: true } });
  if (!org) return null;
  return getBadgeStatusForOrganization(org.id, now);
}

export function invalidateBadgeStatus(organizationId: string): void {
  cache.delete(organizationId);
}
