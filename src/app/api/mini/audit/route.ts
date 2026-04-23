import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const orgId = getActiveOrgId(session);

  const logs = await db.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      userName: true,
      action: true,
      entity: true,
      entityId: true,
      details: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
