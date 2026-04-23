import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = getActiveOrgId(session);
  const scopes = await db.managerScope.findMany({
    where: { organizationId: orgId },
    include: {
      manager: {
        select: { id: true, name: true, jobPositionId: true, positionTitle: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ scopes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = getActiveOrgId(session);
  const body = (await req.json().catch(() => ({}))) as {
    managerId?: string;
    viewMode?: string;
    viewJobPositionIds?: string[];
    viewUserIds?: string[];
    assignableJournalCodes?: string[];
  };

  if (!body.managerId) {
    return NextResponse.json({ error: "managerId required" }, { status: 400 });
  }

  // Verify manager belongs to same org
  const manager = await db.user.findFirst({
    where: { id: body.managerId, organizationId: orgId },
    select: { id: true },
  });
  if (!manager) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  const scope = await db.managerScope.upsert({
    where: { organizationId_managerId: { organizationId: orgId, managerId: body.managerId } },
    create: {
      organizationId: orgId,
      managerId: body.managerId,
      viewMode: body.viewMode ?? "all",
      viewJobPositionIds: body.viewJobPositionIds ?? [],
      viewUserIds: body.viewUserIds ?? [],
      assignableJournalCodes: body.assignableJournalCodes ?? [],
    },
    update: {
      viewMode: body.viewMode,
      viewJobPositionIds: body.viewJobPositionIds,
      viewUserIds: body.viewUserIds,
      assignableJournalCodes: body.assignableJournalCodes,
    },
  });

  return NextResponse.json({ scope });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = getActiveOrgId(session);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.managerScope.deleteMany({
    where: { id, organizationId: orgId },
  });

  return NextResponse.json({ deleted: true });
}
