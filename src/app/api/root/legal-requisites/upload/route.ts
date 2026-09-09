import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import {
  LEGAL_IMAGE_KINDS,
  LEGAL_IMAGE_MAX_BYTES,
  isPng,
  saveLegalImage,
  type LegalImageKind,
} from "@/lib/closing-documents/requisites";
import { isRequisitesComplete, requisitesChecklist } from "@/lib/closing-documents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart: `kind` = facsimile | stamp, `file` — PNG до 1 МБ.
 * Только PNG: подпись и печать с прозрачным фоном ложатся на бланк, а
 * JPEG принёс бы белый прямоугольник поверх текста.
 */
export async function POST(request: Request) {
  await requireRoot();
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const file = form?.get("file");
  if (typeof kind !== "string" || !LEGAL_IMAGE_KINDS.includes(kind as LegalImageKind)) {
    return NextResponse.json({ error: "Укажите, что загружаете: подпись или печать" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не получен" }, { status: 400 });
  }
  if (file.size > LEGAL_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 1 МБ — уменьшите картинку" }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isPng(bytes)) {
    return NextResponse.json({ error: "Нужен PNG с прозрачным фоном" }, { status: 400 });
  }
  const saved = await saveLegalImage(kind as LegalImageKind, bytes);
  return NextResponse.json({
    requisites: saved,
    checklist: requisitesChecklist(saved),
    complete: isRequisitesComplete(saved),
  });
}
