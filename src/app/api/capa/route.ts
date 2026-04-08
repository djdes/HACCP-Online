import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
  };
  if (status && status !== "all") where.status = status;
  if (priority && priority !== "all") where.priority = priority;

  const tickets = await db.capaTicket.findMany({
    where,
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const ticket = await db.capaTicket.create({
    data: {
      organizationId: session.user.organizationId,
      title: body.title,
      description: body.description || null,
      priority: body.priority || "medium",
      category: body.category || "other",
      sourceType: body.sourceType || null,
      sourceEntryId: body.sourceEntryId || null,
      assignedToId: body.assignedToId || null,
      slaHours: body.slaHours || 24,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(ticket, { status: 201 });
}
