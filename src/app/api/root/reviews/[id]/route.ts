import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoot } from "@/lib/auth-helpers";
import { setReviewOnLanding, getReview } from "@/lib/balance/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/root/reviews/<id> — показывать ли одобренный отзыв на лендинге.
 *
 * Отдельно от одобрения: отзыв может быть принят и оплачен, но не годиться
 * в карусель (слишком длинный, кадр не в фокусе). Начисление это не меняет.
 */
const bodySchema = z.object({ showOnLanding: z.boolean() });

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireRoot();
  const { id } = await ctx.params;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const review = await getReview(id);
  if (!review) {
    return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  }

  await setReviewOnLanding(id, parsed.showOnLanding);
  return NextResponse.json({ ok: true, showOnLanding: parsed.showOnLanding });
}
