import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { LEGAL_IMAGE_KINDS, readLegalImage, type LegalImageKind } from "@/lib/closing-documents/requisites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Превью подписи/печати — только ROOT, без кеша: по прямой ссылке картинки недоступны. */
export async function GET(_request: Request, ctx: { params: Promise<{ kind: string }> }) {
  await requireRoot();
  const { kind } = await ctx.params;
  if (!LEGAL_IMAGE_KINDS.includes(kind as LegalImageKind)) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  const image = await readLegalImage(kind as LegalImageKind);
  if (!image) return NextResponse.json({ error: "Не загружено" }, { status: 404 });
  return new NextResponse(new Uint8Array(image), {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
