import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { recordAuditLog } from "@/lib/audit-log";
import {
  ensurePipelineTemplate,
  loadPipelineTree,
} from "@/lib/journal-pipeline-tree";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FieldDef = {
  key?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
};

/**
 * POST /api/settings/journal-pipelines/[code]/seed
 *
 * Заводит шаблон pipeline'а с pinned-узлами по списку колонок журнала
 * из `JournalTemplate.fields`. Для каждого field создаёт узел вида:
 *   {
 *     kind: "pinned",
 *     linkedFieldKey: field.key,
 *     title: field.label,
 *     ordering: index * 1024,
 *   }
 *
 * Идемпотентен: если в шаблоне уже есть pinned-узлы — endpoint
 * возвращает 409, чтобы случайно не задублировать. Если нужно пере-сидить,
 * сначала вызывается DELETE на конкретные узлы (или будущий ENDPOINT
 * `clear-pinned` если понадобится — пока нет).
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const { code } = await ctx.params;
  const organizationId = getActiveOrgId(auth.session);

  const journalTemplate = await db.journalTemplate.findUnique({
    where: { code },
    select: { id: true, fields: true, code: true },
  });
  if (!journalTemplate) {
    return NextResponse.json(
      { error: "Журнал с таким кодом не найден" },
      { status: 404 }
    );
  }

  const rawFields = journalTemplate.fields;
  if (!Array.isArray(rawFields)) {
    return NextResponse.json(
      { error: "У журнала нет описанных колонок (fields пуст)" },
      { status: 400 }
    );
  }

  const template = await ensurePipelineTemplate(organizationId, code);

  const existingPinned = await db.journalPipelineNode.count({
    where: { templateId: template.id, kind: "pinned" },
  });
  if (existingPinned > 0) {
    return NextResponse.json(
      {
        error:
          "Pinned-узлы уже созданы для этого шаблона. Удалите их вручную перед повторным seed'ом.",
      },
      { status: 409 }
    );
  }

  const fields = rawFields as FieldDef[];
  const created: { id: string; linkedFieldKey: string; title: string }[] = [];

  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    const key = typeof field?.key === "string" ? field.key : null;
    const label = typeof field?.label === "string" ? field.label : key;
    if (!key || !label) continue;

    const node = await db.journalPipelineNode.create({
      data: {
        templateId: template.id,
        parentId: null,
        kind: "pinned",
        linkedFieldKey: key,
        title: label,
        ordering: (index + 1) * 1024,
        photoMode: "none",
        requireComment: false,
        requireSignature: false,
      },
    });
    created.push({ id: node.id, linkedFieldKey: key, title: label });
  }

  await recordAuditLog({
    request,
    session: auth.session,
    organizationId,
    action: "settings.journal-pipelines.seed",
    entity: "JournalPipelineTemplate",
    entityId: template.id,
    details: { templateCode: code, createdCount: created.length },
  });

  const tree = await loadPipelineTree(organizationId, code);
  return NextResponse.json({ tree, created });
}
