import { NextResponse } from "next/server";
import { z } from "zod";
import { mintTaskFillToken } from "@/lib/task-fill-token";
import {
  extractTasksFlowBearer,
  findTaskLinkForAuthorizedIntegrations,
  getMatchingTasksFlowIntegrations,
} from "@/lib/tasksflow-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by TasksFlow (server-side, with its own Bearer key) to mint
 * a short-lived HMAC token that the worker can use to open
 * `/task-fill/<taskId>?token=<t>` without any WeSetup session.
 *
 *   POST /api/integrations/tasksflow/task-fill-token
 *   Headers: Authorization: Bearer tfk_…
 *   Body:    { taskId: number }
 *
 * Response:
 *   { token: "42.1776000000.HAfuRdEE…" }
 *
 * The token encodes the taskId and issue timestamp, signed with the
 * integration's `webhookSecret`. TTL 30 minutes (see task-fill-token.ts).
 */
const bodySchema = z.object({
  taskId: z.number().int().positive(),
  integrationId: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const presented = extractTasksFlowBearer(auth);
  if (!presented) {
    return NextResponse.json({ error: "Missing Bearer key" }, { status: 401 });
  }
  const integrations = await getMatchingTasksFlowIntegrations(presented);
  if (integrations.length === 0) {
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

  // Verify the task belongs to this integration. Don't leak the
  // answer on failure — just return a 404.
  const found = await findTaskLinkForAuthorizedIntegrations({
    integrations,
    tasksflowTaskId: payload.taskId,
    preferredIntegrationId: payload.integrationId,
  });
  if (!found) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  const { integration } = found;

  const token = mintTaskFillToken(payload.taskId, integration.webhookSecret);
  const envBase = (process.env.NEXTAUTH_URL ?? "").trim();
  const requestOrigin = new URL(request.url).origin;
  const base =
    envBase && !envBase.includes("localhost") ? envBase : requestOrigin;
  const url = `${base}/task-fill/${payload.taskId}?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ token, url });
}
