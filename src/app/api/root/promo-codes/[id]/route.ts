import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  active: z.boolean().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
  newClientsOnly: z.boolean().optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

/** PATCH — включить/выключить, поправить срок, лимит, заметку. Код и размер скидки не меняются: на них уже могли сослаться. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRoot();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 });
  }
  const data = parsed.data;
  const row = await db.promoCode.update({
    where: { id },
    data: {
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.endsAt !== undefined ? { endsAt: data.endsAt ? new Date(data.endsAt) : null } : {}),
      ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
      ...(data.newClientsOnly !== undefined ? { newClientsOnly: data.newClientsOnly } : {}),
      ...(data.note !== undefined ? { note: data.note || null } : {}),
    },
  });
  return NextResponse.json({ code: row });
}
