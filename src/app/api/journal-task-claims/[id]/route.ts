import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import {
  completeJournalTask,
  releaseJournalTask,
} from "@/lib/journal-task-claims";
import { db } from "@/lib/db";
import {
  validateCompletion,
  type SideEffect,
} from "@/lib/journal-completion-validators";
import { notifyOrganization } from "@/lib/telegram";
import { mirrorClaimToTasksFlow } from "@/lib/tasksflow-claim-mirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 *   POST   /api/journal-task-claims/[id]/release   — отпустить
 *   POST   /api/journal-task-claims/[id]/complete  — завершить (опц. entryId)
 *   DELETE /api/journal-task-claims/[id]          — alias на release
 *
 * Single endpoint с action-в-теле для проще роутинга:
 *   POST /api/journal-task-claims/[id]
 *   body: { action: "release" | "complete", entryId?: string }
 */

const bodySchema = z.object({
  action: z.enum(["release", "complete"]),
  entryId: z.string().optional(),
  /** Form-payload для validator. Если задан — будет провалидирован
   *  через journal-completion-validators до записи complete.
   *  Side-effects (CAPA, Telegram) запускаются после успешной валидации. */
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const userId = session.user.id;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Невалидный запрос" }, { status: 400 });
  }

  // На complete — если передан form-payload, валидируем и запускаем
  // side-effects (CAPA / Telegram) перед фиксацией claim'а.
  let validationWarnings: { message: string }[] = [];
  if (body.action === "complete" && body.data) {
    const claim = await db.journalTaskClaim.findUnique({
      where: { id },
      include: { user: { select: { name: true } } },
    });
    if (claim) {
      const validation = await validateCompletion({
        organizationId: claim.organizationId,
        journalCode: claim.journalCode,
        scopeKey: claim.scopeKey,
        scopeLabel: claim.scopeLabel,
        userId: claim.userId,
        userName: claim.user.name,
        data: body.data,
      });
      if (!validation.ok) {
        return NextResponse.json(
          { ok: false, reason: "validation_failed", errors: validation.errors },
          { status: 400 }
        );
      }
      validationWarnings = validation.warnings;
      await runSideEffects(claim.organizationId, validation.sideEffects);
    }
  }

  const fn =
    body.action === "release"
      ? () => releaseJournalTask({ claimId: id, userId })
      : () =>
          completeJournalTask({
            claimId: id,
            userId,
            entryId: body.entryId,
          });

  const result = await fn();
  if (!result.ok) {
    const map: Record<string, number> = {
      not_found: 404,
      not_owner: 403,
      not_active: 409,
    };
    return NextResponse.json(
      { ok: false, reason: result.reason ?? "internal_error" },
      { status: map[result.reason ?? ""] ?? 500 }
    );
  }

  // После успеха — зеркалим в TasksFlow (background, не блокирует ответ).
  const mirrorClaim = await db.journalTaskClaim.findUnique({ where: { id } });
  if (mirrorClaim) {
    void mirrorClaimToTasksFlow({
      organizationId: mirrorClaim.organizationId,
      journalCode: mirrorClaim.journalCode,
      scopeKey: mirrorClaim.scopeKey,
      userId: mirrorClaim.userId,
      event: body.action === "complete" ? "complete" : "release",
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, warnings: validationWarnings });
}

async function runSideEffects(organizationId: string, effects: SideEffect[]) {
  for (const e of effects) {
    if (e.kind === "create_capa") {
      try {
        await db.capaTicket.create({
          data: {
            organizationId,
            title: e.title,
            description: e.data ? JSON.stringify(e.data, null, 2) : null,
            priority: e.severity === "high" ? "high" : e.severity === "low" ? "low" : "medium",
            category: "journal-anomaly",
            sourceType: "journal-claim",
          },
        });
      } catch (err) {
        console.error("[journal-claim] create_capa failed", err);
      }
    } else if (e.kind === "telegram_alert") {
      try {
        await notifyOrganization(
          organizationId,
          e.message,
          e.recipients === "owners" ? ["owner", "manager"] : ["manager", "head_chef"]
        );
      } catch (err) {
        console.error("[journal-claim] telegram_alert failed", err);
      }
    }
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await releaseJournalTask({
    claimId: id,
    userId: session.user.id,
  });
  if (!result.ok) {
    const map: Record<string, number> = {
      not_found: 404,
      not_owner: 403,
      not_active: 409,
    };
    return NextResponse.json(
      { ok: false, reason: result.reason ?? "internal_error" },
      { status: map[result.reason ?? ""] ?? 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
