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
import {
  parseJournalPeriodsJson,
  resolveJournalPeriod,
} from "@/lib/journal-period";
import { prefillResponsiblesForNewDocument } from "@/lib/journal-responsibles-cascade";
import { seedEntriesForDocument } from "@/lib/journal-document-entries-seed";
import {
  applyRoomScheduleToMatrix,
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  normalizeCleaningDocumentConfig,
  type CleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { buildDateKeys } from "@/lib/hygiene-document";

/**
 * Cleaning-specific post-process: применяет weekday-маски помещений
 * (CleaningRoomItem.currentDays/generalDays) к matrix нового документа,
 * чтобы матрица была размечена «по плану» с самого создания.
 *
 * Возвращает config как-есть для других журналов (no-op).
 */
function preplanCleaningConfig(
  templateCode: string,
  config: unknown,
  dateFrom: Date,
  dateTo: Date,
): unknown {
  if (templateCode !== CLEANING_DOCUMENT_TEMPLATE_CODE) return config;
  if (!config || typeof config !== "object") return config;
  const dateKeys = buildDateKeys(dateFrom, dateTo);
  // Нормализуем чтобы гарантировать структуру (rooms[], matrix etc.).
  const normalized = normalizeCleaningDocumentConfig(config) as CleaningDocumentConfig;
  return applyRoomScheduleToMatrix(normalized, dateKeys, "fill-empty");
}

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

  // Сравниваем с началом UTC-дня — иначе для monthly/half-monthly/
  // single-day/yearly документ создаётся с dateTo=00:00 UTC последнего
  // дня периода, а query `dateTo: { gte: now }` где now=10:00 UTC
  // возвращает false → каждый вызов плодит новый документ. (См.
  // тот же фикс в bulk-assign-today/route.ts от 2026-04-30.)
  const todayUtcStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const existing = await db.journalDocument.findFirst({
    where: {
      organizationId: args.organizationId,
      templateId: template.id,
      status: "active",
      dateFrom: { lte: todayUtcStart },
      dateTo: { gte: todayUtcStart },
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

  // Если у org есть per-template override периода (см.
  // /settings/journals — period column) — подмешиваем его в
  // resolveJournalPeriod. Иначе fallback на дефолтную семантику.
  const orgRow = await db.organization.findUnique({
    where: { id: args.organizationId },
    select: { journalPeriods: true },
  });
  const overrides = parseJournalPeriodsJson(orgRow?.journalPeriods ?? null);
  const period = resolveJournalPeriod(args.templateCode, now, overrides);
  // Подтягиваем сохранённых в /settings/journal-responsibles
  // ответственных в config + responsibleUserId.
  const prefill = await prefillResponsiblesForNewDocument({
    organizationId: args.organizationId,
    journalCode: args.templateCode,
    baseConfig: {},
  });
  const planCfg = preplanCleaningConfig(
    args.templateCode,
    prefill.config,
    period.dateFrom,
    period.dateTo,
  );
  const doc = await db.journalDocument.create({
    data: {
      organizationId: args.organizationId,
      templateId: template.id,
      title: `${template.name} · ${period.label}`,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      status: "active",
      autoFill: false,
      config: planCfg as never,
      responsibleUserId: prefill.responsibleUserId,
      verifierUserId: prefill.verifierUserId,
    },
    select: { id: true, dateFrom: true, dateTo: true },
  });
  await seedEntriesForDocument({
    documentId: doc.id,
    journalCode: args.templateCode,
    organizationId: args.organizationId,
    dateFrom: doc.dateFrom,
    dateTo: doc.dateTo,
    responsibleUserId: prefill.responsibleUserId,
  }).catch((err) => {
    console.warn(
      `[journal-auto-create] seedEntries failed for ${args.templateCode}`,
      err
    );
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

  // Сравниваем с началом UTC-дня — см. фикс выше.
  const lookaheadTodayUtcStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const current = await db.journalDocument.findFirst({
    where: {
      organizationId: args.organizationId,
      templateId: template.id,
      status: "active",
      dateFrom: { lte: lookaheadTodayUtcStart },
      dateTo: { gte: lookaheadTodayUtcStart },
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

  // Период следующего: resolveJournalPeriod(current.dateTo + 1d) с
  // учётом per-template override организации.
  const nextStart = new Date(current.dateTo.getTime() + 24 * 60 * 60 * 1000);
  const orgRowNext = await db.organization.findUnique({
    where: { id: args.organizationId },
    select: { journalPeriods: true },
  });
  const nextOverrides = parseJournalPeriodsJson(
    orgRowNext?.journalPeriods ?? null
  );
  const nextPeriod = resolveJournalPeriod(
    args.templateCode,
    nextStart,
    nextOverrides
  );

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

  const prefillNext = await prefillResponsiblesForNewDocument({
    organizationId: args.organizationId,
    journalCode: args.templateCode,
    baseConfig: {},
  });
  const planCfgNext = preplanCleaningConfig(
    args.templateCode,
    prefillNext.config,
    nextPeriod.dateFrom,
    nextPeriod.dateTo,
  );
  const doc = await db.journalDocument.create({
    data: {
      organizationId: args.organizationId,
      templateId: template.id,
      title: `${template.name} · ${nextPeriod.label}`,
      dateFrom: nextPeriod.dateFrom,
      dateTo: nextPeriod.dateTo,
      status: "active",
      autoFill: false,
      config: planCfgNext as never,
      responsibleUserId: prefillNext.responsibleUserId,
      // Phase C: verifierUserId — двухступенчатая проверка не работает
      // без него, заведующая не получает «проверь когда заполнят»
      // в TasksFlow. (Ранее терялся в next-period auto-create — см.
      // тот же фикс в recreate-documents/route.ts.)
      verifierUserId: prefillNext.verifierUserId,
    },
    select: { id: true, dateFrom: true, dateTo: true },
  });
  await seedEntriesForDocument({
    documentId: doc.id,
    journalCode: args.templateCode,
    organizationId: args.organizationId,
    dateFrom: doc.dateFrom,
    dateTo: doc.dateTo,
    responsibleUserId: prefillNext.responsibleUserId,
  }).catch((err) => {
    console.warn(
      `[journal-auto-create:next] seedEntries failed for ${args.templateCode}`,
      err
    );
  });
  return {
    code: args.templateCode,
    name: template.name,
    created: true,
    documentId: doc.id,
    reason: "next-period-created",
  };
}
