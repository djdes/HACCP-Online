import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { paperJournalById } from "@/lib/sphere-journal-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Документы бумажного журнала: список и создание.
 *
 * Бумажный журнал ведётся так же, как электронный: заводим документ на
 * период, заполняем, закрываем. Разница только в том, что оригиналом
 * остаётся распечатанный лист с живыми подписями — здесь хранится
 * подготовка к печати, чтобы не перезаполнять бланк каждый раз.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { id } = await params;
  const documents = await db.paperJournalDocument.findMany({
    where: { organizationId: getActiveOrgId(session), journalId: id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ documents });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { id } = await params;
  const journal = paperJournalById(id);
  if (!journal) {
    return NextResponse.json({ error: "Журнал не найден" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const title =
    String(body?.title ?? "").trim() ||
    `${journal.name} — ${new Date().toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    })}`;

  const document = await db.paperJournalDocument.create({
    data: {
      organizationId: getActiveOrgId(session),
      journalId: id,
      title,
      rows,
      responsible: String(body?.responsible ?? "").trim() || null,
      createdById: session.user.id,
    },
    select: { id: true, title: true, status: true },
  });

  return NextResponse.json({ document });
}
