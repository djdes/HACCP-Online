import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";
import { getAdapter } from "@/lib/tasksflow-adapters";
import { buildCompletionValidator } from "@/lib/tasksflow-adapters/task-form";
import { toDateKey } from "@/lib/hygiene-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Apply a completion with structured form values.
 *
 *   POST /api/integrations/tasksflow/complete
 *   Headers: Authorization: Bearer tfk_…
 *   Body:
 *     {
 *       "taskId":      number,
 *       "isCompleted": boolean,     // false to undo
 *       "values":      Record<string, unknown>   // per TaskFormSchema
 *     }
 *
 * Validated against the journal's TaskFormSchema (if any), then the
 * adapter's `applyRemoteCompletion({values})` maps into the journal's
 * native model. Idempotent — same payload twice is a no-op.
 *
 * This supplements the existing webhook + sync-tasks paths. Those two
 * track only `isCompleted` (boolean). This endpoint also carries the
 * structured form values the employee entered.
 */
const bodySchema = z.object({
  taskId: z.number().int().positive(),
  isCompleted: z.boolean(),
  values: z.record(z.string(), z.unknown()).optional(),
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

  const link = await db.tasksFlowTaskLink.findFirst({
    where: {
      integrationId: integration.id,
      tasksflowTaskId: payload.taskId,
    },
  });
  if (!link) {
    return NextResponse.json(
      { error: "Task not bound to a journal row" },
      { status: 404 }
    );
  }

  const adapter = getAdapter(link.journalCode);
  if (!adapter) {
    return NextResponse.json(
      { error: `Журнал «${link.journalCode}» не имеет адаптера` },
      { status: 400 }
    );
  }

  // Validate values against the form schema if the adapter publishes one.
  let sanitized: Record<string, string | number | boolean | null> = {};
  const sourceValues = (payload.values ?? {}) as Record<string, unknown>;
  if (adapter.getTaskForm) {
    try {
      const schema = await adapter.getTaskForm({
        documentId: link.journalDocumentId,
        rowKey: link.rowKey,
      });
      if (schema) {
        const validator = buildCompletionValidator(schema);
        sanitized = validator.parse(sourceValues) as typeof sanitized;
      } else {
        sanitized = coerceValues(sourceValues);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: `Ошибка валидации: ${err.issues[0]?.message ?? "неизвестно"}`,
          },
          { status: 400 }
        );
      }
      throw err;
    }
  } else {
    sanitized = coerceValues(sourceValues);
  }

  const todayKey = toDateKey(new Date());
  const changed = await adapter.applyRemoteCompletion({
    documentId: link.journalDocumentId,
    rowKey: link.rowKey,
    completed: payload.isCompleted,
    todayKey,
    values: sanitized,
  });

  await db.tasksFlowTaskLink.update({
    where: { id: link.id },
    data: {
      remoteStatus: payload.isCompleted ? "completed" : "active",
      completedAt: payload.isCompleted ? new Date() : null,
      lastDirection: "pull",
    },
  });

  return NextResponse.json({ ok: true, applied: changed, todayKey });
}

/** Best-effort narrow of unknown values to the shape adapters expect. */
function coerceValues(
  raw: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
    }
  }
  return out;
}
