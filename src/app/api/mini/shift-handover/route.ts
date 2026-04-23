import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getActiveOrgId(session);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const shifts = await db.workShift.findMany({
    where: { organizationId: orgId, date: today },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ shifts });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getActiveOrgId(session);
  const body = (await req.json().catch(() => ({}))) as {
    shiftId?: string;
    notes?: string;
    handoverToId?: string;
  };

  if (!body.shiftId || !body.notes) {
    return NextResponse.json({ error: "shiftId and notes required" }, { status: 400 });
  }

  const shift = await db.workShift.findFirst({
    where: { id: body.shiftId, organizationId: orgId },
  });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.workShift.update({
    where: { id: body.shiftId },
    data: {
      handoverNotes: body.notes,
      handoverToId: body.handoverToId || null,
      handoverAt: new Date(),
    },
  });

  return NextResponse.json({ shift: updated });
}
