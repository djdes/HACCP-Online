import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { cancelOrganizationDeletion, requestOrganizationDeletion } from "@/lib/org-deletion";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { confirmName } — запланировать удаление через 30 дней; DELETE — отменить. */
export async function POST(request: Request) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user) || session.user.isRoot) return NextResponse.json({ error: "Доступно руководителям" }, { status: 403 });
  const orgId = getActiveOrgId(session);
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true, deletionRequestedAt: true, isDemo: true } });
  if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  if (org.isDemo) return NextResponse.json({ error: "Демо-организацию удалить нельзя" }, { status: 409 });
  const body = (await request.json().catch(() => ({}))) as { confirmName?: unknown };
  if (typeof body.confirmName !== "string" || body.confirmName.trim() !== org.name.trim()) {
    return NextResponse.json({ error: "Введите название организации точно как в настройках" }, { status: 400 });
  }
  if (org.deletionRequestedAt) return NextResponse.json({ error: "Удаление уже запланировано" }, { status: 409 });
  const { dueAt } = await requestOrganizationDeletion(orgId, session.user.id);
  await recordAuditLog({ organizationId: orgId, session, request, action: "organization.deletion.request", entity: "Organization", entityId: orgId, details: { dueAt: dueAt.toISOString() } });
  return NextResponse.json({ ok: true, dueAt: dueAt.toISOString() });
}

export async function DELETE(request: Request) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) return NextResponse.json({ error: "Доступно руководителям" }, { status: 403 });
  const orgId = getActiveOrgId(session);
  await cancelOrganizationDeletion(orgId);
  await recordAuditLog({ organizationId: orgId, session, request, action: "organization.deletion.cancel", entity: "Organization", entityId: orgId });
  return NextResponse.json({ ok: true });
}
