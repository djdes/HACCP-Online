import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { HealthDocumentClient } from "@/components/journals/health-document-client";
import { HygieneDocumentClient } from "@/components/journals/hygiene-document-client";
import {
  normalizeHealthEntryData,
  normalizeHygieneEntryData,
  toDateKey,
} from "@/lib/hygiene-document";

export const dynamic = "force-dynamic";

export default async function JournalDocumentPage({
  params,
}: {
  params: Promise<{ code: string; docId: string }>;
}) {
  const { code, docId } = await params;
  const session = await requireAuth();

  const [document, organization, employees] = await Promise.all([
    db.journalDocument.findUnique({
      where: { id: docId },
      include: {
        template: true,
        entries: {
          orderBy: [{ employeeId: "asc" }, { date: "asc" }],
        },
      },
    }),
    db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    }),
    db.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      select: { id: true, name: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);

  if (
    !document ||
    document.organizationId !== session.user.organizationId ||
    document.template.code !== code
  ) {
    notFound();
  }

  if (document.template.code === "hygiene") {
    return (
      <HygieneDocumentClient
        documentId={document.id}
        title={document.title}
        organizationName={organization?.name || 'ООО "Тест"'}
        dateFrom={toDateKey(document.dateFrom)}
        dateTo={toDateKey(document.dateTo)}
        responsibleTitle={document.responsibleTitle}
        responsibleName={null}
        status={document.status}
        autoFill={document.autoFill}
        employees={employees}
        initialEntries={document.entries.map((entry) => ({
          employeeId: entry.employeeId,
          date: toDateKey(entry.date),
          data: normalizeHygieneEntryData(entry.data),
        }))}
      />
    );
  }

  if (document.template.code === "health_check") {
    return (
      <HealthDocumentClient
        documentId={document.id}
        title={document.title}
        organizationName={organization?.name || 'ООО "Тест"'}
        dateFrom={toDateKey(document.dateFrom)}
        dateTo={toDateKey(document.dateTo)}
        responsibleTitle={document.responsibleTitle}
        status={document.status}
        autoFill={document.autoFill}
        employees={employees}
        initialEntries={document.entries.map((entry) => ({
          employeeId: entry.employeeId,
          date: toDateKey(entry.date),
          data: normalizeHealthEntryData(entry.data),
        }))}
      />
    );
  }

  notFound();
}
