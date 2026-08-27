import { NextResponse } from "next/server";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { planLabel } from "@/lib/plan-limits";
import { ensurePlanForHeadcount } from "@/lib/plan-limits.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/settings/subscription/upgrade
 *
 * Ручной переход на платный тариф со страницы «Улучшение тарифа».
 * Тела нет: тариф ровно один, выбирать нечего.
 *
 * Логика — та же `ensurePlanForHeadcount`, что срабатывает автоматически
 * при превышении 5 бесплатных мест, только с `force: true`. Второго
 * места, где организации меняют тариф, быть не должно.
 *
 * Оплата не запрашивается: сайт в тестовом режиме (BILLING_TEST_MODE).
 * Когда появится реальный биллинг — здесь встанет редирект на кассу.
 */
export async function POST() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json(
      { error: "Только руководитель может менять тариф" },
      { status: 403 }
    );
  }

  const orgId = getActiveOrgId(auth.session);
  const result = await ensurePlanForHeadcount(orgId, { force: true });

  return NextResponse.json({
    ok: true,
    plan: result.plan,
    planLabel: planLabel(result.plan),
    upgraded: result.upgraded,
    activeUsers: result.activeUsers,
  });
}
