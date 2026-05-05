import { db } from "@/lib/db";

/**
 * P1 Pipeline Editor: shared helpers для работы с
 * `JournalPipelineTemplate` + `JournalPipelineNode` tree.
 *
 * Convention:
 * - tree per (organizationId, templateCode), unique
 * - nodes имеют parentId + ordering: Float (drag-drop без reindexing)
 * - kind="pinned" — системный, привязан к колонке журнала через
 *   linkedFieldKey, нельзя удалять. kind="custom" — admin-добавленный.
 *
 * Эти helper'ы не зависят от Request — они вызываются из API handler'ов
 * и из generic-адаптера (P1.4) для чтения дерева во время заполнения
 * задачи в Mini App.
 */

export type PipelineNode = {
  id: string;
  parentId: string | null;
  kind: "pinned" | "custom";
  linkedFieldKey: string | null;
  title: string;
  detail: string | null;
  hint: string | null;
  ordering: number;
  photoMode: "none" | "optional" | "required";
  requireComment: boolean;
  requireSignature: boolean;
};

export type PipelineTree = {
  templateId: string;
  organizationId: string;
  templateCode: string;
  nodes: PipelineNode[];
};

/**
 * Найти template по (orgId, code). Не создаёт — возвращает null если нет.
 */
export async function findPipelineTemplate(
  organizationId: string,
  templateCode: string
) {
  return db.journalPipelineTemplate.findUnique({
    where: { organizationId_templateCode: { organizationId, templateCode } },
  });
}

/**
 * Получить или создать template для (orgId, code). Используется когда
 * пользователь начинает редактировать pipeline впервые — пустое дерево
 * создаётся автоматически, чтобы node'ы было куда крепить.
 */
export async function ensurePipelineTemplate(
  organizationId: string,
  templateCode: string
) {
  const existing = await findPipelineTemplate(organizationId, templateCode);
  if (existing) return existing;
  return db.journalPipelineTemplate.create({
    data: { organizationId, templateCode },
  });
}

/**
 * Загрузить дерево с узлами в плоском виде (sorted by parentId NULL first,
 * then ordering ASC). UI делает hierarchy на клиенте через nodes.parentId.
 */
export async function loadPipelineTree(
  organizationId: string,
  templateCode: string
): Promise<PipelineTree | null> {
  const template = await findPipelineTemplate(organizationId, templateCode);
  if (!template) return null;
  const rows = await db.journalPipelineNode.findMany({
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
      kind: row.kind === "pinned" ? "pinned" : "custom",
      linkedFieldKey: row.linkedFieldKey,
      title: row.title,
      detail: row.detail,
      hint: row.hint,
      ordering: row.ordering,
      photoMode:
        row.photoMode === "required"
          ? "required"
          : row.photoMode === "optional"
            ? "optional"
            : "none",
      requireComment: row.requireComment,
      requireSignature: row.requireSignature,
    })),
  };
}

/**
 * Подсчитать `ordering` для нового узла «в конце списка детей parentId».
 * Берёт max(ordering) среди siblings + 1024. Использование Float позволяет
 * вставлять между двумя соседями без сдвига всех — берём (a + b) / 2.
 */
export async function computeNextOrdering(
  templateId: string,
  parentId: string | null
): Promise<number> {
  const last = await db.journalPipelineNode.findFirst({
    where: { templateId, parentId },
    orderBy: { ordering: "desc" },
    select: { ordering: true },
  });
  return (last?.ordering ?? 0) + 1024;
}
