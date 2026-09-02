import { NextResponse } from "next/server";

import { isLogoVariant, readPartnerLogo } from "@/lib/partners/branding-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Публичная раздача логотипа партнёра: `/api/partner-assets/<id>/logo?variant=light&v=<n>`.
 * Без авторизации — лого светится на странице входа `/p/<slug>` и в письмах.
 * SVG отдаём с `sandbox`-CSP и nosniff: даже если sanitize что-то
 * пропустил, в браузере он открывается только как картинка без скриптов.
 */
export async function GET(request: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params;
  const url = new URL(request.url);
  const variantRaw = url.searchParams.get("variant") ?? "light";
  const variant = isLogoVariant(variantRaw) ? variantRaw : "light";

  const logo = await readPartnerLogo(partnerId, variant);
  if (!logo) return new NextResponse(null, { status: 404 });

  const body = new Uint8Array(logo.bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": logo.mime,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      "Content-Disposition": "inline",
    },
  });
}
