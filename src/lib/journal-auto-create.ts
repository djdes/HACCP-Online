/**
 * Helper'ы для автосоздания документов журналов.
 *
 * Используется двумя точками входа:
 *   - POST /api/journal-documents/bulk-create — менеджер нажимает
 *     «Создать все выбранные» на /journals
 *   - POST /api/cron/auto-create-journals — дневной cron, создаёт
 *     документы по списку из Organization.autoJournalCodes
 *
 * Семантика: для каждого templateCode, не имеющего активного документа
 * с dateFrom ≤ today ≤ dateTo, создаём документ на ТЕКУЩИЙ месяц
 * (1-е → последнее число). Уже существующий активный документ не
 * трогаем — возвращаем существующий id, чтобы клиент мог отправить в
 * отчёте «уже был».
 */
import type { PrismaClient } from "@prisma/client";

export type CreateReport = {
  code: string;
  name: string;
  created: boolean;
  documentId: string;
  reason?: string;
};

function monthBounds(now: Date): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m, 1)),
    to: new Date(Date.UTC(y, m + 1, 0)),
  };
}

function monthLabel(now: Date): string {
  return now.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

export async function ensureActiveDocument(
  db: PrismaClient,
  args: {
    organizationId: string;
    templateCode: string;
    now?: Date;
  }
): Promise<CreateReport> {
  const now = args.now ?? new Date();
  const template = await db.journalTemplate.findFirst({
    where: { code: args.templateCode, isActive: true },
    select: { id: true, name: true },
  });
  if (!template) {
    return {
      code: args.templateCode,
      name: args.templateCode,
      created: false,
      documentId: "",
      reason: "template-not-found",
    };
  }

  const existing = await db.journalDocument.findFirst({
    where: {
      organizationId: args.organizationId,
      templateId: template.id,
      status: "active",
      dateFrom: { lte: now },
      dateTo: { gte: now },
    },
    select: { id: true, title: true },
  });
  if (existing) {
    return {
      code: args.templateCode,
      name: template.name,
      created: false,
      documentId: existing.id,
      reason: "already-active",
    };
  }

  const bounds = monthBounds(now);
  const doc = await db.journalDocument.create({
    data: {
      organizationId: args.organizationId,
      templateId: template.id,
      title: `${template.name} · ${monthLabel(now)}`,
      dateFrom: bounds.from,
      dateTo: bounds.to,
      status: "active",
      config: {},
    },
    select: { id: true },
  });
  return {
    code: args.templateCode,
    name: template.name,
    created: true,
    documentId: doc.id,
  };
}

export async function ensureDocumentsFor(
  db: PrismaClient,
  args: {
    organizationId: string;
    templateCodes: string[];
    now?: Date;
  }
): Promise<CreateReport[]> {
  const results: CreateReport[] = [];
  for (const code of args.templateCodes) {
    results.push(
      await ensureActiveDocument(db, {
        organizationId: args.organizationId,
        templateCode: code,
        now: args.now,
      })
    );
  }
  return results;
}
