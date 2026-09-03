import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { planLabel } from "@/lib/plan-limits";
import { reduceTrialToFreePlan } from "@/lib/trial-limits.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/settings/subscription/trial-decision
 *
 * Body: { decision: "reduce" }
 *
 * Ответ на модалку после 14 дней теста. «Продлить» сюда не ходит — это
 * обычный переход на подписку (`/settings/subscription` → upgrade).
 * «Сократить функционал» переводит организацию на бесплатный тариф
 * `free`: лимиты те же, что в тесте, отсчёт дней больше не идёт и
 * модалка не возвращается. Данные и журналы не трогаем.
 */
const Schema = z.object({
  decision: z.literal("reduce"),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json(
      { error: "Только руководитель может менять тариф" },
      { status: 403 }
    );
  }

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const orgId = getActiveOrgId(auth.session);
  const result = await reduceTrialToFreePlan(orgId, {
    id: auth.session.user.id,
    name: auth.session.user.name ?? null,
  });

  return NextResponse.json({
    ok: true,
    plan: result.plan,
    planLabel: planLabel(result.plan),
    changed: result.changed,
  });
}
