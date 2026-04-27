import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * H4 — Партнёрская программа для технологов-консультантов.
 *
 * Вместо отдельной модели — детерминируем партнёрский код из
 * `orgId` через SHA256 → первые 6 hex-символов. Всегда один и
 * тот же для одной org. Не нужно создавать row.
 *
 * Реферал-tracking: при регистрации новой org через `?ref=<code>`
 * записываем `Organization.referredByOrgId` в audit. Кто привёл
 * сколько org → query AuditLog `partner.referral_completed`.
 *
 * GET /api/settings/partner → { code, url, stats: {...} }
 *
 * MVP: stats только counts. Реальная money/payouts — manual
 * через support.
 */

function partnerCode(orgId: string): string {
  return createHash("sha256")
    .update("partner:" + orgId)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = getActiveOrgId(auth.session);
  const code = partnerCode(orgId);

  const referrals = await db.auditLog.findMany({
    where: {
      action: "partner.referral_completed",
      details: { path: ["referrerOrgId"], equals: orgId },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalReferred = referrals.length;
  const last30 = referrals.filter(
    (r) => r.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  const base =
    process.env.NEXTAUTH_URL?.replace(/\/+$/, "") ?? "https://wesetup.ru";
  return NextResponse.json({
    code,
    url: `${base}/register?ref=${code}`,
    stats: {
      totalReferred,
      last30,
      referrals: referrals.slice(0, 10).map((r) => ({
        date: r.createdAt.toISOString(),
        referredOrgId: (r.details as Record<string, unknown>)
          ?.referredOrgId as string | null,
      })),
    },
  });
}

export { partnerCode };
