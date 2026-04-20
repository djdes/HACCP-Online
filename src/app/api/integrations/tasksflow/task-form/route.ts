import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";
import { getAdapter } from "@/lib/tasksflow-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return the TaskFormSchema for a specific TasksFlow task, so the
 * employee's detail screen can render the right form (dropdown /
 * number / text / etc.) before confirming.
 *
 *   GET /api/integrations/tasksflow/task-form?taskId=42
 *   Headers: Authorization: Bearer tfk_…
 *
 * When the task's journal has no registered adapter or the adapter
 * doesn't implement `getTaskForm` — returns `{ form: null }` so the
 * client falls back to a plain «Выполнено» button (cleaning-style).
 */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const taskIdRaw = url.searchParams.get("taskId");
  const taskId = Number(taskIdRaw);
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "Bad taskId" }, { status: 400 });
  }

  const link = await db.tasksFlowTaskLink.findFirst({
    where: { integrationId: integration.id, tasksflowTaskId: taskId },
  });
  if (!link) {
    return NextResponse.json({ form: null, journalCode: null });
  }

  const adapter = getAdapter(link.journalCode);
  if (!adapter?.getTaskForm) {
    return NextResponse.json({ form: null, journalCode: link.journalCode });
  }
  try {
    const form = await adapter.getTaskForm({
      documentId: link.journalDocumentId,
      rowKey: link.rowKey,
    });
    return NextResponse.json({ form, journalCode: link.journalCode });
  } catch (err) {
    console.error("[task-form] adapter failed", err);
    return NextResponse.json({ form: null, journalCode: link.journalCode });
  }
}
