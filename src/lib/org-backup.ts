import { db } from "@/lib/db";

/**
 * Собирает полный JSON-снимок журнальных данных одной организации
 * за указанный период. Используется в /api/cron/yandex-backup и
 * /api/settings/yandex-backup/run для ручного запуска.
 *
 * Цель — дать ресторатору «всё что есть, в одном файле» если WeSetup
 * вдруг исчезнет. Поэтому здесь намеренно дублируется человекочитаемая
 * мета (названия журналов, ФИО) — чтобы JSON можно было открыть и
 * понять без обращения к БД.
 */
export async function buildOrgBackup(
  organizationId: string,
  fromDate: Date,
  toDate: Date
) {
  const [
    organization,
    users,
    templates,
    documents,
    documentEntries,
    fieldEntries,
    capaTickets,
    lossRecords,
  ] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        type: true,
        inn: true,
        address: true,
        phone: true,
      },
    }),
    db.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        positionTitle: true,
        isActive: true,
        archivedAt: true,
      },
    }),
    db.journalTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isMandatorySanpin: true,
        isMandatoryHaccp: true,
      },
    }),
    db.journalDocument.findMany({
      where: {
        organizationId,
        OR: [
          { dateFrom: { lte: toDate, gte: fromDate } },
          { dateTo: { lte: toDate, gte: fromDate } },
          { AND: [{ dateFrom: { lte: fromDate } }, { dateTo: { gte: toDate } }] },
        ],
      },
      select: {
        id: true,
        templateId: true,
        title: true,
        config: true,
        dateFrom: true,
        dateTo: true,
        responsibleUserId: true,
        responsibleTitle: true,
        status: true,
        createdAt: true,
        template: { select: { code: true, name: true } },
      },
    }),
    db.journalDocumentEntry.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        document: { organizationId },
      },
      select: {
        id: true,
        documentId: true,
        employeeId: true,
        date: true,
        data: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { name: true, positionTitle: true } },
      },
    }),
    db.journalEntry.findMany({
      where: {
        organizationId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        templateId: true,
        areaId: true,
        equipmentId: true,
        filledById: true,
        data: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        template: { select: { code: true, name: true } },
        filledBy: { select: { name: true } },
      },
    }),
    db.capaTicket.findMany({
      where: {
        organizationId,
        createdAt: { gte: fromDate, lte: toDate },
      },
    }),
    db.lossRecord.findMany({
      where: {
        organizationId,
        date: { gte: fromDate, lte: toDate },
      },
    }),
  ]);

  return {
    schema: "wesetup-backup-v1",
    generatedAt: new Date().toISOString(),
    organization,
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
    counts: {
      users: users.length,
      templates: templates.length,
      documents: documents.length,
      documentEntries: documentEntries.length,
      fieldEntries: fieldEntries.length,
      capaTickets: capaTickets.length,
      lossRecords: lossRecords.length,
    },
    users,
    journalTemplates: templates,
    journalDocuments: documents,
    journalDocumentEntries: documentEntries,
    journalEntries: fieldEntries,
    capaTickets,
    lossRecords,
  };
}
