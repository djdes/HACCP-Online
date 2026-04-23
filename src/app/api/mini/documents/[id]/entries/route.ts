import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasJournalAccess } from "@/lib/journal-acl";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orgId = getActiveOrgId(session);

  const doc = await db.journalDocument.findFirst({
    where: { id, organizationId: orgId },
    include: {
      template: { select: { code: true, name: true, fields: true } },
      entries: {
        include: { employee: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await hasJournalAccess(
    { id: session.user.id, role: session.user.role, isRoot: session.user.isRoot === true },
    doc.template.code
  );
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      dateFrom: doc.dateFrom,
      dateTo: doc.dateTo,
      status: doc.status,
    },
    template: doc.template,
    entries: doc.entries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      employeeName: e.employee.name,
      date: e.date,
      data: e.data,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orgId = getActiveOrgId(session);

  const doc = await db.journalDocument.findFirst({
    where: { id, organizationId: orgId },
    include: { template: { select: { code: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    employeeId?: string;
    date?: string;
    data?: Record<string, unknown>;
  };

  if (!body.employeeId || !body.date || !body.data) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const entry = await db.journalDocumentEntry.upsert({
    where: {
      documentId_employeeId_date: {
        documentId: id,
        employeeId: body.employeeId,
        date: new Date(body.date),
      },
    },
    update: { data: body.data as never },
    create: {
      documentId: id,
      employeeId: body.employeeId,
      date: new Date(body.date),
      data: body.data as never,
    },
  });

  return NextResponse.json({ entry });
}
