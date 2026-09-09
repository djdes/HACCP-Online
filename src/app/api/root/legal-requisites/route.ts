import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoot } from "@/lib/auth-helpers";
import { readPlatformRequisites, writePlatformRequisites } from "@/lib/closing-documents/requisites";
import { isRequisitesComplete, requisitesChecklist } from "@/lib/closing-documents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Реквизиты нашей организации для закрывающих документов.
 * GET — текущие + чек-лист готовности; PUT — сохранить (картинки
 * загружаются отдельным маршрутом и здесь не перезаписываются).
 */
const text = (max: number) => z.string().trim().max(max).default("");

const schema = z.object({
  nameFull: text(300),
  nameShort: text(120),
  inn: text(12),
  kpp: text(9),
  ogrn: text(15),
  address: text(400),
  bank: z.object({
    name: text(200),
    bik: text(9),
    account: text(20),
    corrAccount: text(20),
  }),
  head: z.object({ post: text(120), name: text(160) }),
  email: text(160),
  phone: text(40),
});

export async function GET() {
  await requireRoot();
  const requisites = await readPlatformRequisites();
  return NextResponse.json({
    requisites,
    checklist: requisitesChecklist(requisites),
    complete: isRequisitesComplete(requisites),
  });
}

export async function PUT(request: Request) {
  await requireRoot();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }
  const current = await readPlatformRequisites();
  const saved = await writePlatformRequisites({
    ...current,
    ...parsed.data,
    vatMode: "none",
  });
  return NextResponse.json({
    requisites: saved,
    checklist: requisitesChecklist(saved),
    complete: isRequisitesComplete(saved),
  });
}
