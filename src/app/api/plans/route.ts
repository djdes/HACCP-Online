import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {
    organizationId: getActiveOrgId(session),
  };
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59); dateFilter.lte = d; }
    where.date = dateFilter;
  }

  const plans = await db.productionPlan.findMany({
    where,
    orderBy: { date: "desc" },
    take: 50,
  });

  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Некорректное тело" }, { status: 400 });
  }
  // date обязательна и валидная — раньше new Date(undefined) →
  // InvalidDate → Prisma бросала 500.
  if (!body.date) {
    return NextResponse.json({ error: "date обязательна" }, { status: 400 });
  }
  const date = new Date(body.date);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
  }
  const VALID_SHIFTS = ["morning", "day", "evening", "night"];
  const shift =
    typeof body.shift === "string" && VALID_SHIFTS.includes(body.shift)
      ? body.shift
      : "morning";
  // items должен быть array — иначе UI не сможет рендерить JSON-колонку.
  const items = Array.isArray(body.items) ? body.items : [];

  const plan = await db.productionPlan.create({
    data: {
      organizationId: getActiveOrgId(session),
      date,
      shift,
      items,
      status: "draft",
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
