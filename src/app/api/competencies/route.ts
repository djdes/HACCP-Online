import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competencies = await db.staffCompetency.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ userId: "asc" }, { skill: "asc" }],
  });

  return NextResponse.json(competencies);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "owner" && session.user.role !== "technologist") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const competency = await db.staffCompetency.upsert({
    where: {
      organizationId_userId_skill: {
        organizationId: session.user.organizationId,
        userId: body.userId,
        skill: body.skill,
      },
    },
    update: {
      level: body.level,
      certifiedAt: body.level > 0 ? new Date() : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      certifiedById: session.user.id,
      notes: body.notes || null,
    },
    create: {
      organizationId: session.user.organizationId,
      userId: body.userId,
      skill: body.skill,
      level: body.level,
      certifiedAt: body.level > 0 ? new Date() : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      certifiedById: session.user.id,
      notes: body.notes || null,
    },
  });

  return NextResponse.json(competency);
}
