import { localDayKey } from "@/lib/entry-defaults";

export const AUDIT_PROTOCOL_TEMPLATE_CODE = "audit_protocol";
export const AUDIT_PROTOCOL_SOURCE_SLUG = "auditprotocol";
export const AUDIT_PROTOCOL_DOCUMENT_TITLE = "Протокол внутреннего аудита";

export type AuditProtocolSection = {
  id: string;
  title: string;
};

export type AuditProtocolRow = {
  id: string;
  sectionId: string;
  text: string;
  result: "yes" | "no" | "";
  note: string;
  /**
   * Строка плана аудитов, из которой скопировано требование. Связь
   * односторонняя: правка плана задним числом протокол не меняет, id
   * нужен только чтобы не скопировать одно и то же требование дважды.
   */
  planRowId?: string;
};

export type AuditProtocolSignature = {
  id: string;
  name: string;
  role: string;
  signedAt: string;
};

export type AuditProtocolConfig = {
  documentDate: string;
  basisTitle: string;
  auditedObject: string;
  sections: AuditProtocolSection[];
  rows: AuditProtocolRow[];
  signatures: AuditProtocolSignature[];
  /** Документ плана аудитов, из которого заполнен протокол (если был). */
  sourcePlanDocumentId?: string | null;
  /** Название плана на момент копирования — чтобы ссылка была подписана. */
  sourcePlanTitle?: string | null;
};

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function createAuditProtocolSection(title: string): AuditProtocolSection {
  return { id: createId("section"), title };
}

export function createAuditProtocolRow(params?: Partial<AuditProtocolRow>): AuditProtocolRow {
  return {
    id: createId("row"),
    sectionId: params?.sectionId || "",
    text: params?.text || "",
    result: params?.result || "",
    note: params?.note || "",
    ...(params?.planRowId ? { planRowId: params.planRowId } : {}),
  };
}

export function createAuditProtocolSignature(
  params?: Partial<AuditProtocolSignature>
): AuditProtocolSignature {
  return {
    id: createId("sign"),
    name: params?.name || "",
    role: params?.role || "",
    signedAt: params?.signedAt || localDayKey(),
  };
}

export function getDefaultAuditProtocolConfig(): AuditProtocolConfig {
  // Местная дата, а не UTC: ночью документ создавался вчерашним числом.
  const documentDate = localDayKey();
  const sections = [
    createAuditProtocolSection("Общие требования СМБПП"),
    createAuditProtocolSection("Требования к документации"),
    createAuditProtocolSection("Требования к персоналу"),
  ];

  return {
    documentDate,
    basisTitle: "Годовой план-программа внутренних аудитов",
    auditedObject: "Производственный участок",
    sections,
    // ПОЧЕМУ пусто: разделы — это каркас протокола, а строки с
    // результатом «да/нет» — уже результат проведённой проверки.
    // Готовое «нет — требуется обновить документы» в свежем документе
    // для инспектора выглядит как выдуманный аудит.
    rows: [],
    signatures: [
      createAuditProtocolSignature({
        name: "",
        role: "Главный аудитор",
        signedAt: documentDate,
      }),
    ],
  };
}

function normalizeSections(value: unknown, fallback: AuditProtocolSection[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      const title = safeText(source.title);
      if (!title) return null;
      return { id: safeText(source.id, `section-${index + 1}`), title };
    })
    .filter((item): item is AuditProtocolSection => item !== null);
  return items.length > 0 ? items : fallback;
}

function normalizeRows(
  value: unknown,
  fallback: AuditProtocolRow[],
  sectionIds: string[]
) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      const sectionId = safeText(source.sectionId);
      if (!sectionIds.includes(sectionId)) return null;
      const planRowId = safeText(source.planRowId);
      return {
        id: safeText(source.id, `row-${index + 1}`),
        sectionId,
        text: safeText(source.text),
        result: source.result === "yes" || source.result === "no" ? source.result : "",
        note: safeText(source.note),
        ...(planRowId ? { planRowId } : {}),
      } satisfies AuditProtocolRow;
    })
    .filter((item): item is AuditProtocolRow => item !== null);
  return items.length > 0 ? items : fallback;
}

function normalizeSignatures(value: unknown, fallback: AuditProtocolSignature[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      const name = safeText(source.name);
      if (!name) return null;
      return {
        id: safeText(source.id, `sign-${index + 1}`),
        name,
        role: safeText(source.role),
        signedAt: safeText(source.signedAt),
      };
    })
    .filter((item): item is AuditProtocolSignature => item !== null);
  return items.length > 0 ? items : fallback;
}

export function normalizeAuditProtocolConfig(value: unknown): AuditProtocolConfig {
  const fallback = getDefaultAuditProtocolConfig();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const source = value as Record<string, unknown>;
  const sections = normalizeSections(source.sections, fallback.sections);

  return {
    documentDate: safeText(source.documentDate, fallback.documentDate),
    basisTitle: safeText(source.basisTitle, fallback.basisTitle),
    auditedObject: safeText(source.auditedObject, fallback.auditedObject),
    sections,
    rows: normalizeRows(
      source.rows,
      fallback.rows.map((row) => ({ ...row, sectionId: sections[0]?.id || row.sectionId })),
      sections.map((item) => item.id)
    ),
    signatures: normalizeSignatures(source.signatures, fallback.signatures),
    sourcePlanDocumentId: safeText(source.sourcePlanDocumentId) || null,
    sourcePlanTitle: safeText(source.sourcePlanTitle) || null,
  };
}

/** План аудитов в том виде, в каком его копируют в протокол. */
export type AuditProtocolPlanSource = {
  documentId: string;
  title: string;
  sections: { id: string; title: string }[];
  rows: { id: string; sectionId: string; text: string }[];
};

function sectionKey(title: string) {
  return title.trim().toLowerCase();
}

/**
 * Копирует разделы и требования плана аудитов в протокол.
 *
 * ПОЧЕМУ копия, а не ссылка: протокол подписывают. Если бы он читал
 * требования из плана, правка плана задним числом молча меняла бы уже
 * подписанный документ. Поэтому текст копируется, а от плана остаётся
 * только `planRowId` (защита от повторного копирования) и ссылка в шапке.
 */
export function fillAuditProtocolFromPlan(
  config: AuditProtocolConfig,
  plan: AuditProtocolPlanSource
): { config: AuditProtocolConfig; addedRows: number; skippedRows: number } {
  const sections = [...config.sections];
  const sectionIdByKey = new Map(
    sections.map((section) => [sectionKey(section.title), section.id])
  );
  const usedPlanRowIds = new Set(
    config.rows.map((row) => row.planRowId).filter((id): id is string => Boolean(id))
  );

  const rows = [...config.rows];
  let addedRows = 0;
  let skippedRows = 0;

  for (const planRow of plan.rows) {
    const text = planRow.text.trim();
    if (!text) continue;
    if (usedPlanRowIds.has(planRow.id)) {
      skippedRows += 1;
      continue;
    }

    const planSection = plan.sections.find((item) => item.id === planRow.sectionId);
    const title = planSection?.title?.trim() || "Требования плана";
    let sectionId = sectionIdByKey.get(sectionKey(title));
    if (!sectionId) {
      const created = createAuditProtocolSection(title);
      sections.push(created);
      sectionIdByKey.set(sectionKey(title), created.id);
      sectionId = created.id;
    }

    rows.push(createAuditProtocolRow({ sectionId, text, planRowId: planRow.id }));
    usedPlanRowIds.add(planRow.id);
    addedRows += 1;
  }

  const defaultBasis = getDefaultAuditProtocolConfig().basisTitle;
  return {
    config: {
      ...config,
      sections,
      rows,
      // Основание перебиваем только пока там стоит заводской текст —
      // свою формулировку руководителя не трогаем.
      basisTitle:
        !config.basisTitle.trim() || config.basisTitle === defaultBasis
          ? plan.title
          : config.basisTitle,
      sourcePlanDocumentId: plan.documentId,
      sourcePlanTitle: plan.title,
    },
    addedRows,
    skippedRows,
  };
}
