import { NextResponse } from "next/server";

import { listAccruals, summarizeBalances, summarizeByMonth } from "@/lib/partners/accruals";
import { requirePartnerApi } from "@/lib/partners/api";
import { ACCRUAL_KIND_LABELS, ACCRUAL_STATUS_LABELS } from "@/lib/partners/rewards";
import { getCurrentRewardRule } from "@/lib/partners/schema-extras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Раздел «Вознаграждение»: начисления (опц. ?month=YYYY-MM), итоги по месяцам, балансы, правила. */
export async function GET(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const month = new URL(request.url).searchParams.get("month");
  const periodMonth = month && MONTH_RE.test(month) ? month : undefined;

  const partnerId = auth.ctx.membership.partnerId;
  const [all, rule] = await Promise.all([listAccruals({ partnerId }), getCurrentRewardRule()]);
  const rows = periodMonth ? all.filter((r) => r.periodMonth === periodMonth) : all;

  return NextResponse.json({
    month: periodMonth ?? null,
    accruals: rows.map((r) => ({
      ...r,
      date: r.date.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      kindLabel: ACCRUAL_KIND_LABELS[r.kind],
      statusLabel: ACCRUAL_STATUS_LABELS[r.status],
    })),
    months: summarizeByMonth(all),
    balances: summarizeBalances(all),
    rules: rule,
    labels: { kind: ACCRUAL_KIND_LABELS, status: ACCRUAL_STATUS_LABELS },
  });
}
