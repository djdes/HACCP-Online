import { NextResponse, type NextRequest } from "next/server";

import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Показывать ли человеку окно «Что нового» после обновления сервиса.
 *
 * Хранится в аккаунте, а не в браузере: тот, кто окно отключил, не
 * должен получать его заново на телефоне и на втором компьютере.
 * Тот же приём, что и у темы (`/api/me/theme`).
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const enabled =
    typeof body === "object" && body && "enabled" in body
      ? (body as { enabled: unknown }).enabled
      : null;

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 },
    );
  }

  await db.user.update({
    where: { id: auth.session.user.id },
    data: { showWhatsNew: enabled },
  });

  return NextResponse.json({ ok: true, enabled });
}
