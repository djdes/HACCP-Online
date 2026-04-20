import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";
import {
  TasksFlowError,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";
import { getAdapter } from "@/lib/tasksflow-adapters";
import { toDateKey } from "@/lib/hygiene-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generic bind: TasksFlow asks us to attach a journal row to a remote
 * task. Works for any journal whose adapter is registered in
 * `src/lib/tasksflow-adapters/index.ts`.
 *
 *   POST /api/integrations/tasksflow/bind-row
 *   Headers: Authorization: Bearer tfk_…
 *   Body:
 *     {
 *       "journalCode": "cleaning",
 *       "documentId":  "cmo7…",
 *       "rowKey":      "cleaning-pair-…",
 *       "title":       "..."   // optional override
 *     }
 *
 * Response:
 *   { "tasksflowTaskId": 14, "created": true|false }
 *
 * Idempotent: existing TaskLink for the same (integration, doc, row)
 * → returns the existing task id instead of duplicating.
 */
const bodySchema = z.object({
  journalCode: z.string().min(1),
  documentId: z.string().min(1),
  rowKey: z.string().min(1),
  title: z.string().trim().max(255).optional(),
});

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(tfk_[A-Za-z0-9_-]+)$/.exec(auth);
  if (!match) {
    return NextResponse.json({ error: "Missing Bearer key" }, { status: 401 });
  }
  const presented = match[1];
  const prefix = presented.slice(0, 12);

  const candidates = await db.tasksFlowIntegration.findMany({
    where: { enabled: true, apiKeyPrefix: prefix },
  });
  let integration: (typeof candidates)[number] | null = null;
  for (const cand of candidates) {
    try {
      if (decryptSecret(cand.apiKeyEncrypted) === presented) {
        integration = cand;
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (!integration) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const adapter = getAdapter(payload.journalCode);
  if (!adapter) {
    return NextResponse.json(
      { error: `Журнал "${payload.journalCode}" не поддерживается` },
      { status: 400 }
    );
  }

  // Verify document is owned by the integration's org and matches the
  // declared journalCode. Adapter listing then gives us the canonical
  // row metadata (label, responsibleUserId).
  const doc = await db.journalDocument.findUnique({
    where: { id: payload.documentId },
    include: { template: true },
  });
  if (
    !doc ||
    doc.organizationId !== integration.organizationId ||
    doc.template.code !== payload.journalCode
  ) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status === "closed") {
    return NextResponse.json({ error: "Document already closed" }, { status: 400 });
  }

  const adapterDocs = await adapter.listDocumentsForOrg(integration.organizationId);
  const adapterDoc = adapterDocs.find((d) => d.documentId === doc.id);
  const row = adapterDoc?.rows.find((r) => r.rowKey === payload.rowKey);
  if (!adapterDoc || !row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }
  if (!row.responsibleUserId) {
    return NextResponse.json(
      { error: "У этой строки журнала не назначен ответственный" },
      { status: 400 }
    );
  }

  const userLink = await db.tasksFlowUserLink.findFirst({
    where: {
      integrationId: integration.id,
      wesetupUserId: row.responsibleUserId,
    },
  });
  if (!userLink?.tasksflowUserId) {
    return NextResponse.json(
      {
        error:
          "Сотрудник ещё не связан с TasksFlow. Откройте /settings/integrations/tasksflow и нажмите «Синхронизировать».",
      },
      { status: 400 }
    );
  }

  // Idempotent: already bound → return existing.
  const existing = await db.tasksFlowTaskLink.findFirst({
    where: {
      integrationId: integration.id,
      journalDocumentId: doc.id,
      rowKey: row.rowKey,
    },
  });
  if (existing) {
    return NextResponse.json({
      tasksflowTaskId: existing.tasksflowTaskId,
      created: false,
    });
  }

  const schedule = adapter.scheduleForRow(row, adapterDoc);
  const title =
    payload.title?.trim() ||
    adapter.titleForRow?.(row, adapterDoc) ||
    row.label;
  const description = adapter.descriptionForRow?.(row, adapterDoc) ?? undefined;

  const journalLink = JSON.stringify({
    kind: `wesetup-${payload.journalCode}`,
    baseUrl: new URL(request.url).origin,
    integrationId: integration.id,
    documentId: doc.id,
    rowKey: row.rowKey,
    label: title,
  });

  const client = tasksflowClientFor(integration);
  let created;
  try {
    created = await client.createTask({
      title,
      workerId: userLink.tasksflowUserId,
      requiresPhoto: false,
      isRecurring: true,
      weekDays: schedule.weekDays,
      monthDay: schedule.monthDay ?? null,
      category: `WeSetup · ${adapter.meta.label}`,
      description: description ?? "",
    });
  } catch (err) {
    if (err instanceof TasksFlowError) {
      return NextResponse.json(
        { error: `TasksFlow ${err.status}: ${err.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Не удалось создать задачу в TasksFlow" },
      { status: 502 }
    );
  }
  // Smuggle the journalLink via follow-up PUT (createTask shape doesn't
  // expose it). Non-fatal — task exists either way.
  try {
    await client.updateTask(created.id, { journalLink } as never);
  } catch (err) {
    console.error("[bind-row] journalLink update failed", err);
  }

  await db.tasksFlowTaskLink.create({
    data: {
      integrationId: integration.id,
      journalCode: payload.journalCode,
      journalDocumentId: doc.id,
      rowKey: row.rowKey,
      tasksflowTaskId: created.id,
      remoteStatus: created.isCompleted ? "completed" : "active",
      lastDirection: "push",
    },
  });
  await db.tasksFlowIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });

  return NextResponse.json({
    tasksflowTaskId: created.id,
    created: true,
    todayKey: toDateKey(new Date()),
  });
}
