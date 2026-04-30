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

  if (typeof body.shiftId !== "string" || typeof body.notes !== "string" || !body.notes.trim()) {
    return NextResponse.json({ error: "shiftId и notes обязательны" }, { status: 400 });
  }
  // Хард-лимит чтоб не пихали тома в JSON-колонку.
  const notes = body.notes.trim().slice(0, 5000);

  const shift = await db.workShift.findFirst({
    where: { id: body.shiftId, organizationId: orgId },
  });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership-check: handover пишет либо сам владелец смены,
  // либо management (admin / head_chef). Раньше любой authenticated
  // юзер мог записать handover-notes на чужую смену.
  const isOwn = shift.userId === session.user.id;
  if (!isOwn) {
    const { hasCapability } = await import("@/lib/permission-presets");
    const isMgmt =
      hasCapability(session.user, "admin.full") ||
      hasCapability(session.user, "tasks.verify");
    if (!isMgmt) {
      return NextResponse.json(
        { error: "Можно сдавать только свою смену" },
        { status: 403 }
      );
    }
  }

  // handoverToId scope-check: должен быть юзером той же org.
  let handoverToId: string | null = null;
  if (typeof body.handoverToId === "string" && body.handoverToId) {
    const target = await db.user.findFirst({
      where: { id: body.handoverToId, organizationId: orgId, archivedAt: null },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Сменщик не найден" },
        { status: 404 }
      );
    }
    handoverToId = target.id;
  }

  const updated = await db.workShift.update({
    where: { id: body.shiftId },
    data: {
      handoverNotes: notes,
      handoverToId,
      handoverAt: new Date(),
    },
  });

  return NextResponse.json({ shift: updated });
}
