import { NextResponse } from "next/server";

import { requirePartnerApi } from "@/lib/partners/api";
import { isLogoVariant, removePartnerLogo, setPartnerLogo } from "@/lib/partners/branding-admin";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { LOGO_MAX_BYTES } from "@/lib/partners/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data: file=<png|svg>, variant=light|dark.
 * DELETE ?variant=light|dark.
 */
export async function POST(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Ожидается multipart/form-data" }, { status: 400 });
  const variant = form.get("variant");
  if (!isLogoVariant(variant)) return NextResponse.json({ error: "variant: light или dark" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  if (file.size > LOGO_MAX_BYTES) return NextResponse.json({ error: "Логотип больше 500 КБ" }, { status: 413 });

  try {
    const result = await setPartnerLogo({
      partnerId: auth.ctx.membership.partnerId,
      variant,
      bytes: new Uint8Array(await file.arrayBuffer()),
      declaredMime: file.type,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const variant = new URL(request.url).searchParams.get("variant");
  if (!isLogoVariant(variant)) return NextResponse.json({ error: "variant: light или dark" }, { status: 400 });
  try {
    await removePartnerLogo(auth.ctx.membership.partnerId, variant);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
