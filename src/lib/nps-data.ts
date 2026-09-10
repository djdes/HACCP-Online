import { db } from "@/lib/db";
import { shouldAskNps } from "@/lib/nps";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

/** Показывать ли опрос этому пользователю сейчас (только руководству). */
export async function askNpsFor(session: { user: { id: string; role?: string | null; isRoot?: boolean | null; organizationId: string } }, now: Date = new Date()): Promise<boolean> {
  if (!hasFullWorkspaceAccess(session.user) || session.user.isRoot) return false;
  const [user, org] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { npsAskedAt: true } }),
    db.organization.findUnique({ where: { id: session.user.organizationId }, select: { createdAt: true, isDemo: true } }),
  ]);
  if (!user || !org || org.isDemo) return false;
  return shouldAskNps({ orgCreatedAt: org.createdAt, npsAskedAt: user.npsAskedAt, now });
}
