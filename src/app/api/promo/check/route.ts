import { NextResponse, type NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import { getActiveOrgId, isImpersonating } from "@/lib/auth-helpers";
import { resolvePromo } from "@/lib/promo/service";
import { createRateLimiter } from "@/lib/rate-limit";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { getServerSession } from "@/lib/server-session";
import { readTariff } from "@/lib/tariffs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Перебор кодов — 20 попыток в 10 минут на IP.
const limiter = createRateLimiter({ tokensPerInterval: 20, intervalMs: 10 * 60 * 1000 });

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/**
 * POST { code, tariffKey } — проверить промокод до оформления. Ответ —
 * ровно то, что потом посчитает сервер при создании заказа.
 */
export async function POST(request: NextRequest) {
  if (!limiter.consume(clientIp(request))) {
    return NextResponse.json({ ok: false, message: "Слишком много попыток — подождите несколько минут" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; tariffKey?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  const tariffKey = typeof body.tariffKey === "string" ? body.tariffKey : "";
  const tariff = await readTariff(tariffKey);
  if (!tariff) return NextResponse.json({ ok: false, message: "Тариф недоступен" }, { status: 400 });

  const session = await getServerSession(authOptions).catch(() => null);
  const organizationId =
    session?.user && hasFullWorkspaceAccess(session.user) && !isImpersonating(session)
      ? getActiveOrgId(session)
      : null;
  const result = await resolvePromo(code, { organizationId, subscriptionRub: tariff.priceRub });
  if (!result.ok) return NextResponse.json({ ok: false, message: result.message });
  return NextResponse.json({
    ok: true,
    code: result.code,
    discountRub: result.discountRub,
    subscriptionRub: tariff.priceRub - result.discountRub,
    kind: result.rule.kind,
    value: result.rule.value,
  });
}
