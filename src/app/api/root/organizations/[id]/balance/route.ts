import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";
import { creditBalance, InsufficientBalanceError } from "@/lib/balance/ledger";
import { formatPoints } from "@/lib/balance/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/root/organizations/<id>/balance — ручная корректировка баллов.
 *
 * Единственный способ изменить баланс не по правилам программы: компенсация,
 * исправление ошибки, промо. Каждая правка идёт строкой в леджер и в
 * `AuditLog` — «баланс поменялся сам» не должно случаться никогда.
 */
const bodySchema = z.object({
  amount: z
    .number()
    .int("Сумма — целое число баллов")
    .refine((value) => value !== 0, "Сумма не может быть нулевой")
    .refine((value) => Math.abs(value) <= 1_000_000, "Слишком большая сумма"),
  comment: z.string().trim().min(3, "Напишите, за что").max(300),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireRoot();
  const { id } = await ctx.params;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  }

  const organization = await db.organization.findUnique({
    where: { id },
    select: { id: true, name: true, balanceRub: true },
  });
  if (!organization) {
    return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  }

  try {
    await creditBalance({
      organizationId: organization.id,
      amount: parsed.amount,
      kind: "manual_adjust",
      description: parsed.comment,
      actorUserId: session.user.id,
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json(
        {
          error: `На балансе только ${formatPoints(organization.balanceRub)} — списать больше нельзя`,
        },
        { status: 409 },
      );
    }
    throw error;
  }

  await recordAuditLog({
    organizationId: organization.id,
    session,
    request,
    action: parsed.amount > 0 ? "balance.credit" : "balance.debit",
    entity: "Organization",
    entityId: organization.id,
    details: { amount: parsed.amount, comment: parsed.comment },
  });

  const updated = await db.organization.findUnique({
    where: { id: organization.id },
    select: { balanceRub: true },
  });
  return NextResponse.json({ ok: true, balanceRub: updated?.balanceRub ?? 0 });
}
