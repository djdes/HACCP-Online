import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Один документ бумажного журнала: чтение, сохранение, закрытие, удаление. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { id, docId } = await params;
  const document = await db.paperJournalDocument.findFirst({
    where: {
      id: docId,
      journalId: id,
      organizationId: getActiveOrgId(session),
    },
  });
  if (!document) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json({ document });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { id, docId } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (Array.isArray(body?.rows)) patch.rows = body.rows;
  if (typeof body?.responsible === "string") {
    patch.responsible = body.responsible.trim() || null;
  }
  if (typeof body?.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  // Закрытие — отдельным флагом: правки закрытого документа не принимаем,
  // иначе «закрыт» перестаёт что-либо значить.
  if (body?.status === "closed") {
    patch.status = "closed";
    patch.closedAt = new Date();
  }
  if (body?.status === "active") {
    patch.status = "active";
    patch.closedAt = null;
  }

  const result = await db.paperJournalDocument.updateMany({
    where: {
      id: docId,
      journalId: id,
      organizationId: getActiveOrgId(session),
      ...(body?.status ? {} : { status: "active" }),
    },
    data: patch,
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Документ не найден или уже закрыт" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { id, docId } = await params;
  await db.paperJournalDocument.deleteMany({
    where: {
      id: docId,
      journalId: id,
      organizationId: getActiveOrgId(session),
    },
  });
  return NextResponse.json({ ok: true });
}
