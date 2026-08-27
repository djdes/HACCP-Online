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
  resolveJournalPeriodKind,
  type JournalPeriodKind,
  type JournalPeriodOverrideMap,
} from "@/lib/journal-period";
import { prefillResponsiblesForNewDocument } from "@/lib/journal-responsibles-cascade";
import { seedEntriesForDocument } from "@/lib/journal-document-entries-seed";
import {
  applyRoomScheduleToMatrix,
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  fillPastDaysNotPerformed,
  normalizeCleaningDocumentConfig,
  stripPeriodSpecificCleaningFields,
  type CleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { buildDateKeys, toDateKey } from "@/lib/hygiene-document";

/**
 * Возвращает config самого свежего предыдущего JournalDocument
 * (org + template), очищенный от period-specific полей. Для cleaning
 * это matrix/marks; для других журналов пока — null (можем расширить).
 *
 * Используется чтобы новый период cleaning создавался «как прошлый»:
 * те же rooms, ответственные, weekday-маски. Без этого cron каждый
 * месяц генерил пустой документ из DEFAULT_ROOM_BLUEPRINTS, и менеджеру
 * приходилось заново настраивать комнаты.
 */
async function fetchPreviousDocConfigForReuse(
  db: PrismaClient,
  organizationId: string,
  templateCode: string,
): Promise<Record<string, unknown> | null> {
  if (templateCode !== CLEANING_DOCUMENT_TEMPLATE_CODE) return null;
  const prev = await db.journalDocument.findFirst({
    where: {
      organizationId,
      template: { code: templateCode },
    },
    orderBy: [{ dateFrom: "desc" }, { createdAt: "desc" }],
    select: { config: true },
  });
  return stripPeriodSpecificCleaningFields(prev?.config);
}

/**
 * Cleaning-specific post-process: применяет weekday-маски помещений
 * (CleaningRoomItem.currentDays/generalDays) к matrix нового документа,
 * чтобы матрица была размечена «по плану» с самого создания.
 *
 * Затем прошедшие дни периода, оставшиеся без плановой отметки,
 * помечаются «/» («уборка не проводилась») — как на эталоне. Актуально
 * для догоняющего создания (документ создан не 1-го числа): дни с
 * начала периода до вчера не остаются пустыми.
 *
 * Возвращает config как-есть для других журналов (no-op).
 */
function preplanCleaningConfig(
  templateCode: string,
  config: unknown,
  dateFrom: Date,
  dateTo: Date,
  now?: Date,
): unknown {
  if (templateCode !== CLEANING_DOCUMENT_TEMPLATE_CODE) return config;
  if (!config || typeof config !== "object") return config;
  const dateKeys = buildDateKeys(dateFrom, dateTo);
  // Нормализуем чтобы гарантировать структуру (rooms[], matrix etc.).
  const normalized = normalizeCleaningDocumentConfig(config) as CleaningDocumentConfig;
  const planned = applyRoomScheduleToMatrix(normalized, dateKeys, "fill-empty");
  return fillPastDaysNotPerformed(planned, dateKeys, {
    todayKey: toDateKey(now ?? new Date()),
  });
}

/**
 * Периоды, документы которых НЕ закрываем автоматически:
 *   • perpetual — open-ended журнал (дезсредства, чек-лист сан-дня),
 *     dateTo = 2099-12-31, он и не истекает;
 *   • yearly — медкнижки, график генеральных уборок и пр. Такие
 *     документы менеджер закрывает вручную, автозакрытие по календарю
 *     ломало бы работу с прошлогодними записями.
 */
const NON_CLOSING_PERIOD_KINDS = new Set<JournalPeriodKind>([
  "perpetual",
  "yearly",
]);

function isAutoClosablePeriod(
  templateCode: string,
  overrides: JournalPeriodOverrideMap
): boolean {
  const override = overrides[templateCode];
  const kind: JournalPeriodKind = override
    ? override.kind
    : resolveJournalPeriodKind(templateCode);
  return !NON_CLOSING_PERIOD_KINDS.has(kind);
}

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

async function loadPeriodOverrides(
  db: PrismaClient,
  organizationId: string
): Promise<JournalPeriodOverrideMap> {
  const orgRow = await db.organization.findUnique({
    where: { id: organizationId },
    select: { journalPeriods: true },
  });
  return parseJournalPeriodsJson(orgRow?.journalPeriods ?? null);
}

/**
 * Догоняющий шаг: закрывает active-документы организации, чей период
 * уже истёк (dateTo < сегодня) И у которых есть документ-преемник
 * (тот же шаблон, dateFrom > dateTo текущего). Без преемника документ
 * не трогаем — иначе журнал остался бы совсем без активного документа.
 *
 * Статус `closed` — тот же, что ставит кнопка «Отправить в закрытые»
 * (DocumentCloseButton), новых статусов не вводим. Идемпотентно:
 * повторный вызов не находит active-документов и ничего не делает.
 */
export async function closeExpiredDocuments(
  db: PrismaClient,
  args: {
    organizationId: string;
    /** Ограничить одним шаблоном (используется после look-ahead create). */
    templateId?: string;
    now?: Date;
    overrides?: JournalPeriodOverrideMap;
  }
): Promise<{ closed: number; documentIds: string[] }> {
  const todayUtcStart = startOfUtcDay(args.now ?? new Date());
  const expired = await db.journalDocument.findMany({
    where: {
      organizationId: args.organizationId,
      status: "active",
      dateTo: { lt: todayUtcStart },
      ...(args.templateId ? { templateId: args.templateId } : {}),
    },
    select: {
      id: true,
      templateId: true,
      dateTo: true,
      template: { select: { code: true } },
    },
  });
  if (expired.length === 0) return { closed: 0, documentIds: [] };

  const overrides =
    args.overrides ?? (await loadPeriodOverrides(db, args.organizationId));
  const closedIds: string[] = [];

  for (const doc of expired) {
    const code = doc.template?.code;
    if (!code) continue;
    if (!isAutoClosablePeriod(code, overrides)) continue;

    const successor = await db.journalDocument.findFirst({
      where: {
        organizationId: args.organizationId,
        templateId: doc.templateId,
        dateFrom: { gt: doc.dateTo },
        id: { not: doc.id },
      },
      select: { id: true },
    });
    if (!successor) continue;

    const res = await db.journalDocument.updateMany({
      where: { id: doc.id, status: "active" },
      data: { status: "closed" },
    });
    if (res.count > 0) closedIds.push(doc.id);
  }

  return { closed: closedIds.length, documentIds: closedIds };
}

/**
 * Ответственный и проверяющий из ПОСЛЕДНЕГО документа шаблона. Оба
 * проверяются на «всё ещё сотрудник этой организации и активен» —
 * иначе новый документ получил бы ссылку на уволенного.
 */
async function inheritResponsiblesFromLastDocument(
  db: PrismaClient,
  args: { organizationId: string; templateId: string }
): Promise<{ responsibleUserId: string | null; verifierUserId: string | null }> {
  const last = await db.journalDocument.findFirst({
    where: {
      organizationId: args.organizationId,
      templateId: args.templateId,
    },
    orderBy: [{ dateFrom: "desc" }, { createdAt: "desc" }],
    select: { responsibleUserId: true, verifierUserId: true },
  });
  if (!last) return { responsibleUserId: null, verifierUserId: null };

  const candidateIds = [last.responsibleUserId, last.verifierUserId].filter(
    (id): id is string => Boolean(id)
  );
  if (candidateIds.length === 0) {
    return { responsibleUserId: null, verifierUserId: null };
  }
  const alive = await db.user.findMany({
    where: {
      id: { in: candidateIds },
      organizationId: args.organizationId,
      isActive: true,
    },
    select: { id: true },
  });
  const aliveIds = new Set(alive.map((user) => user.id));
  return {
    responsibleUserId:
      last.responsibleUserId && aliveIds.has(last.responsibleUserId)
        ? last.responsibleUserId
        : null,
    verifierUserId:
      last.verifierUserId && aliveIds.has(last.verifierUserId)
        ? last.verifierUserId
        : null,
  };
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
    /**
     * Если у журнала нет назначенных в /settings/journal-responsibles
     * ответственных — взять их из ПОСЛЕДНЕГО документа этого шаблона.
     * Нужно догоняющему созданию по прерванной цепочке: там документ
     * рождается через год после предыдущего, и терять ответственных
     * предыдущего документа нельзя. Пользователь всё ещё должен
     * состоять в организации и быть активным.
     */
    inheritResponsiblesFromLastDocument?: boolean;
    /**
     * Значение `JournalDocument.autoFill` у создаваемого документа.
     * По умолчанию `false` — исторически автосоздание давало «пустой»
     * документ, а автозаполнение включалось тумблером вручную. Cron
     * автоматизации (`/api/cron/journal-automation`) передаёт `true`,
     * иначе созданный им документ никто не заполнит.
     */
    autoFill?: boolean;
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
  // «Как прошлый журнал» — для cleaning подтягиваем config предыдущего
  // документа (rooms, ответственные, weekday-маски), отрезая matrix/marks
  // (период-специфика). Так новый месяц cleaning стартует не с пустоты,
  // а с настроек прошлого месяца. Для других журналов prevConfig=null,
  // prefillResponsibles берёт getDefaultConfigForJournal.
  const prevConfig = await fetchPreviousDocConfigForReuse(
    db,
    args.organizationId,
    args.templateCode,
  );
  // Подтягиваем сохранённых в /settings/journal-responsibles
  // ответственных в config + responsibleUserId.
  const prefill = await prefillResponsiblesForNewDocument({
    organizationId: args.organizationId,
    journalCode: args.templateCode,
    baseConfig: prevConfig ?? {},
  });
  const planCfg = preplanCleaningConfig(
    args.templateCode,
    prefill.config,
    period.dateFrom,
    period.dateTo,
    now,
  );
  const inherited = args.inheritResponsiblesFromLastDocument
    ? await inheritResponsiblesFromLastDocument(db, {
        organizationId: args.organizationId,
        templateId: template.id,
      })
    : { responsibleUserId: null, verifierUserId: null };
  const doc = await db.journalDocument.create({
    data: {
      organizationId: args.organizationId,
      templateId: template.id,
      title: `${template.name} · ${period.label}`,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      status: "active",
      autoFill: args.autoFill === true,
      config: planCfg as never,
      responsibleUserId:
        prefill.responsibleUserId ?? inherited.responsibleUserId,
      verifierUserId: prefill.verifierUserId ?? inherited.verifierUserId,
    },
    select: { id: true, dateFrom: true, dateTo: true },
  });
  await seedEntriesForDocument({
    documentId: doc.id,
    journalCode: args.templateCode,
    organizationId: args.organizationId,
    dateFrom: doc.dateFrom,
    dateTo: doc.dateTo,
    responsibleUserId: prefill.responsibleUserId ?? inherited.responsibleUserId,
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
    /** См. `ensureActiveDocument.autoFill`. */
    autoFill?: boolean;
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

  const prevConfigNext = await fetchPreviousDocConfigForReuse(
    db,
    args.organizationId,
    args.templateCode,
  );
  const prefillNext = await prefillResponsiblesForNewDocument({
    organizationId: args.organizationId,
    journalCode: args.templateCode,
    baseConfig: prevConfigNext ?? {},
  });
  const planCfgNext = preplanCleaningConfig(
    args.templateCode,
    prefillNext.config,
    nextPeriod.dateFrom,
    nextPeriod.dateTo,
    now,
  );
  const doc = await db.journalDocument.create({
    data: {
      organizationId: args.organizationId,
      templateId: template.id,
      title: `${template.name} · ${nextPeriod.label}`,
      dateFrom: nextPeriod.dateFrom,
      dateTo: nextPeriod.dateTo,
      status: "active",
      autoFill: args.autoFill === true,
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

  // Преемник создан — все документы этого шаблона, чей период уже
  // истёк (dateTo < сегодня), переводим в «закрытые». Тот же переход,
  // что и у кнопки «Отправить в закрытые» (DocumentCloseButton).
  // Perpetual/yearly отфильтровываются внутри.
  await closeExpiredDocuments(db, {
    organizationId: args.organizationId,
    templateId: template.id,
    now,
    overrides: nextOverrides,
  }).catch((err) => {
    console.warn(
      `[journal-auto-create:next] closeExpired failed for ${args.templateCode}`,
      err
    );
    return { closed: 0, documentIds: [] };
  });

  return {
    code: args.templateCode,
    name: template.name,
    created: true,
    documentId: doc.id,
    reason: "next-period-created",
  };
}

/**
 * Догоняющий шаг для ПРЕРВАННОЙ ЦЕПОЧКИ документов.
 *
 * Баг, который он чинит: ежедневный cron создавал документы только по
 * `Organization.autoJournalCodes`. Журналы, которых нет в этом списке
 * (или орг, у которой список пуст вообще), после закрытия последнего
 * документа оставались БЕЗ активного документа навсегда: шаг
 * `closeExpiredDocuments` их закрывал, а создавать было некому.
 * В проде это выглядело так: за ночь закрыто 32 просроченных документа
 * и создано 0 новых — журналы просто опустели.
 *
 * Правило: если у организации КОГДА-ЛИБО был документ этого шаблона
 * (значит журнал документный и им пользовались), но сейчас нет ни
 * одного документа, покрывающего сегодня или будущее, — создаём
 * документ на ТЕКУЩИЙ период (периоды берутся из journal-period.ts с
 * учётом per-org override'ов). Ответственные наследуются из последнего
 * документа, если в /settings/journal-responsibles ничего не задано.
 *
 * Что НЕ трогаем:
 *   • шаблоны без единого документа в орге — журналом не пользовались,
 *     навязывать его не надо;
 *   • `perpetual` (дезсредства, чек-лист сан-дня) — такой документ не
 *     истекает по календарю, его закрывают только руками, и повторное
 *     создание спорило бы с решением менеджера;
 *   • неактивные шаблоны (`JournalTemplate.isActive = false`).
 *
 * Идемпотентно: после создания документ покрывает сегодня, и повторный
 * вызов пропускает шаблон с `reason="has-current-document"`.
 */
export async function ensureCurrentDocumentsForBrokenChains(
  db: PrismaClient,
  args: {
    organizationId: string;
    now?: Date;
  }
): Promise<CreateReport[]> {
  const now = args.now ?? new Date();
  const todayUtcStart = startOfUtcDay(now);

  // Один запрос вместо N: шаблоны, у которых в этой орге есть хоть один
  // документ, вместе с самой поздней датой окончания.
  const groups = await db.journalDocument.groupBy({
    by: ["templateId"],
    where: { organizationId: args.organizationId },
    _max: { dateTo: true },
  });
  if (groups.length === 0) return [];

  const overrides = await loadPeriodOverrides(db, args.organizationId);
  const templates = await db.journalTemplate.findMany({
    where: { id: { in: groups.map((group) => group.templateId) } },
    select: { id: true, code: true, name: true, isActive: true },
  });
  const templateById = new Map(templates.map((tpl) => [tpl.id, tpl]));

  const reports: CreateReport[] = [];
  for (const group of groups) {
    const template = templateById.get(group.templateId);
    if (!template || !template.isActive) continue;

    // Есть документ, который покрывает сегодня или начинается позже —
    // цепочка цела (в т.ч. look-ahead документ на следующий период).
    const maxDateTo = group._max.dateTo;
    if (maxDateTo && maxDateTo.getTime() >= todayUtcStart.getTime()) {
      reports.push({
        code: template.code,
        name: template.name,
        created: false,
        documentId: "",
        reason: "has-current-document",
      });
      continue;
    }

    const kind: JournalPeriodKind =
      overrides[template.code]?.kind ?? resolveJournalPeriodKind(template.code);
    if (kind === "perpetual") {
      reports.push({
        code: template.code,
        name: template.name,
        created: false,
        documentId: "",
        reason: "perpetual-manual-only",
      });
      continue;
    }

    const report = await ensureActiveDocument(db, {
      organizationId: args.organizationId,
      templateCode: template.code,
      now,
      inheritResponsiblesFromLastDocument: true,
    });
    reports.push(
      report.created ? { ...report, reason: "broken-chain-restored" } : report
    );
  }

  return reports;
}
