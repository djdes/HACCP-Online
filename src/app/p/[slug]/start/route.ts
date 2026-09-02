import { NextResponse } from "next/server";

import { isPartnerAccessLevel } from "@/lib/partners/access-guard";
import { getPartnerBrandBySlug } from "@/lib/partners/branding";
import { PARTNER_REF_COOKIE, PARTNER_REF_MAX_AGE_SEC, encodePartnerRef } from "@/lib/partners/referral";
import { validateSlug } from "@/lib/partners/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `/p/<slug>/start?level=view|edit&to=register|login` — ставит cookie-метку
 * партнёра и ведёт на обычную регистрацию или вход. Регистрация
 * (`/api/auth/instant-register`, `/api/auth/register/confirm`) читает
 * метку и привязывает новую организацию сама. Для уже существующего
 * аккаунта метка не действует — человек подтверждает подключение в
 * «Настройки → Консультант», куда его и ведём после входа.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await ctx.params;
  const url = new URL(request.url);
  const slugCheck = validateSlug(rawSlug);
  if (!slugCheck.ok) return NextResponse.redirect(new URL("/register", url));
  const brand = await getPartnerBrandBySlug(slugCheck.slug);
  if (!brand) return NextResponse.redirect(new URL("/register", url));

  const levelParam = url.searchParams.get("level");
  const level = isPartnerAccessLevel(levelParam) ? levelParam : "view";
  const to = url.searchParams.get("to") === "login" ? "login" : "register";

  const consultantPath = `/settings/consultant?attach=${encodeURIComponent(brand.slug)}&level=${level}`;
  const target =
    to === "login" ? new URL(`/login?next=${encodeURIComponent(consultantPath)}`, url) : new URL("/register", url);

  const res = NextResponse.redirect(target);
  res.cookies.set({
    name: PARTNER_REF_COOKIE,
    value: encodePartnerRef({ slug: brand.slug, level }),
    maxAge: PARTNER_REF_MAX_AGE_SEC,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
