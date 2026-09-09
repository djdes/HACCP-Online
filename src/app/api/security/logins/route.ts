import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { LOGIN_METHOD_LABEL, maskIp, type LoginMethod } from "@/lib/login-device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — последние входы текущего пользователя: когда, откуда, с чего. */
export async function GET() {
  const session = await requireAuth();
  const rows = await db.loginEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { at: "desc" },
    take: 30,
    select: { id: true, at: true, ip: true, device: true, method: true, isNewDevice: true },
  });
  return NextResponse.json({
    logins: rows.map((row) => ({
      id: row.id,
      at: row.at.toISOString(),
      ip: maskIp(row.ip),
      device: row.device,
      method: LOGIN_METHOD_LABEL[(row.method as LoginMethod) in LOGIN_METHOD_LABEL ? (row.method as LoginMethod) : "password"],
      isNewDevice: row.isNewDevice,
    })),
  });
}
