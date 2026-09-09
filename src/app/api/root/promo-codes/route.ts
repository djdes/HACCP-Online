import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isValidPromoCodeFormat, normalizePromoCode } from "@/lib/promo/rules";
import { promoPaidUses } from "@/lib/promo/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().trim().min(3).max(32),
  kind: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1).max(1_000_000),
  endsAt: z.string().datetime().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
  newClientsOnly: z.boolean().optional(),
  note: z.string().trim().max(200).optional(),
});

export async function GET() {
  await requireRoot();
  const rows = await db.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  const uses = await promoPaidUses(rows.map((r) => r.code));
  return NextResponse.json({ codes: rows.map((r) => ({ ...r, paidUses: uses[r.code] ?? 0 })) });
}

export async function POST(request: Request) {
  await requireRoot();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 });
  }
  const code = normalizePromoCode(parsed.data.code);
  if (!isValidPromoCodeFormat(code)) {
    return NextResponse.json({ error: "Код: латиница, цифры, «-» и «_», от 3 до 32 символов" }, { status: 400 });
  }
  if (parsed.data.kind === "percent" && parsed.data.value > 100) {
    return NextResponse.json({ error: "Процент не может быть больше 100" }, { status: 400 });
  }
  const exists = await db.promoCode.findUnique({ where: { code } });
  if (exists) return NextResponse.json({ error: "Такой код уже есть" }, { status: 409 });
  const row = await db.promoCode.create({
    data: {
      code,
      kind: parsed.data.kind,
      value: parsed.data.value,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      maxUses: parsed.data.maxUses ?? null,
      newClientsOnly: parsed.data.newClientsOnly ?? false,
      note: parsed.data.note || null,
    },
  });
  return NextResponse.json({ code: { ...row, paidUses: 0 } });
}
