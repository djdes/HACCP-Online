import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/settings/journal-checklists/items/[id] — обновить пункт.
 *   Body: {label?, required?, hint?, sortOrder?}.
 *
 * DELETE — soft-delete (archivedAt = now). Старые JournalChecklistCheck
 * сохраняются по FK для аудита. Удалённый пункт не показывается ни
 * в settings ни в task-fill.
 */
const UpdateBody = z.object({
  label: z.string().min(1).max(200).optional(),
  required: z.boolean().optional(),
  hint: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasCapability(session.user, "admin.full")) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = UpdateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Неверный формат тела запроса", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await db.journalChecklistItem.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Пункт не найден" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) data.label = parsed.data.label.trim();
  if (parsed.data.required !== undefined) data.required = parsed.data.required;
  if (parsed.data.hint !== undefined)
    data.hint = parsed.data.hint?.trim() || null;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

  const item = await db.journalChecklistItem.update({
    where: { id },
    data,
  });

  await recordAuditLog({
    request,
    session,
    organizationId,
    action: "checklist.item.update",
    entity: "JournalChecklistItem",
    entityId: id,
    details: {
      journalCode: existing.journalCode,
      changes: parsed.data,
      previousLabel: existing.label,
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasCapability(session.user, "admin.full")) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);
  const { id } = await params;

  const existing = await db.journalChecklistItem.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Пункт не найден" }, { status: 404 });
  }

  await db.journalChecklistItem.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  await recordAuditLog({
    request,
    session,
    organizationId,
    action: "checklist.item.delete",
    entity: "JournalChecklistItem",
    entityId: id,
    details: {
      journalCode: existing.journalCode,
      label: existing.label,
    },
  });

  return NextResponse.json({ ok: true });
}
