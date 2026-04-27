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
import { resolveJournalPeriod } from "@/lib/journal-period";

export type CreateReport = {
  code: string;
  name: string;
  created: boolean;
  documentId: string;
  reason?: string;
};

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

  const period = resolveJournalPeriod(args.templateCode, now);
  const doc = await db.journalDocument.create({
    data: {
      organizationId: args.organizationId,
      templateId: template.id,
      title: `${template.name} · ${period.label}`,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
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

/**
 * Look-ahead создание: если активный документ заканчивается через
 * `lookaheadDays` дней или меньше, создаёт документ на следующий период
 * (тот же шаблон, период вычисляется через resolveJournalPeriod на
 * dateTo+1d). Используется в ежедневном cron — за неделю до конца
 * месяца уже есть готовый documеnt на следующий месяц, без сюрприза
 * 1-го числа.
 *
 * Идемпотентно: если следующий документ уже существует — skip с
 * `reason="next-period-exists"`.
 */
export async function ensureNextPeriodDocument(
  db: PrismaClient,
  args: {
    organizationId: string;
    templateCode: string;
    lookaheadDays?: number;
    now?: Date;
  }
): Promise<CreateReport> {
  const now = args.now ?? new Date();
  const lookaheadMs = (args.lookaheadDays ?? 7) * 24 * 60 * 60 * 1000;
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

  const current = await db.journalDocument.findFirst({
    where: {
      organizationId: args.organizationId,
      templateId: template.id,
      status: "active",
      dateFrom: { lte: now },
      dateTo: { gte: now },
    },
    select: { id: true, dateTo: true },
    orderBy: { dateFrom: "desc" },
  });
  if (!current) {
    return {
      code: args.templateCode,
      name: template.name,
      created: false,
      documentId: "",
      reason: "no-current-active",
    };
  }

  // Сколько до конца? Если > lookaheadDays — рано, не создаём.
  if (current.dateTo.getTime() - now.getTime() > lookaheadMs) {
    return {
      code: args.templateCode,
      name: template.name,
      created: false,
      documentId: current.id,
      reason: "too-early",
    };
  }

  // Период следующего: resolveJournalPeriod(current.dateTo + 1d).
  const nextStart = new Date(current.dateTo.getTime() + 24 * 60 * 60 * 1000);
  const nextPeriod = resolveJournalPeriod(args.templateCode, nextStart);

  // Не создаём, если следующий период идентичен текущему (perpetual / single-day).
  if (
    nextPeriod.dateFrom.getTime() === current.dateTo.getTime() ||
    nextPeriod.dateFrom.getTime() <= current.dateTo.getTime()
  ) {
    return {
      code: args.templateCode,
      name: template.name,
      created: false,
      documentId: current.id,
      reason: "no-next-period",
    };
  }

  // Дубликат-защита: документ на следующий период уже создан?
  const existingNext = await db.journalDocument.findFirst({
    where: {
      organizationId: args.organizationId,
      templateId: template.id,
      status: "active",
      dateFrom: nextPeriod.dateFrom,
    },
    select: { id: true },
  });
  if (existingNext) {
    return {
      code: args.templateCode,
      name: template.name,
      created: false,
      documentId: existingNext.id,
      reason: "next-period-exists",
    };
  }

  const doc = await db.journalDocument.create({
    data: {
      organizationId: args.organizationId,
      templateId: template.id,
      title: `${template.name} · ${nextPeriod.label}`,
      dateFrom: nextPeriod.dateFrom,
      dateTo: nextPeriod.dateTo,
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
    reason: "next-period-created",
  };
}
