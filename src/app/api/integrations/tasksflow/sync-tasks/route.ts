import { NextResponse } from "next/server";
import { resolveOrgFromTasksflowBearerOrSession } from "@/lib/tasksflow-auth";
import { pullCompletionsForOrganization } from "@/lib/tasksflow-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual / scheduled poll: ask TasksFlow for the current state of every
 * remote task we created on behalf of this org, and mirror new
 * completions back into the journal matrix.
 *
 * Used as a fallback while TasksFlow doesn't yet ship outbound
 * webhooks. The cleaning document UI calls this on mount so the user
 * sees today's marks immediately on open without waiting for cron.
 *
 * Auth: WeSetup admin session ИЛИ `Bearer tfk_…` (TasksFlow-side
 * `/api/wesetup/sync-tasks` proxy).
 */

// In-process throttle: at most 1 pull per ORG per THROTTLE_MS. Несколько
// menedzherov одновременно открывают журнал — мы не дёргаем TF /api/tasks
// 5 раз подряд, отдаём cached результат. Защита от 429 на стороне TF.
const THROTTLE_MS = 30_000;
const lastPullByOrg = new Map<
  string,
  {
    at: number;
    summary: {
      checked: number;
      newlyCompleted: number;
      reopened: number;
      errors: number;
    };
  }
>();

export async function POST(request: Request) {
  const auth = await resolveOrgFromTasksflowBearerOrSession(request);
  if (!auth.ok) return auth.response;
  const orgId = auth.organizationId;

  const now = Date.now();
  const last = lastPullByOrg.get(orgId);
  if (last && now - last.at < THROTTLE_MS) {
    return NextResponse.json({
      ...last.summary,
      throttled: true,
      retryAfterMs: THROTTLE_MS - (now - last.at),
    });
  }

  const summary = await pullCompletionsForOrganization({
    organizationId: orgId,
  }).catch((error) => {
    console.error("[tasksflow-sync] completion pull failed", error);
    return { checked: 0, newlyCompleted: 0, reopened: 0, errors: 1 };
  });
  lastPullByOrg.set(orgId, { at: now, summary });
  return NextResponse.json(summary);
}
