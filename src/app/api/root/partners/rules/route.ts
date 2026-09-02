import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { createRewardRuleVersion, listRewardRules } from "@/lib/partners/accruals";
import { readJson } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireRoot();
  return NextResponse.json({ rules: await listRewardRules() });
}

/**
 * POST — новая версия правил. Старые начисления хранят свою версию,
 * новая применяется только к новым.
 */
export async function POST(request: Request) {
  const session = await requireRoot();
  const body = await readJson<Record<string, unknown>>(request);
  const num = (key: string) => Number(body[key]);
  try {
    const rule = await createRewardRuleVersion(
      {
        subscriptionPercent: num("subscriptionPercent"),
        subscriptionMonths: num("subscriptionMonths"),
        hardwarePercent: num("hardwarePercent"),
        bonusAmountRub: num("bonusAmountRub"),
        bonusAfterPayments: num("bonusAfterPayments"),
        minPayoutRub: num("minPayoutRub"),
      },
      { userId: session.user.id, comment: typeof body.comment === "string" ? body.comment : "" },
    );
    return NextResponse.json({ ok: true, rule });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
