import { db } from "@/lib/db";

/**
 * P1.5 Guide editor: shared helpers для `JournalGuideTemplate` +
 * `JournalGuideNode`.
 *
 * Семантически симметричен `journal-pipeline-tree.ts`, но без
 * pinned/custom разделения и без `linkedFieldKey`. Дерево гайдов —
 * это просто кастомный «как заполнять журнал» инструктаж: каждый
 * узел = шаг с title, detail и опциональным photoUrl. Используется
 * в FillingGuide-modal'ке (заменяет legacy hardcoded `journal-filling-guides`).
 */

export type GuideNode = {
  id: string;
  parentId: string | null;
  title: string;
  detail: string | null;
  photoUrl: string | null;
  ordering: number;
};

export type GuideTree = {
  templateId: string;
  organizationId: string;
  templateCode: string;
  nodes: GuideNode[];
};

export async function findGuideTemplate(
  organizationId: string,
  templateCode: string
) {
  return db.journalGuideTemplate.findUnique({
    where: { organizationId_templateCode: { organizationId, templateCode } },
  });
}

export async function ensureGuideTemplate(
  organizationId: string,
  templateCode: string
) {
  const existing = await findGuideTemplate(organizationId, templateCode);
  if (existing) return existing;
  return db.journalGuideTemplate.create({
    data: { organizationId, templateCode },
  });
}

export async function loadGuideTree(
  organizationId: string,
  templateCode: string
): Promise<GuideTree | null> {
  const template = await findGuideTemplate(organizationId, templateCode);
  if (!template) return null;
  const rows = await db.journalGuideNode.findMany({
    where: { templateId: template.id },
    orderBy: [{ parentId: "asc" }, { ordering: "asc" }],
  });
  return {
    templateId: template.id,
    organizationId: template.organizationId,
    templateCode: template.templateCode,
    nodes: rows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      title: row.title,
      detail: row.detail,
      photoUrl: row.photoUrl,
      ordering: row.ordering,
    })),
  };
}

export async function computeGuideNextOrdering(
  templateId: string,
  parentId: string | null
): Promise<number> {
  const last = await db.journalGuideNode.findFirst({
    where: { templateId, parentId },
    orderBy: { ordering: "desc" },
    select: { ordering: true },
  });
  return (last?.ordering ?? 0) + 1024;
}
