import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import {
  completeJournalTask,
  releaseJournalTask,
} from "@/lib/journal-task-claims";

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
  return NextResponse.json({ ok: true });
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
