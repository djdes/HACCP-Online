import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings/journal-checklists/[code] — список не-архивных
 * пунктов чек-листа для журнала. Доступно админу/руководителю.
 *
 * POST — создать новый пункт. Body: {label, required?, hint?}.
 *        sortOrder автоматически = max + 1.
 */
const CreateBody = z.object({
  label: z.string().min(1).max(200),
  required: z.boolean().optional(),
  hint: z.string().max(500).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const organizationId = getActiveOrgId(session);
  const { code } = await params;

  const items = await db.journalChecklistItem.findMany({
    where: { organizationId, journalCode: code, archivedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasCapability(session.user, "admin.full")) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);
  const { code } = await params;

  const body = await request.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Неверный формат тела запроса", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // sortOrder = next after max существующего.
  const lastItem = await db.journalChecklistItem.findFirst({
    where: { organizationId, journalCode: code, archivedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (lastItem?.sortOrder ?? -1) + 1;

  const item = await db.journalChecklistItem.create({
    data: {
      organizationId,
      journalCode: code,
      label: parsed.data.label.trim(),
      required: parsed.data.required ?? true,
      hint: parsed.data.hint?.trim() || null,
      sortOrder,
      createdByUserId: session.user.id,
    },
  });

  await recordAuditLog({
    request,
    session,
    organizationId,
    action: "checklist.item.create",
    entity: "JournalChecklistItem",
    entityId: item.id,
    details: {
      journalCode: code,
      label: item.label,
      required: item.required,
      hint: item.hint,
    },
  });

  return NextResponse.json({ item });
}
