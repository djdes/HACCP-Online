import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { describeBadge } from "@/lib/badge/describe";
import { generateBadgeCode } from "@/lib/badge/render";
import { getBadgeStatusForOrganization } from "@/lib/badge/status";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return { session, orgId: "", denied: NextResponse.json({ error: "Доступно руководителям" }, { status: 403 }) };
  }
  return { session, orgId: getActiveOrgId(session), denied: null };
}

/** GET — состояние бейджа и ссылки для вставки. */
export async function GET() {
  const { orgId, denied } = await guard();
  if (denied) return denied;
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { badgeEnabled: true, badgeCode: true } });
  if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  const status = org.badgeEnabled ? await getBadgeStatusForOrganization(orgId) : null;
  return NextResponse.json(describeBadge(org, status?.percent ?? null));
}

/** PATCH { enabled } — включить (код создаётся при первом включении) или выключить. */
export async function PATCH(request: Request) {
  const { session, orgId, denied } = await guard();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const current = await db.organization.findUnique({ where: { id: orgId }, select: { badgeCode: true } });
  const org = await db.organization.update({
    where: { id: orgId },
    data: { badgeEnabled: body.enabled, ...(body.enabled && !current?.badgeCode ? { badgeCode: generateBadgeCode() } : {}) },
    select: { badgeEnabled: true, badgeCode: true },
  });
  await recordAuditLog({
    organizationId: orgId,
    session,
    request,
    action: body.enabled ? "badge.enable" : "badge.disable",
    entity: "Organization",
    entityId: orgId,
  });
  const status = org.badgeEnabled ? await getBadgeStatusForOrganization(orgId) : null;
  return NextResponse.json(describeBadge(org, status?.percent ?? null));
}

/** POST — перевыпустить код: старые ссылки и вставки перестают работать. */
export async function POST(request: Request) {
  const { session, orgId, denied } = await guard();
  if (denied) return denied;
  const org = await db.organization.update({
    where: { id: orgId },
    data: { badgeCode: generateBadgeCode() },
    select: { badgeEnabled: true, badgeCode: true },
  });
  await recordAuditLog({ organizationId: orgId, session, request, action: "badge.rotate", entity: "Organization", entityId: orgId });
  const status = org.badgeEnabled ? await getBadgeStatusForOrganization(orgId) : null;
  return NextResponse.json(describeBadge(org, status?.percent ?? null));
}
