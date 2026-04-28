import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET / POST /api/mini/shift/me
 *
 * Self-service «вышел / закончил смену» для линейного сотрудника. Рабочая
 * смена держится в `WorkShift.status` — без явных полей `startedAt` /
 * `endedAt`, чтобы не менять shared schema (см. THREAD_BOT.md). Поэтому
 * мы используем строковые статусы:
 *   - `scheduled` — запланирована руководителем, ещё не начата;
 *   - `working`   — сотрудник нажал «вышел на смену»;
 *   - `ended`     — сотрудник нажал «закончил смену»;
 *   - `absent`    — shift-watcher автоматически пометил отсутствие.
 *
 * GET → текущий статус сегодняшней смены (или `none`, если её нет).
 * POST {action: "start"|"end"} → переключает статус с дедупом (повторный
 * "start" ничего не делает, "end" без working — 400).
 */

const todayUtcMidnight = (): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

async function findOrUpsertTodaysShift(args: {
  userId: string;
  organizationId: string;
  desiredStatus: "working";
}) {
  const date = todayUtcMidnight();
  // unique constraint on (userId, date) — upsert по нему. Если смена
  // уже существует со статусом scheduled / ended / absent — переключаем
  // на working, без потери handover-полей и jobPositionId.
  return db.workShift.upsert({
    where: { userId_date: { userId: args.userId, date } },
    update: { status: args.desiredStatus },
    create: {
      organizationId: args.organizationId,
      userId: args.userId,
      date,
      status: args.desiredStatus,
    },
  });
}

const POST_BODY = z.object({
  action: z.enum(["start", "end"]),
});

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const date = todayUtcMidnight();
  const shift = await db.workShift.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
    select: { id: true, status: true, updatedAt: true },
  });

  if (!shift) {
    return NextResponse.json({ status: "none" as const, shiftId: null, updatedAt: null });
  }
  return NextResponse.json({
    status: shift.status,
    shiftId: shift.id,
    updatedAt: shift.updatedAt,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const json = await request.json().catch(() => null);
  const parsed = POST_BODY.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ожидался { action: 'start' | 'end' }" },
      { status: 400 }
    );
  }

  if (parsed.data.action === "start") {
    const shift = await findOrUpsertTodaysShift({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      desiredStatus: "working",
    });
    return NextResponse.json({
      status: shift.status,
      shiftId: shift.id,
      updatedAt: shift.updatedAt,
    });
  }

  // "end" — переводим только если есть смена и она в working.
  // Закрытие не-working / отсутствующей смены семантически странное:
  // это либо двойной нажим, либо попытка закрыть «без открытия».
  const date = todayUtcMidnight();
  const existing = await db.workShift.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Сегодня ещё нет открытой смены" },
      { status: 400 }
    );
  }
  if (existing.status === "ended") {
    return NextResponse.json({ status: "ended", shiftId: existing.id, updatedAt: null });
  }
  if (existing.status !== "working") {
    return NextResponse.json(
      { error: `Нельзя завершить смену в статусе «${existing.status}»` },
      { status: 400 }
    );
  }
  const updated = await db.workShift.update({
    where: { id: existing.id },
    data: { status: "ended" },
    select: { id: true, status: true, updatedAt: true },
  });
  return NextResponse.json({
    status: updated.status,
    shiftId: updated.id,
    updatedAt: updated.updatedAt,
  });
}
