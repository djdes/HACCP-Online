import { NextResponse } from "next/server";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { renderPaperJournalPdf } from "@/lib/paper-journal-pdf";
import { getVisibleOrgBranding } from "@/lib/partners/branding";
import { paperJournalById } from "@/lib/sphere-journal-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Бланк бумажного журнала.
 *
 * GET — чистый бланк (кнопка «Скачать бланк»), POST — тот же бланк с уже
 * вписанными строками со страницы «Заполнить и распечатать». Ничего не
 * сохраняем: эти журналы живут на бумаге, в БД им места нет.
 */

async function build(id: string, rows: string[][] | undefined) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  const journal = paperJournalById(id);
  if (!journal) {
    return NextResponse.json({ error: "Бланк не найден" }, { status: 404 });
  }
  const organizationId = getActiveOrgId(session);
  const [organization, branding] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, inn: true, address: true },
    }),
    getVisibleOrgBranding(organizationId),
  ]);

  const pdf = renderPaperJournalPdf({
    journal,
    organization: organization ?? { name: "Организация" },
    rows,
    branding: branding ? { brandName: branding.brandName, pdfSignature: branding.pdfSignature } : null,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${journal.id}.pdf"`,
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return build(id, undefined);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows)
    ? (body.rows as unknown[])
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) => row.map((cell) => String(cell ?? "")))
    : undefined;
  return build(id, rows);
}
