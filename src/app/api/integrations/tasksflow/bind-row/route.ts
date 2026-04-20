import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  type CleaningDocumentConfig,
  normalizeCleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { toDateKey } from "@/lib/hygiene-document";
import { decryptSecret } from "@/lib/integration-crypto";
import {
  TasksFlowError,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by TasksFlow when an admin creates a task in «Журнальный» mode.
 *
 * Request:
 *   POST /api/integrations/tasksflow/bind-row
 *   Headers: Authorization: Bearer tfk_…
 *   Body:    { documentId: string, rowKey: string, title?: string }
 *
 * On success creates the TasksFlow task on behalf of the linked cleaner
 * AND registers a `TasksFlowTaskLink` row, so the existing pull /
 * webhook flow mirrors completion back into the journal cell. If the
 * row was already bound, returns the existing taskId without
 * duplicating.
 *
 * Auth is the same Bearer-key resolution as the catalog endpoint —
 * symmetric secret, no second credential.
 */
const bodySchema = z.object({
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

  // 1. Ensure document is a cleaning doc owned by the integration's org.
  const doc = await db.journalDocument.findUnique({
    where: { id: payload.documentId },
    include: { template: true },
  });
  if (
    !doc ||
    doc.organizationId !== integration.organizationId ||
    doc.template.code !== CLEANING_DOCUMENT_TEMPLATE_CODE
  ) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status === "closed") {
    return NextResponse.json(
      { error: "Documento already closed" },
      { status: 400 }
    );
  }

  // 2. Locate the pair + linked TasksFlow user.
  const config = normalizeCleaningDocumentConfig(doc.config) as CleaningDocumentConfig;
  const pair = (config.responsiblePairs ?? []).find((p) => p.id === payload.rowKey);
  if (!pair) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }
  if (!pair.cleaningUserId) {
    return NextResponse.json(
      { error: "У этой строки журнала не назначен ответственный" },
      { status: 400 }
    );
  }
  const userLink = await db.tasksFlowUserLink.findFirst({
    where: {
      integrationId: integration.id,
      wesetupUserId: pair.cleaningUserId,
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

  // 3. Idempotency: existing TaskLink for this row → return as-is.
  const existing = await db.tasksFlowTaskLink.findFirst({
    where: {
      integrationId: integration.id,
      journalDocumentId: doc.id,
      rowKey: pair.id,
    },
  });
  if (existing) {
    return NextResponse.json({
      tasksflowTaskId: existing.tasksflowTaskId,
      created: false,
    });
  }

  // 4. Create the TasksFlow task. journalLink lets TasksFlow render
  //    «Уборка · Имя» with a chip pointing back at the journal row.
  const client = tasksflowClientFor(integration);
  const dateFromIso = toDateKey(doc.dateFrom);
  const dateToIso = toDateKey(doc.dateTo);
  const weekDays = config.skipWeekends ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];

  const journalLink = JSON.stringify({
    kind: "wesetup-cleaning",
    baseUrl: new URL(request.url).origin,
    integrationId: integration.id,
    documentId: doc.id,
    rowKey: pair.id,
    label: `Уборка · ${pair.cleaningUserName || pair.cleaningTitle}`,
  });
  const taskTitle =
    payload.title?.trim() ||
    `Уборка · ${pair.cleaningUserName || pair.cleaningTitle}`;

  let created;
  try {
    created = await client.createTask({
      title: taskTitle,
      workerId: userLink.tasksflowUserId,
      requiresPhoto: false,
      isRecurring: true,
      weekDays,
      category: "WeSetup · Уборка",
      description: [
        `Журнал: ${doc.title}`,
        `Период: ${dateFromIso} — ${dateToIso}`,
        pair.controlUserName
          ? `Контроль: ${pair.controlUserName} (${pair.controlTitle})`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      // Custom field: smuggle journalLink via update right after
      // create. createTask shape doesn't include it, so we do a
      // follow-up updateTask. TasksFlow's PUT accepts arbitrary fields
      // from insertTaskSchema.partial() including journalLink (added
      // in the corresponding TasksFlow patch).
    } as never);
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
  // Set journalLink in a follow-up PUT so we don't have to widen the
  // typed createTask signature in tasksflow-client just for this.
  try {
    await client.updateTask(created.id, { journalLink } as never);
  } catch (err) {
    console.error("[bind-row] journalLink update failed", err);
    // Non-fatal — task exists, just lacks the link metadata for UI.
  }

  await db.tasksFlowTaskLink.create({
    data: {
      integrationId: integration.id,
      journalCode: CLEANING_DOCUMENT_TEMPLATE_CODE,
      journalDocumentId: doc.id,
      rowKey: pair.id,
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
  });
}
