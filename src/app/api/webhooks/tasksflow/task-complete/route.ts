import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  applyRemoteCompletion,
  findTaskLinkByRemoteId,
} from "@/lib/tasksflow-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound webhook from tasksflow.ru. TasksFlow doesn't ship a webhook
 * system today; this endpoint is the contract we'll ask them to call:
 *
 *   POST /api/webhooks/tasksflow/task-complete
 *   Headers:
 *     Content-Type: application/json
 *     X-TasksFlow-Signature: <hex sha256 hmac of raw body, key=integration.webhookSecret>
 *   Body:
 *     {
 *       "taskId":      number,
 *       "isCompleted": boolean,
 *       "completedAt": number   // unix seconds, optional
 *     }
 *
 * We resolve the integration via `taskId → TasksFlowTaskLink → integration`,
 * verify the HMAC against that integration's `webhookSecret`, then mark the
 * cell. On HMAC mismatch we return 401 without leaking which integration we
 * looked up (avoids enumeration).
 *
 * Until TasksFlow implements webhooks, the same effect can be obtained by
 * polling — see `POST /api/integrations/tasksflow/sync-tasks`.
 */
const payloadSchema = z.object({
  taskId: z.number().int().positive(),
  isCompleted: z.boolean(),
  completedAt: z.number().int().nonnegative().optional(),
});

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-tasksflow-signature") ?? "";
  const raw = await request.text();
  if (!signature || !raw) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  let parsed: z.infer<typeof payloadSchema>;
  try {
    parsed = payloadSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const found = await findTaskLinkByRemoteId(parsed.taskId);
  if (!found) {
    // Don't 404 — that tells a probe whether a given task id is bound
    // to any of our integrations. Pretend we accepted but did nothing.
    return NextResponse.json({ ok: true, applied: false });
  }

  const expected = crypto
    .createHmac("sha256", found.integration.webhookSecret)
    .update(raw)
    .digest("hex");

  if (!safeEqual(signature, expected)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const changed = await applyRemoteCompletion({
    documentId: found.link.journalDocumentId,
    rowKey: found.link.rowKey,
    completed: parsed.isCompleted,
  });

  await db.tasksFlowTaskLink.update({
    where: { id: found.link.id },
    data: {
      remoteStatus: parsed.isCompleted ? "completed" : "active",
      completedAt: parsed.isCompleted
        ? parsed.completedAt
          ? new Date(parsed.completedAt * 1000)
          : new Date()
        : null,
      lastDirection: "pull",
    },
  });

  return NextResponse.json({ ok: true, applied: changed });
}
