import { NextResponse } from "next/server";

import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SEC,
} from "@/lib/balance/constants";
import { resolveReferrerByCode } from "@/lib/balance/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `/r/<code>` — ссылка «порекомендуй другу».
 *
 * Ставит cookie с кодом рекомендателя и ведёт на обычную регистрацию:
 * привязку делает сама регистрация (`instant-register`,
 * `register/confirm`) и оплата. Клиенту код вводить не нужно — метка
 * живёт в cookie, поэтому и в адресе после редиректа его нет.
 *
 * Неизвестный код — просто регистрация без метки: битая ссылка не должна
 * упираться в ошибку.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const url = new URL(request.url);
  const referrer = await resolveReferrerByCode(code);
  if (!referrer) {
    return NextResponse.redirect(new URL("/register", url));
  }

  const target = new URL("/register?ref=1", url);
  const email = url.searchParams.get("email");
  if (email && email.includes("@") && email.length <= 200) {
    target.searchParams.set("email", email);
  }

  const response = NextResponse.redirect(target);
  response.cookies.set({
    name: REFERRAL_COOKIE,
    value: code.trim().toUpperCase(),
    maxAge: REFERRAL_COOKIE_MAX_AGE_SEC,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
