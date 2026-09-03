import { NextResponse } from "next/server";

import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { loadBalanceOverview } from "@/lib/balance/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/balance — состояние раздела «Баланс и бонусы».
 *
 * Тот же сборщик, что и у страниц сайта и Mini App: клиент дёргает его
 * после отправки приглашения или отзыва, чтобы обновить экран без
 * перезагрузки. Кто что видит — решает `loadBalanceOverview`.
 */
export async function GET() {
  const session = await requireAuth();
  const overview = await loadBalanceOverview(
    getActiveOrgId(session),
    session.user,
  );
  return NextResponse.json(overview);
}
