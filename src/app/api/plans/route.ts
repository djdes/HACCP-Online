import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
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

  const body = await req.json();
  const plan = await db.productionPlan.create({
    data: {
      organizationId: session.user.organizationId,
      date: new Date(body.date),
      shift: body.shift || "morning",
      items: body.items || [],
      status: "draft",
      notes: body.notes || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
