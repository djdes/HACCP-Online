import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
  };
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { productName: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { supplier: { contains: search, mode: "insensitive" } },
    ];
  }

  const batches = await db.batch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(batches);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const orgId = session.user.organizationId;

  // Generate batch code: B-YYYYMMDD-NNN
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const count = await db.batch.count({
    where: {
      organizationId: orgId,
      createdAt: { gte: todayStart },
    },
  });
  const code = `B-${dateStr}-${String(count + 1).padStart(3, "0")}`;

  const batch = await db.batch.create({
    data: {
      code,
      organizationId: orgId,
      productName: body.productName,
      supplier: body.supplier || null,
      quantity: Number(body.quantity),
      unit: body.unit || "kg",
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      sourceEntryId: body.sourceEntryId || null,
      notes: body.notes || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(batch, { status: 201 });
}
