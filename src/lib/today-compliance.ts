import { db } from "@/lib/db";
import {
  DAILY_JOURNAL_CODES,
  CONFIG_DAILY_CODES,
} from "@/lib/daily-journal-codes";

export { DAILY_JOURNAL_CODES, CONFIG_DAILY_CODES };

/**
 * TasksFlow-driven readiness for a journal: when the org has TF tasks
 * tied to active documents covering today, the journal is «готов» iff
 * every such task is completed today. This overrides the entry-count
 * heuristics (which can lag behind reality when the TF assignment plan
 * doesn't perfectly match the document's roster — e.g. cold-equipment
 * fan-out where 3 cooks share 10 fridges, or hygiene where TF skips
 * employees without phone numbers).
 *
 * Rule per template:
 *   - If TF link count for today > 0:
 *       filled = (every link is completed AND completedAt ≥ todayStart)
 *     This OVERRIDES whatever entry-counting decided.
 *   - If TF link count for today === 0:
 *       no TF override; the caller's existing logic stands.
 *
 * "completedAt ≥ todayStart" rules out stale completions left over from
 * yesterday on a recurring task that TF rolled but our sync hasn't
 * polled yet.
 */
type TfTemplateReadiness = {
  totalCount: number;
  doneTodayCount: number;
  allDoneToday: boolean;
};

export async function getTasksFlowReadinessByTemplate(
  organizationId: string,
  todayStart: Date,
  activeDocs: Array<{ id: string; templateId: string }>
): Promise<Map<string, TfTemplateReadiness>> {
  const out = new Map<string, TfTemplateReadiness>();
  if (activeDocs.length === 0) return out;
  const docIds = activeDocs.map((d) => d.id);
  const templateByDocId = new Map<string, string>();
  for (const doc of activeDocs) templateByDocId.set(doc.id, doc.templateId);

  const links = await db.tasksFlowTaskLink.findMany({
    where: {
      journalDocumentId: { in: docIds },
      integration: { organizationId, enabled: true },
    },
    select: {
      journalDocumentId: true,
      remoteStatus: true,
      completedAt: true,
    },
  });

  for (const link of links) {
    const templateId = templateByDocId.get(link.journalDocumentId);
    if (!templateId) continue;
    const acc = out.get(templateId) ?? {
      totalCount: 0,
      doneTodayCount: 0,
      allDoneToday: false,
    };
    acc.totalCount += 1;
    const doneToday =
      link.remoteStatus === "completed" &&
      link.completedAt !== null &&
      link.completedAt >= todayStart;
    if (doneToday) acc.doneTodayCount += 1;
    out.set(templateId, acc);
  }

  for (const acc of out.values()) {
    acc.allDoneToday = acc.totalCount > 0 && acc.doneTodayCount === acc.totalCount;
  }

  return out;
}

/**
 * "Filled today" check for a journal template. Not every mandatory
 * journal has daily obligations — some are aperiodic (accidents,
 * complaints, breakdowns happen only when they happen) or event-driven
 * (incoming raw material inspection, intensive cooling, metal-impurity
 * checks, audits, staff training, equipment calibration…). Flagging
 * those as «не заполнено сегодня» every day would be wrong.
 *
 * So we classify templates by cadence:
 *
 *   - DAILY_JOURNAL_CODES — have to be filled every working day
 *     (hygiene, health_check, temperatures, cleaning, fryer, etc.)
 *   - everything else — aperiodic, counts as «always filled» from
 *     the compliance-ring perspective.
 *
 * For daily journals we compare today's rows against the document's
 * natural roster size (max rows observed on any single day within the
 * 30-day lookback window):
 *
 *   todayCount   = # of `JournalDocumentEntry` rows with `date = today`
 *   expectedCount = max # of rows seen on any single prior day within
 *                   the last 30 days (hygiene → # of employees,
 *                   cold-equipment → # of fridges, cleaning → # of
 *                   procedures, etc.)
 *   documentFilled = expectedCount === 0
 *                      ? todayCount > 0       // brand-new doc, any row counts
 *                      : todayCount >= expectedCount
 *
 * The template is considered filled today iff there's at least one
 * active document that covers today AND every such document is filled.
 *
 * Legacy `JournalEntry` journals (form-based, no per-day grid concept)
 * stay on the simpler "at least one entry today" rule.
 */


type DayRollup = {
  date: Date;
  count: number;
};

type DocumentRollup = {
  todayCount: number;
  expectedCount: number;
  filled: boolean;
};

/**
 * UTC-midnight of `now`'s calendar date. Entries are stored with their
 * `date` field at UTC-midnight (see /api/journal-documents/[id]/entries
 * — `new Date("YYYY-MM-DD")` parses as UTC midnight). We must compare
 * against UTC-today, otherwise a server that runs in a non-UTC
 * timezone produces a date-key off by one day.
 */
function utcDayStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

async function rollupDocumentForDay(
  documentId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<DocumentRollup> {
  const lookbackStart = new Date(todayStart);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 30);

  const entries = await db.journalDocumentEntry.findMany({
    where: {
      documentId,
      date: { gte: lookbackStart, lt: todayEnd },
      NOT: { data: { path: ["_autoSeeded"], equals: true } },
    },
    select: { date: true },
  });

  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const dayKey = entry.date.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);
  }

  const todayKey = todayStart.toISOString().slice(0, 10);
  const todayCount = byDay.get(todayKey) ?? 0;

  // Use the most-recent prior day with any entries as the "expected"
  // roster size. This reflects the current roster (e.g. if an employee
  // was removed yesterday, expected drops right away) while skipping
  // weekend gaps and empty days. Max-over-30-days was too rigid — one
  // unusually-large prior day would keep today "not filled" forever.
  const priorDayKeys = [...byDay.keys()]
    .filter((dayKey) => dayKey !== todayKey)
    .sort();
  let expectedCount = 0;
  for (let i = priorDayKeys.length - 1; i >= 0; i--) {
    const count = byDay.get(priorDayKeys[i]) ?? 0;
    if (count > 0) {
      expectedCount = count;
      break;
    }
  }

  // No history → one entry is enough (first day of a brand-new document).
  if (expectedCount === 0) {
    return { todayCount, expectedCount: 0, filled: todayCount > 0 };
  }

  return {
    todayCount,
    expectedCount,
    filled: todayCount >= expectedCount,
  };
}

async function isDocumentFilledForDay(
  documentId: string,
  todayStart: Date,
  todayEnd: Date
): Promise<boolean> {
  const rollup = await rollupDocumentForDay(documentId, todayStart, todayEnd);
  return rollup.filled;
}

/**
 * Templates whose entries pack many sub-values into `entry.data` and
 * need per-template inspection instead of entry-count. Keep in sync
 * with the branches inside `rollupEntryDataDocumentForDay`.
 */
const DEEP_INSPECT_CODES = new Set([
  "cold_equipment_control",
  "climate_control",
  "cleaning_ventilation_checklist",
]);

/**
 * Journals we still judge by «все ли из ростера сделали запись» — где
 * журнал реально ведётся по КАЖДОМУ сотруднику ежедневно, и любая
 * пропущенная строка — это явный баг (hygiene, health_check).
 *
 * Все остальные daily-журналы оцениваются проще: «был ли хоть один
 * штрих за сегодня» → зелёный. Причина — для замеров холодильников,
 * уборки, фритюра и т.п. менеджер не всегда знает финальное число
 * записей (например сколько раз за смену проверят фритюр). Пустое
 * сегодня = «не начали», любая запись = «пошло».
 */
const STRICT_COMPLETENESS_CODES = new Set(["hygiene", "health_check"]);

/**
 * Per-template rollup for daily journals that store ONE entry per date
 * but pack many sub-values inside `entry.data`. Counting entries alone
 * would mark «1 entry = filled» even if only 1 fridge out of 10 had a
 * temperature recorded. We look inside `entry.data` and compare the
 * count of non-null sub-values to the document's configured roster.
 *
 * Returns null for template codes that don't need the deep inspection
 * (hygiene, health_check, fryer_oil, uv_lamp_runtime,
 * cleaning_ventilation_checklist), letting the caller fall back to the
 * entry-count rollup.
 */
async function rollupEntryDataDocumentForDay(
  templateCode: string,
  documentId: string,
  config: unknown,
  todayStart: Date,
  todayEnd: Date
): Promise<DocumentRollup | null> {
  if (!config || typeof config !== "object") return null;
  const cfg = config as Record<string, unknown>;

  if (templateCode === "cold_equipment_control") {
    // data = { temperatures: { equipmentId: number|null } }
    const equipment = Array.isArray(cfg.equipment) ? cfg.equipment : [];
    const equipmentIds = equipment
      .map((item) => (item as { id?: string })?.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const expectedCount = equipmentIds.length;
    if (expectedCount === 0) {
      return { todayCount: 0, expectedCount: 0, filled: false };
    }
    const entries = await db.journalDocumentEntry.findMany({
      where: {
        documentId,
        date: { gte: todayStart, lt: todayEnd },
        NOT: { data: { path: ["_autoSeeded"], equals: true } },
      },
      select: { data: true },
    });
    const recordedIds = new Set<string>();
    for (const entry of entries) {
      const temps =
        (entry.data as { temperatures?: Record<string, unknown> } | null)
          ?.temperatures;
      if (!temps || typeof temps !== "object") continue;
      for (const [equipId, value] of Object.entries(temps)) {
        if (value !== null && value !== undefined && value !== "") {
          recordedIds.add(equipId);
        }
      }
    }
    const todayCount = equipmentIds.filter((id) => recordedIds.has(id)).length;
    return {
      todayCount,
      expectedCount,
      filled: todayCount >= expectedCount,
    };
  }

  if (templateCode === "cleaning_ventilation_checklist") {
    // data.procedures = { [procedureId]: time[] } — array of applied times.
    // Expected = sum over enabled procedures of their scheduled times.length.
    //
    // The UI at cleaning-ventilation-checklist-document-client.tsx
    // displays config `procedure.times` as the default cell value when
    // `entry.procedures[id]` is absent (`entry?.procedures[id] ||
    // procedure.times`). Users see times in the cells and consider the
    // procedure «done» even without explicitly saving. To match that
    // expectation, a procedure with no entry override falls back to its
    // config-default count — «all cells show a time» = «filled».
    type Procedure = { id?: string; enabled?: boolean; times?: string[] };
    const procedures = Array.isArray(cfg.procedures)
      ? (cfg.procedures as Procedure[])
      : [];
    const enabled = procedures.filter((p) => p?.enabled && p.id);
    const perProc = new Map<string, { expected: number; defaultFilled: number }>();
    let expectedCount = 0;
    for (const p of enabled) {
      const rawTimes = Array.isArray(p.times) ? (p.times as string[]) : [];
      const slots = rawTimes.filter(Boolean).length;
      if (slots === 0) continue;
      const defaultFilled = rawTimes.filter(
        (t) => typeof t === "string" && t !== "" && t !== "00:00"
      ).length;
      perProc.set(p.id as string, { expected: slots, defaultFilled });
      expectedCount += slots;
    }
    if (expectedCount === 0) {
      return { todayCount: 0, expectedCount: 0, filled: false };
    }
    const entries = await db.journalDocumentEntry.findMany({
      where: {
        documentId,
        date: { gte: todayStart, lt: todayEnd },
        NOT: { data: { path: ["_autoSeeded"], equals: true } },
      },
      select: { data: true },
    });
    let todayCount = 0;
    for (const [procId, { expected, defaultFilled }] of perProc.entries()) {
      let hasOverride = false;
      let overrideFilled = 0;
      for (const entry of entries) {
        const data = entry.data as { procedures?: Record<string, unknown> } | null;
        const raw = data?.procedures?.[procId];
        if (!Array.isArray(raw)) continue;
        hasOverride = true;
        const filled = raw.filter(
          (t) => typeof t === "string" && t !== "" && t !== "00:00"
        ).length;
        overrideFilled = Math.max(overrideFilled, filled);
      }
      const actualForProc = hasOverride ? overrideFilled : defaultFilled;
      todayCount += Math.min(actualForProc, expected);
    }
    return {
      todayCount,
      expectedCount,
      filled: todayCount >= expectedCount,
    };
  }

  if (templateCode === "climate_control") {
    // data = { measurements: { roomId: { time: { temperature?, humidity? } } } }
    const rooms = Array.isArray(cfg.rooms) ? cfg.rooms : [];
    const controlTimes = Array.isArray(cfg.controlTimes) ? cfg.controlTimes : [];
    type ClimateRoom = {
      id?: string;
      temperature?: { enabled?: boolean };
      humidity?: { enabled?: boolean };
    };
    let expectedCount = 0;
    const expectedSlots: Array<{ roomId: string; time: string; kind: "temperature" | "humidity" }> = [];
    for (const raw of rooms) {
      const room = raw as ClimateRoom;
      const roomId = room?.id;
      if (!roomId) continue;
      for (const rawTime of controlTimes) {
        const time = typeof rawTime === "string" ? rawTime : null;
        if (!time) continue;
        if (room.temperature?.enabled) {
          expectedSlots.push({ roomId, time, kind: "temperature" });
          expectedCount += 1;
        }
        if (room.humidity?.enabled) {
          expectedSlots.push({ roomId, time, kind: "humidity" });
          expectedCount += 1;
        }
      }
    }
    if (expectedCount === 0) {
      return { todayCount: 0, expectedCount: 0, filled: false };
    }
    const entries = await db.journalDocumentEntry.findMany({
      where: {
        documentId,
        date: { gte: todayStart, lt: todayEnd },
        NOT: { data: { path: ["_autoSeeded"], equals: true } },
      },
      select: { data: true },
    });
    let todayCount = 0;
    for (const { roomId, time, kind } of expectedSlots) {
      for (const entry of entries) {
        const measurements = (
          entry.data as {
            measurements?: Record<string, Record<string, Record<string, unknown>>>;
          } | null
        )?.measurements;
        const value = measurements?.[roomId]?.[time]?.[kind];
        if (value !== null && value !== undefined && value !== "") {
          todayCount += 1;
          break;
        }
      }
    }
    return {
      todayCount,
      expectedCount,
      filled: todayCount >= expectedCount,
    };
  }

  return null;
}

/**
 * Per-template-code rollup for journals that store rows inside
 * `JournalDocument.config` instead of `JournalDocumentEntry`. Returns
 * null if the template isn't recognized — callers then fall back to
 * the entry-based rollup or treat the template as aperiodic.
 */
function rollupConfigDocumentForDay(
  templateCode: string,
  config: unknown,
  todayKey: string
): DocumentRollup | null {
  if (!config || typeof config !== "object") return null;
  const cfg = config as Record<string, unknown>;

  if (templateCode === "cleaning") {
    // matrix[roomId][dateKey] — one mark per room per day. Expected
    // count = # of rooms; todayCount = rooms with a non-empty mark
    // for today. Skip-weekends documents only count weekdays; here
    // we just check "has any value" because the room list is finite.
    const matrix =
      cfg.matrix && typeof cfg.matrix === "object"
        ? (cfg.matrix as Record<string, Record<string, unknown>>)
        : {};
    const rooms = Array.isArray(cfg.rooms) ? cfg.rooms : [];
    let todayCount = 0;
    for (const room of rooms) {
      const roomId = (room as { id?: string })?.id;
      if (!roomId) continue;
      const cell = matrix[roomId]?.[todayKey];
      if (cell !== undefined && cell !== "" && cell !== null) {
        todayCount += 1;
      }
    }
    const expectedCount = rooms.length;
    if (expectedCount === 0) {
      return { todayCount, expectedCount: 0, filled: todayCount > 0 };
    }
    return {
      todayCount,
      expectedCount,
      filled: todayCount >= expectedCount,
    };
  }

  if (templateCode === "finished_product" || templateCode === "perishable_rejection") {
    // Each row is an aperiodic event inspection (a batch, a delivery).
    // No fixed roster — we can only say "has any row for today".
    const rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    const dateField =
      templateCode === "finished_product" ? "productionDateTime" : "arrivalDate";
    let todayCount = 0;
    for (const row of rows) {
      const raw = (row as Record<string, unknown>)[dateField];
      if (typeof raw !== "string") continue;
      if (raw.slice(0, 10) === todayKey) todayCount += 1;
    }
    return {
      todayCount,
      expectedCount: todayCount > 0 ? todayCount : 1,
      filled: todayCount > 0,
    };
  }

  return null;
}

/**
 * Returns the set of JournalTemplate IDs considered "filled today"
 * (organization-scoped). Aperiodic journals (not in
 * `DAILY_JOURNAL_CODES` and not in `CONFIG_DAILY_CODES`) are always
 * treated as filled and returned whenever the caller provides their
 * template codes via `allTemplates`. Daily journals have their
 * filled-ness computed from either `JournalDocumentEntry` rows
 * (DAILY_JOURNAL_CODES) or inline config rows (CONFIG_DAILY_CODES)
 * — see module-level docstring for the exact rules.
 */
export type TemplatesFilledTodayOptions = {
  treatAperiodicAsFilled?: boolean;
};

export async function getTemplatesFilledToday(
  organizationId: string,
  now: Date = new Date(),
  allTemplates?: Array<{ id: string; code: string }>,
  disabledCodes?: Set<string>,
  options: TemplatesFilledTodayOptions = {}
): Promise<Set<string>> {
  const treatAperiodicAsFilled = options.treatAperiodicAsFilled ?? true;
  const todayStart = utcDayStart(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const lookbackStart = new Date(todayStart);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 30);

  const [legacyEntries, activeDocuments] = await Promise.all([
    db.journalEntry.findMany({
      where: {
        organizationId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      select: { templateId: true },
      distinct: ["templateId"],
    }),
    db.journalDocument.findMany({
      where: {
        organizationId,
        status: "active",
        dateFrom: { lte: todayStart },
        dateTo: { gte: todayStart },
      },
      select: {
        id: true,
        templateId: true,
        config: true,
        template: { select: { code: true } },
      },
    }),
  ]);

  const filled = new Set<string>();
  for (const entry of legacyEntries) filled.add(entry.templateId);

  // Только aperiodic-журналы, у которых есть хотя бы один активный
  // документ на сегодня, считаются «готовыми по умолчанию». До этого
  // было «все aperiodic автоматически filled» — что приводило к
  // 71% готовности у свежезарегистрированной компании с нулевым
  // настройкой: 25 из 35 журналов — aperiodic, они все зеленые,
  // менеджер думает «что-то уже сделано», хотя ещё ничего не
  // настроено. Теперь журнал идёт в числитель ring'a только когда
  // менеджер реально его ведёт (документ активен).
  const activeByTemplate = new Map<string, number>();
  for (const doc of activeDocuments) {
    activeByTemplate.set(
      doc.templateId,
      (activeByTemplate.get(doc.templateId) ?? 0) + 1
    );
  }

  if (allTemplates && treatAperiodicAsFilled) {
    for (const tpl of allTemplates) {
      if (disabledCodes?.has(tpl.code)) {
        filled.add(tpl.id);
        continue;
      }
      const isAperiodic =
        !DAILY_JOURNAL_CODES.has(tpl.code) &&
        !CONFIG_DAILY_CODES.has(tpl.code);
      if (isAperiodic && (activeByTemplate.get(tpl.id) ?? 0) > 0) {
        filled.add(tpl.id);
      }
    }
  }

  const todayKey = todayStart.toISOString().slice(0, 10);
  const eligibleTemplateCodes = allTemplates
    ? new Set(
        allTemplates
          .filter((tpl) => !disabledCodes?.has(tpl.code))
          .map((tpl) => tpl.code)
      )
    : null;
  const isEligibleDocument = (doc: (typeof activeDocuments)[number]) =>
    !eligibleTemplateCodes || eligibleTemplateCodes.has(doc.template.code);

  // Config-stored daily journals (cleaning / finished_product /
  // perishable_rejection). «Начат сегодня» = хотя бы одна строка с
  // datom = today в config.rows[] / matrix. Это relaxed-режим —
  // менеджер просто хочет видеть зелёный, когда сотрудник уже
  // сделал первую запись.
  const configDocs = activeDocuments.filter(
    (doc) => isEligibleDocument(doc) && CONFIG_DAILY_CODES.has(doc.template.code)
  );
  const configDocsByTemplate = new Map<string, boolean[]>();
  for (const doc of configDocs) {
    const rollup = rollupConfigDocumentForDay(
      doc.template.code,
      doc.config,
      todayKey
    );
    const started = (rollup?.todayCount ?? 0) > 0;
    const list = configDocsByTemplate.get(doc.templateId) ?? [];
    list.push(started);
    configDocsByTemplate.set(doc.templateId, list);
  }
  // Для config-журналов: «хотя бы один активный doc начат» = filled.
  // Раньше требовалось every() — но это противоречит spirit-y
  // «начали заполнять», когда в организации несколько параллельных
  // документов по одному журналу.
  for (const [templateId, results] of configDocsByTemplate.entries()) {
    if (results.some((ok) => ok)) {
      filled.add(templateId);
    }
  }

  const dailyDocs = activeDocuments.filter(
    (doc) =>
      isEligibleDocument(doc) &&
      (DAILY_JOURNAL_CODES.has(doc.template.code) ||
        (!treatAperiodicAsFilled && !CONFIG_DAILY_CODES.has(doc.template.code)))
  );
  if (dailyDocs.length === 0) return filled;

  // Single grouped query — pulls 30-day rollup counts once for all
  // daily docs. We derive two things out of the same dataset:
  //   - «хоть одна запись за сегодня» (для relaxed-журналов)
  //   - «сегодняшних ≥ предыдущего рабочего дня» (для STRICT журналов
  //     типа hygiene / health_check, где правило прежнее — каждый
  //     сотрудник должен отметиться).
  const dailyDocIds = dailyDocs.map((d) => d.id);
  const rollupRows = await db.journalDocumentEntry.groupBy({
    by: ["documentId", "date"],
    where: {
      documentId: { in: dailyDocIds },
      date: { gte: lookbackStart, lt: todayEnd },
      // Исключаем авто-сид'ы (созданные при пересоздании документа,
      // когда у пользователя ещё ноль фактических заполнений).
      // См. journal-document-entries-seed.ts. Без этого баннер
      // «Сегодня журнал уже заполнялся» показывается на пустом доке.
      NOT: { data: { path: ["_autoSeeded"], equals: true } },
    },
    _count: { _all: true },
  });
  const byDocument = new Map<string, Map<string, number>>();
  for (const row of rollupRows) {
    const dayKey = row.date.toISOString().slice(0, 10);
    let docMap = byDocument.get(row.documentId);
    if (!docMap) {
      docMap = new Map();
      byDocument.set(row.documentId, docMap);
    }
    docMap.set(dayKey, row._count._all);
  }

  function documentStartedToday(documentId: string): boolean {
    const byDay = byDocument.get(documentId) ?? new Map();
    return (byDay.get(todayKey) ?? 0) > 0;
  }
  function documentFilledStrict(documentId: string): boolean {
    const byDay = byDocument.get(documentId) ?? new Map();
    const todayCount = byDay.get(todayKey) ?? 0;
    if (todayCount === 0) return false;
    const priorDayKeys = [...byDay.keys()]
      .filter((k) => k !== todayKey)
      .sort();
    for (let i = priorDayKeys.length - 1; i >= 0; i--) {
      const count = byDay.get(priorDayKeys[i]) ?? 0;
      if (count > 0) return todayCount >= count;
    }
    return true;
  }

  const documentsByTemplate = new Map<string, { code: string; docIds: string[] }>();
  for (const doc of dailyDocs) {
    const entry = documentsByTemplate.get(doc.templateId) ?? {
      code: doc.template.code,
      docIds: [],
    };
    entry.docIds.push(doc.id);
    documentsByTemplate.set(doc.templateId, entry);
  }

  // Strict-режим включается legacy-кодами или динамически когда
  // менеджер выбрал fillMode="per-employee". Грузим fillMode для всех
  // активных шаблонов одним запросом — лишний select без N+1.
  const templateIdsInPlay = [...documentsByTemplate.keys()];
  const templateFillModes =
    templateIdsInPlay.length > 0
      ? await db.journalTemplate.findMany({
          where: { id: { in: templateIdsInPlay } },
          select: { id: true, fillMode: true },
        })
      : [];
  const fillModeById = new Map(
    templateFillModes.map((t) => [t.id, t.fillMode])
  );

  for (const [templateId, { code, docIds }] of documentsByTemplate.entries()) {
    const fillMode = fillModeById.get(templateId) ?? "per-employee";
    const strict =
      STRICT_COMPLETENESS_CODES.has(code) || fillMode === "per-employee";
    const ok = strict
      ? docIds.every(documentFilledStrict) // все документы целиком заполнены
      : docIds.some(documentStartedToday); // хотя бы один начат
    if (ok) filled.add(templateId);
  }

  // TasksFlow override: if the org has TF tasks bound to today's active
  // documents, the journal's readiness is the AND of those tasks being
  // completed today. This is the user's mental model — "I see in TF
  // that everything is done, so journal must be ready". Without this,
  // entry-counting heuristics can lag behind (roster changes, partial
  // fan-out, deep-inspect mismatches) and leave a journal "not done"
  // even after every assigned worker tapped «Готово».
  const tfReadiness = await getTasksFlowReadinessByTemplate(
    organizationId,
    todayStart,
    activeDocuments.map((d) => ({ id: d.id, templateId: d.templateId }))
  );
  for (const [templateId, readiness] of tfReadiness.entries()) {
    if (readiness.totalCount === 0) continue;
    if (readiness.allDoneToday) {
      filled.add(templateId);
    } else {
      filled.delete(templateId);
    }
  }

  // JournalCloseEvent override: если на сегодня есть active-closure
  // (kind = "no-events" | "closed-with-events" | "auto-closed-empty"),
  // журнал считается заполненным (compliance ✅). Это обеспечивает
  // что «Не требуется сегодня» / «Завершить смену» / даже cron
  // auto-close не оставляют красные журналы на дашборде.
  const todayCloseEvents = await db.journalCloseEvent.findMany({
    where: {
      organizationId,
      date: todayStart,
      reopenedAt: null, // активные closures (не reopened)
    },
    select: { templateId: true, kind: true },
  });
  for (const ce of todayCloseEvents) {
    filled.add(ce.templateId);
  }

  return filled;
}

/**
 * Single-template check. Same semantics as `getTemplatesFilledToday`.
 * Returns `true` for aperiodic templates (identified by `templateCode`)
 * without hitting the database beyond the legacy-entry lookup.
 */
export async function isTemplateFilledToday(
  organizationId: string,
  templateId: string,
  templateCode: string | null = null,
  now: Date = new Date()
): Promise<boolean> {
  const summary = await getTemplateTodaySummary(
    organizationId,
    templateId,
    templateCode,
    now
  );
  return summary.filled;
}

export type TemplateTodaySummary = {
  filled: boolean;
  /** True when the template has no daily obligation. UI may want to hide
   * progress bars in that case. */
  aperiodic: boolean;
  /** Sum of `JournalDocumentEntry` rows across all active documents for
   * today (across the template). 0 when only legacy entries exist. */
  todayCount: number;
  /** Sum of expected rows across all active documents for today. 0 when
   * the template has no documents (or all are brand-new without history). */
  expectedCount: number;
  /** True when there isn't a single active `JournalDocument` covering
   * today — the user has nothing to fill into and needs to create one. */
  noActiveDocument: boolean;
  /** ID of the first active `JournalDocument` covering today, if any.
   * Powers the «Перейти к документу» shortcut on the banner. */
  activeDocumentId: string | null;
};

export type TemplateTodaySummaryOptions = {
  treatAperiodicAsFilled?: boolean;
};

/**
 * Detailed per-template summary for today. Powers the per-journal banner
 * — the banner uses `todayCount`/`expectedCount` to render «X из Y
 * строк за сегодня заполнено».
 */
export async function getTemplateTodaySummary(
  organizationId: string,
  templateId: string,
  templateCode: string | null = null,
  now: Date = new Date(),
  options: TemplateTodaySummaryOptions = {}
): Promise<TemplateTodaySummary> {
  const treatAperiodicAsFilled = options.treatAperiodicAsFilled ?? true;
  const todayStart = utcDayStart(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

  // Aperiodic journals are treated as filled — no daily obligation.
  if (
    treatAperiodicAsFilled &&
    templateCode &&
    !DAILY_JOURNAL_CODES.has(templateCode) &&
    !CONFIG_DAILY_CODES.has(templateCode)
  ) {
    return {
      filled: true,
      aperiodic: true,
      todayCount: 0,
      expectedCount: 0,
      noActiveDocument: false,
      activeDocumentId: null,
    };
  }

  const [legacyCount, activeDocuments, template] = await Promise.all([
    db.journalEntry.count({
      where: {
        organizationId,
        templateId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
    }),
    db.journalDocument.findMany({
      where: {
        organizationId,
        templateId,
        status: "active",
        dateFrom: { lte: todayStart },
        dateTo: { gte: todayStart },
      },
      select: { id: true, config: true },
      orderBy: { dateFrom: "desc" },
    }),
    db.journalTemplate.findUnique({
      where: { id: templateId },
      select: { fillMode: true },
    }),
  ]);
  const fillMode = template?.fillMode ?? "per-employee";

  const activeDocumentId = activeDocuments[0]?.id ?? null;

  // JournalCloseEvent override: если на сегодня есть active closure —
  // журнал считается заполненным (зелёный), независимо от entry-count
  // и TF readiness. Это применяется к ЛЮБОМУ template'у, включая
  // aperiodic — менеджер может вручную закрыть «без событий».
  const closeEvent = await db.journalCloseEvent.findUnique({
    where: {
      organizationId_templateId_date: {
        organizationId,
        templateId,
        date: todayStart,
      },
    },
    select: { id: true, kind: true, reason: true, reopenedAt: true },
  });
  if (closeEvent && !closeEvent.reopenedAt) {
    return {
      filled: true,
      aperiodic: false,
      todayCount: 0,
      expectedCount: 0,
      noActiveDocument: false,
      activeDocumentId,
    };
  }

  // TasksFlow override: if there are TF tasks bound to today's active
  // documents, the journal's readiness is purely "all those tasks
  // completed today". Same rationale as in getTemplatesFilledToday —
  // entry-counting can lag behind reality. We expose the TF counts via
  // the existing todayCount/expectedCount fields so the banner reads
  // "N из M задач выполнено за сегодня" naturally.
  if (activeDocuments.length > 0) {
    const tfReadiness = await getTasksFlowReadinessByTemplate(
      organizationId,
      todayStart,
      activeDocuments.map((d) => ({ id: d.id, templateId }))
    );
    const tf = tfReadiness.get(templateId);
    if (tf && tf.totalCount > 0) {
      return {
        filled: tf.allDoneToday,
        aperiodic: false,
        todayCount: tf.doneTodayCount,
        expectedCount: tf.totalCount,
        noActiveDocument: false,
        activeDocumentId,
      };
    }
  }

  if (legacyCount > 0) {
    return {
      filled: true,
      aperiodic: false,
      todayCount: legacyCount,
      expectedCount: legacyCount,
      noActiveDocument: false,
      activeDocumentId,
    };
  }
  if (activeDocuments.length === 0) {
    return {
      filled: false,
      aperiodic: false,
      todayCount: 0,
      expectedCount: 0,
      noActiveDocument: true,
      activeDocumentId: null,
    };
  }

  // Config-stored journals — inspect the document config directly.
  if (templateCode && CONFIG_DAILY_CODES.has(templateCode)) {
    const todayKey = todayStart.toISOString().slice(0, 10);
    const configRollups = activeDocuments.map(
      (doc) =>
        rollupConfigDocumentForDay(templateCode, doc.config, todayKey) ?? {
          todayCount: 0,
          expectedCount: 0,
          filled: false,
        }
    );
    const todayCount = configRollups.reduce((sum, r) => sum + r.todayCount, 0);
    const expectedCount = configRollups.reduce(
      (sum, r) => sum + r.expectedCount,
      0
    );
    // Relaxed для config-based: «начали = зелёный». Никаких
    // config-based журналов в STRICT нет.
    const filled = todayCount > 0;
    return {
      filled,
      aperiodic: false,
      todayCount,
      expectedCount,
      noActiveDocument: false,
      activeDocumentId,
    };
  }

  // Strict-режим (журнал «выполнен» только когда все eligible
   // сотрудники отметились) включается двумя путями:
  //   1. Хардкод: hygiene/health_check (legacy + per-employee по
  //      дизайну с самого начала)
  //   2. Динамически: любой шаблон с `fillMode === "per-employee"` —
  //      т.е. менеджер настроил «каждый сотрудник заполняет за себя»
  //      в `/settings/journals`. Один заполнивший ≠ выполнен.
  const strict =
    (typeof templateCode === "string" &&
      STRICT_COMPLETENESS_CODES.has(templateCode)) ||
    fillMode === "per-employee";

  const rollups = await Promise.all(
    activeDocuments.map(async (doc) => {
      if (strict) {
        // hygiene / health_check продолжают пользоваться строгой
        // ростер-логикой — по каждому сотруднику за сегодня должна
        // быть запись. Для deep-inspect-ов эта ветка не нужна — они
        // все в relaxed-наборе.
        return rollupDocumentForDay(doc.id, todayStart, todayEnd);
      }
      // Relaxed: «начали сегодня». Считаем только todayCount — без
      // сравнения с предыдущим днём, без inspect'ов equipment/room.
      const today = await db.journalDocumentEntry.count({
        where: { documentId: doc.id, date: { gte: todayStart, lt: todayEnd } },
      });
      return {
        todayCount: today,
        expectedCount: today > 0 ? today : 1,
        filled: today > 0,
      };
    })
  );

  const todayCount = rollups.reduce((sum, r) => sum + r.todayCount, 0);
  const expectedCount = rollups.reduce((sum, r) => sum + r.expectedCount, 0);
  const filled = strict
    ? rollups.every((r) => r.filled)
    : rollups.some((r) => r.filled);

  return {
    filled,
    aperiodic: false,
    todayCount,
    expectedCount,
    noActiveDocument: false,
    activeDocumentId,
  };
}

// Kept for future consumers (e.g. analytics) — intentionally unused now.
export type { DayRollup };
