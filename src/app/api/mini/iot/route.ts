import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getActiveOrgId(session);

  const equipment = await db.equipment.findMany({
    where: {
      area: { organizationId: orgId },
      tuyaDeviceId: { not: null },
    },
    select: {
      id: true,
      name: true,
      type: true,
      tempMin: true,
      tempMax: true,
      tuyaDeviceId: true,
      area: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ equipment });
}
