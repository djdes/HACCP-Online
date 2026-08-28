import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/notices { key } — «это уведомление я уже видел».
 *
 * Отметка в аккаунте, а не в localStorage: человек открывает кабинет с
 * ноутбука и с телефона, и разовое уведомление, помеченное в одном
 * браузере, во втором всплывало заново.
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.slice(0, 80) : "";
  if (!key) {
    return NextResponse.json({ error: "Не указан ключ" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: auth.session.user.id },
    select: { seenNoticesJson: true },
  });
  const seen =
    user?.seenNoticesJson && typeof user.seenNoticesJson === "object" &&
    !Array.isArray(user.seenNoticesJson)
      ? (user.seenNoticesJson as Record<string, unknown>)
      : {};

  await db.user.update({
    where: { id: auth.session.user.id },
    data: { seenNoticesJson: { ...seen, [key]: true } as never },
  });

  return NextResponse.json({ ok: true });
}
