import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH { enabled } — включить/выключить код в Telegram при входе. Только с привязанным Telegram. */
export async function PATCH(request: Request) {
  const session = await requireAuth();
  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { telegramChatId: true } });
  if (body.enabled && !user?.telegramChatId) {
    return NextResponse.json(
      { error: "Сначала привяжите Telegram — код приходит туда. Это делается в профиле приложения." },
      { status: 409 }
    );
  }
  await db.user.update({ where: { id: session.user.id }, data: { twoFactorTelegram: body.enabled } });
  await recordAuditLog({
    organizationId: session.user.organizationId,
    session,
    request,
    action: body.enabled ? "security.two-factor.on" : "security.two-factor.off",
    entity: "User",
    entityId: session.user.id,
  });
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
