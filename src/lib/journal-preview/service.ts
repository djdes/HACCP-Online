import { db } from "@/lib/db";
import { parseDisabledCodes } from "@/lib/disabled-journals";
import { generateJournalDocumentPdf } from "@/lib/document-pdf";
import { platformOrgId } from "@/lib/partners/partner-hint";
import { renderPdfFirstPageToPng } from "./render";

/** Превью без активного документа держим столько, потом чистим. */
const STALE_KEEP_DAYS = 30;

export type PreviewCandidate = {
  organizationId: string;
  code: string;
  /** Точки: "" — общее превью, иначе id точки. */
  buildingKey: string;
  documentId: string;
  sourceUpdatedAt: Date;
};

export type PreviewPlan = {
  toRender: PreviewCandidate[];
  /** id строк JournalPreview на удаление. */
  toDelete: string[];
};

type ActiveDoc = {
  id: string;
  organizationId: string;
  buildingId?: string | null;
  updatedAt: Date;
  dateFrom: Date;
  template: { code: string };
};

type ExistingPreview = {
  id: string;
  organizationId: string;
  code: string;
  buildingKey?: string;
  documentId: string;
  sourceUpdatedAt: Date;
  renderedAt: Date;
};

const KEY_SEPARATOR = "::";

/** (организация, код, точка) — один активный документ и одно превью. */
function previewKey(organizationId: string, code: string, buildingKey: string): string {
  return [organizationId, code, buildingKey].join(KEY_SEPARATOR);
}

/**
 * Чистая часть планировщика: что перерисовать, что удалить.
 *
 * - На (организация, код) берём один активный документ — самый свежий по
 *   `dateFrom`, если периодов несколько.
 * - Перерисовка, если превью нет, документ сменился или обновился позже
 *   `sourceUpdatedAt`.
 * - Удаление: код отключён в организации, либо активного документа нет
 *   и превью старше `STALE_KEEP_DAYS`.
 * - Порядок: сначала те, у кого превью нет вовсе, затем самые старые.
 */
export function planPreviewRun(input: {
  now: Date;
  activeDocs: ActiveDoc[];
  previews: ExistingPreview[];
  disabledByOrg: Map<string, Set<string>>;
}): PreviewPlan {
  const latestByKey = new Map<string, ActiveDoc>();
  for (const doc of input.activeDocs) {
    const key = previewKey(doc.organizationId, doc.template.code, doc.buildingId ?? "");
    const prev = latestByKey.get(key);
    if (!prev || doc.dateFrom > prev.dateFrom) latestByKey.set(key, doc);
  }

  const previewByKey = new Map<string, ExistingPreview>();
  for (const p of input.previews) {
    previewByKey.set(previewKey(p.organizationId, p.code, p.buildingKey ?? ""), p);
  }

  const staleBefore = new Date(input.now.getTime() - STALE_KEEP_DAYS * 24 * 60 * 60 * 1000);
  const toDelete: string[] = [];
  for (const p of input.previews) {
    const disabled = input.disabledByOrg.get(p.organizationId)?.has(p.code) ?? false;
    const hasActive = latestByKey.has(previewKey(p.organizationId, p.code, p.buildingKey ?? ""));
    if (disabled || (!hasActive && p.renderedAt < staleBefore)) toDelete.push(p.id);
  }

  const missing: Array<PreviewCandidate & { renderedAt: Date }> = [];
  const stale: Array<PreviewCandidate & { renderedAt: Date }> = [];
  for (const [key, doc] of latestByKey) {
    const [organizationId, code, buildingKey] = key.split(KEY_SEPARATOR);
    if (input.disabledByOrg.get(organizationId)?.has(code)) continue;
    const existing = previewByKey.get(key);
    const candidate = {
      organizationId,
      code,
      buildingKey: buildingKey ?? "",
      documentId: doc.id,
      sourceUpdatedAt: doc.updatedAt,
      renderedAt: existing?.renderedAt ?? new Date(0),
    };
    if (!existing) missing.push(candidate);
    else if (existing.documentId !== doc.id || doc.updatedAt > existing.sourceUpdatedAt)
      stale.push(candidate);
  }
  stale.sort((a, b) => a.renderedAt.getTime() - b.renderedAt.getTime());

  return {
    toRender: [...missing, ...stale].map(({ renderedAt: _r, ...c }) => c),
    toDelete,
  };
}

export async function loadPreviewPlan(now = new Date()): Promise<PreviewPlan> {
  const orgs = await db.organization.findMany({
    where: { id: { not: platformOrgId() } },
    select: { id: true, disabledJournalCodes: true },
  });
  const disabledByOrg = new Map<string, Set<string>>();
  for (const org of orgs) disabledByOrg.set(org.id, parseDisabledCodes(org.disabledJournalCodes));

  const [activeDocs, previews] = await Promise.all([
    db.journalDocument.findMany({
      where: {
        organizationId: { in: orgs.map((o) => o.id) },
        status: "active",
        dateFrom: { lte: now },
        dateTo: { gte: now },
      },
      select: {
        id: true,
        organizationId: true,
        buildingId: true,
        updatedAt: true,
        dateFrom: true,
        template: { select: { code: true } },
      },
    }),
    db.journalPreview.findMany({
      select: {
        id: true,
        organizationId: true,
        code: true,
        buildingKey: true,
        documentId: true,
        sourceUpdatedAt: true,
        renderedAt: true,
      },
    }),
  ]);

  return planPreviewRun({ now, activeDocs, previews, disabledByOrg });
}

export async function renderPreview(candidate: PreviewCandidate): Promise<void> {
  const { buffer } = await generateJournalDocumentPdf({
    documentId: candidate.documentId,
    organizationId: candidate.organizationId,
  });
  const rendered = await renderPdfFirstPageToPng(new Uint8Array(buffer));
  // Prisma Bytes ждёт Uint8Array<ArrayBuffer>; Buffer типизирован шире.
  const png = new Uint8Array(rendered.png);
  await db.journalPreview.upsert({
    where: {
      organizationId_code_buildingKey: {
        organizationId: candidate.organizationId,
        code: candidate.code,
        buildingKey: candidate.buildingKey,
      },
    },
    create: {
      organizationId: candidate.organizationId,
      code: candidate.code,
      buildingKey: candidate.buildingKey,
      documentId: candidate.documentId,
      png,
      width: rendered.width,
      height: rendered.height,
      sourceUpdatedAt: candidate.sourceUpdatedAt,
    },
    update: {
      documentId: candidate.documentId,
      png,
      width: rendered.width,
      height: rendered.height,
      sourceUpdatedAt: candidate.sourceUpdatedAt,
      renderedAt: new Date(),
    },
  });
}

export type PreviewRunResult = {
  rendered: number;
  failed: number;
  /** Кандидатов осталось за лимитом/бюджетом — доедет следующим прогоном. */
  skipped: number;
  deleted: number;
  ms: number;
};

/**
 * Один прогон крона. Лимит и бюджет времени — чтобы 10-минутный cron
 * никогда не наезжал на следующий и не грузил сервер: остаток
 * доедает следующий запуск.
 */
export async function runJournalPreviewCron(opts: {
  limit?: number;
  budgetMs?: number;
  now?: Date;
} = {}): Promise<PreviewRunResult> {
  const limit = opts.limit ?? 60;
  const budgetMs = opts.budgetMs ?? 240_000;
  const started = Date.now();
  const plan = await loadPreviewPlan(opts.now ?? new Date());

  let deleted = 0;
  if (plan.toDelete.length > 0) {
    const res = await db.journalPreview.deleteMany({ where: { id: { in: plan.toDelete } } });
    deleted = res.count;
  }

  let rendered = 0;
  let failed = 0;
  let index = 0;
  for (; index < plan.toRender.length; index++) {
    if (rendered + failed >= limit) break;
    if (Date.now() - started > budgetMs) break;
    const candidate = plan.toRender[index];
    try {
      await renderPreview(candidate);
      rendered++;
    } catch (error) {
      failed++;
      console.error(
        `[journal-previews] render failed org=${candidate.organizationId} code=${candidate.code} doc=${candidate.documentId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    rendered,
    failed,
    skipped: plan.toRender.length - index,
    deleted,
    ms: Date.now() - started,
  };
}

/**
 * code → URL превью для карточек. Версия в query — браузер кэширует
 * навсегда, новая отрисовка меняет URL.
 */
export async function getJournalPreviewMap(
  organizationId: string,
  /** Точка: её превью, если есть, иначе общее. null — только общие. */
  buildingId: string | null = null,
): Promise<Map<string, string>> {
  const wanted = buildingId ?? "";
  const rows = await db.journalPreview
    .findMany({
      where: { organizationId, buildingKey: { in: wanted ? [wanted, ""] : [""] } },
      select: { code: true, buildingKey: true, renderedAt: true },
    })
    .catch(() => []);
  const map = new Map<string, string>();
  // Сначала общие, затем превью точки перекрывают их.
  for (const row of [...rows].sort((a, b) => a.buildingKey.length - b.buildingKey.length)) {
    map.set(
      row.code,
      `/api/journal-previews/${encodeURIComponent(row.code)}?v=${row.renderedAt.getTime()}&b=${encodeURIComponent(row.buildingKey)}`,
    );
  }
  return map;
}
