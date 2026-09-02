import { NextResponse } from "next/server";

import { listAccruals } from "@/lib/partners/accruals";
import { requirePartnerApi } from "@/lib/partners/api";
import { buildAccrualsCsv, csvContentDisposition } from "@/lib/partners/csv";
import { ACCRUAL_KIND_LABELS, ACCRUAL_STATUS_LABELS } from "@/lib/partners/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** CSV начислений для Excel (BOM, `;`, кириллица) — опц. ?month=YYYY-MM. */
export async function GET(request: Request) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const month = new URL(request.url).searchParams.get("month");
  const periodMonth = month && MONTH_RE.test(month) ? month : undefined;

  const rows = await listAccruals({ partnerId: auth.ctx.membership.partnerId, periodMonth });
  const csv = buildAccrualsCsv(rows, { kind: ACCRUAL_KIND_LABELS, status: ACCRUAL_STATUS_LABELS });
  const filename = `Вознаграждение ${auth.ctx.membership.partner.slug}${periodMonth ? ` ${periodMonth}` : ""}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvContentDisposition(filename),
      "Cache-Control": "no-store",
    },
  });
}
