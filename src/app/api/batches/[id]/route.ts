import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { isManagementRole } from "@/lib/user-roles";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batch = await db.batch.findUnique({ where: { id } });
  if (!batch || batch.organizationId !== getActiveOrgId(session)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(batch);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  if (!isManagementRole(session.user.role) && !session.user.isRoot) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const batch = await db.batch.findUnique({ where: { id } });
  if (!batch || batch.organizationId !== getActiveOrgId(session)) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  // Allowlist для status — иначе UI-фильтры (active/consumed/expired)
  // ломаются на «yolo»-значениях из прямого fetch'а.
  const VALID_STATUSES = ["active", "consumed", "expired", "rejected", "quarantine"];
  if (typeof body.status === "string" && VALID_STATUSES.includes(body.status)) {
    data.status = body.status;
  }
  if (typeof body.productName === "string" && body.productName.trim()) {
    data.productName = body.productName.trim().slice(0, 200);
  }
  if (body.notes !== undefined) {
    if (body.notes === null) {
      data.notes = null;
    } else if (typeof body.notes === "string") {
      data.notes = body.notes.slice(0, 2000);
    }
  }
  if (body.expiryDate) {
    const d = new Date(body.expiryDate);
    if (!Number.isNaN(d.getTime())) {
      data.expiryDate = d;
    }
  }

  const updated = await db.batch.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
