import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/root/service-requests — смена статуса заявки на услугу.
 *
 * Больше ничего править нельзя: контакты и комментарий — то, что
 * написал клиент, и переписывать их админке незачем. Удаления тоже нет:
 * заявка это след платного обязательства, и стирать её задним числом
 * неправильно, для отказа есть статус «cancelled».
 */

const PatchSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(["new", "in_progress", "done", "cancelled"]),
});

export async function PATCH(request: Request) {
  await requireRoot();

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 }
    );
  }

  const existing = await db.serviceRequest.findUnique({
    where: { id: parsed.data.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }

  await db.serviceRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
}
