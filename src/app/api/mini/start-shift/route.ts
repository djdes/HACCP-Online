import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  effectivePreset,
  hasCapability,
} from "@/lib/permission-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * GET /api/mini/start-shift
 *   → { shiftStarted: boolean, gateRequired: boolean }
 *
 *   gateRequired = true для линейного персонала (не admin/head_chef).
 *   shiftStarted = есть ли WorkShift на сегодня с status='scheduled'.
 *
 *   Mini App клиент использует это для показа «Начать смену» CTA
 *   до того как пускать к задачам.
 *
 * POST /api/mini/start-shift
 *   → { ok: true, shift: { id, date, status } }
 *
 *   Создаёт/обновляет WorkShift на сегодня status='scheduled'. Идемпотентно.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const userId = session.user.id;

  // Admin / head_chef не нужен gate.
  const gateRequired =
    !hasCapability(session.user, "admin.full") &&
    !hasCapability(session.user, "tasks.verify");

  const today = utcMidnight(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const shift = await db.workShift.findFirst({
    where: { userId, date: { gte: today, lt: tomorrow } },
    select: { id: true, status: true, date: true },
  });

  return NextResponse.json({
    gateRequired,
    shiftStarted: shift?.status === "scheduled",
    today: today.toISOString().slice(0, 10),
    preset: effectivePreset({
      role: session.user.role,
      isRoot: session.user.isRoot,
      permissionPreset: session.user.permissionPreset,
    }),
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const userId = session.user.id;
  const organizationId = getActiveOrgId(session);

  const today = utcMidnight(new Date());

  const shift = await db.workShift.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      organizationId,
      date: today,
      status: "scheduled",
    },
    update: { status: "scheduled" },
    select: { id: true, status: true, date: true },
  });

  return NextResponse.json({ ok: true, shift });
}
