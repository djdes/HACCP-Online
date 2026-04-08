import { getServerSession } from "@/lib/server-session";
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

  const records = await db.lossRecord.findMany({
    where,
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const record = await db.lossRecord.create({
    data: {
      organizationId: session.user.organizationId,
      category: body.category,
      productName: body.productName,
      quantity: Number(body.quantity),
      unit: body.unit || "kg",
      costRub: body.costRub ? Number(body.costRub) : null,
      cause: body.cause || null,
      areaId: body.areaId || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
