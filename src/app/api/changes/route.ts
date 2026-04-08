import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const changes = await db.changeRequest.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(changes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Auto-increment version
  const lastChange = await db.changeRequest.findFirst({
    where: { organizationId: session.user.organizationId },
    orderBy: { version: "desc" },
  });

  const change = await db.changeRequest.create({
    data: {
      organizationId: session.user.organizationId,
      title: body.title,
      changeType: body.changeType || "recipe",
      description: body.description || null,
      riskAssessment: body.riskAssessment || null,
      version: (lastChange?.version || 0) + 1,
      requestedById: session.user.id,
    },
  });

  return NextResponse.json(change, { status: 201 });
}
