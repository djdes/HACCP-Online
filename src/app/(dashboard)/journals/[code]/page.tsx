import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { HygieneDocumentsClient } from "@/components/journals/hygiene-documents-client";
import {
  buildDateKeys,
  buildExampleHygieneEntryMap,
  buildHygieneExampleEmployees,
  getHygieneDefaultResponsibleTitle,
  getHygieneDocumentTitle,
  getHygienePeriodLabel,
  getHygieneSeedDocumentConfigs,
} from "@/lib/hygiene-document";

export const dynamic = "force-dynamic";

async function ensureHygieneSampleDocuments({
  organizationId,
  templateId,
  users,
  createdById,
}: {
  organizationId: string;
  templateId: string;
  users: { id: string; name: string; role: string }[];
  createdById: string;
}) {
  const existingDocuments = await db.journalDocument.findMany({
    where: {
      organizationId,
      templateId,
    },
    select: {
      status: true,
      dateFrom: true,
      dateTo: true,
    },
  });

  const existingKeys = new Set(
    existingDocuments.map((document) => {
      const from = document.dateFrom.toISOString().slice(0, 10);
      const to = document.dateTo.toISOString().slice(0, 10);
      return `${document.status}:${from}:${to}`;
    })
  );

  const responsibleUser =
    users.find((user) => user.role === "owner") ||
    users.find((user) => user.role === "technologist") ||
    users[0] ||
    null;

  const employeeIds = buildHygieneExampleEmployees(users)
    .filter((employee) => !employee.id.startsWith("blank-"))
    .map((employee) => employee.id);

  for (const config of getHygieneSeedDocumentConfigs()) {
    const key = `${config.status}:${config.dateFrom}:${config.dateTo}`;
    if (existingKeys.has(key)) continue;

    const document = await db.journalDocument.create({
      data: {
        templateId,
        organizationId,
        title: config.title,
        status: config.status,
        dateFrom: new Date(config.dateFrom),
        dateTo: new Date(config.dateTo),
        responsibleUserId: responsibleUser?.id || null,
        responsibleTitle: getHygieneDefaultResponsibleTitle(users),
        createdById,
      },
    });

    if (employeeIds.length === 0) continue;

    const dateKeys = buildDateKeys(config.dateFrom, config.dateTo);
    const entryMap = buildExampleHygieneEntryMap(employeeIds, dateKeys);
    const entries = Object.entries(entryMap).map(([compoundKey, data]) => {
      const separatorIndex = compoundKey.lastIndexOf(":");
      const employeeId = compoundKey.slice(0, separatorIndex);
      const dateKey = compoundKey.slice(separatorIndex + 1);

      return {
        documentId: document.id,
        employeeId,
        date: new Date(dateKey),
        data,
      };
    });

    if (entries.length > 0) {
      await db.journalDocumentEntry.createMany({ data: entries });
    }
  }
}

export default async function JournalDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { code } = await params;
  const { tab } = await searchParams;
  const session = await requireAuth();

  const template = await db.journalTemplate.findUnique({
    where: { code },
  });

  if (!template) {
    notFound();
  }

  const activeTab = tab === "closed" ? "closed" : "active";

  const orgUsers = await db.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      isActive: true,
    },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  if (code === "hygiene") {
    await ensureHygieneSampleDocuments({
      organizationId: session.user.organizationId,
      templateId: template.id,
      users: orgUsers,
      createdById: session.user.id,
    });

    const documents = await db.journalDocument.findMany({
      where: {
        organizationId: session.user.organizationId,
        templateId: template.id,
        status: activeTab,
      },
      orderBy: { dateFrom: "asc" },
    });

    return (
      <HygieneDocumentsClient
        activeTab={activeTab}
        templateCode={code}
        templateName={template.name}
        users={orgUsers}
        documents={documents.map((document) => ({
          id: document.id,
          title: document.title || getHygieneDocumentTitle(),
          status: document.status as "active" | "closed",
          responsibleTitle: document.responsibleTitle,
          periodLabel: getHygienePeriodLabel(document.dateFrom, document.dateTo),
        }))}
      />
    );
  }

  const documents = await db.journalDocument.findMany({
    where: {
      organizationId: session.user.organizationId,
      templateId: template.id,
      status: activeTab,
    },
    orderBy: { dateFrom: "desc" },
  });

  return (
    <div className="space-y-3">
      {documents.map((document) => (
        <div key={document.id}>{document.title}</div>
      ))}
    </div>
  );
}
