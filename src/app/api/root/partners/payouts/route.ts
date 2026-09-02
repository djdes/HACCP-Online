import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { buildPayoutSheetForAdmin } from "@/lib/partners/accruals";
import { buildCsv, csvContentDisposition } from "@/lib/partners/csv";
import { PAYOUT_TYPE_LABELS, type PayoutType } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHEET_HEADER = [
  "Партнёр",
  "Slug",
  "Форма",
  "Реквизиты",
  "Договор",
  "К выплате, ₽",
  "Строк",
  "Статус",
] as const;

function payoutDetailsText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const d = raw as Record<string, unknown>;
  return [d.fullName, d.inn && `ИНН ${d.inn}`, d.bank, d.bik && `БИК ${d.bik}`, d.account && `р/с ${d.account}`]
    .filter(Boolean)
    .join(", ");
}

/** Ведомость к выплате. `?format=csv` — та же ведомость файлом для бухгалтерии. */
export async function GET(request: Request) {
  await requireRoot();
  const sheet = await buildPayoutSheetForAdmin();
  const url = new URL(request.url);
  if (url.searchParams.get("format") !== "csv") {
    return NextResponse.json({
      ...sheet,
      lines: sheet.lines.map((line) => ({
        ...line,
        payoutTypeLabel: line.payoutType ? (PAYOUT_TYPE_LABELS[line.payoutType as PayoutType] ?? line.payoutType) : null,
      })),
    });
  }
  const rows = sheet.lines.map((line) => [
    line.companyName,
    line.slug,
    line.payoutType ? (PAYOUT_TYPE_LABELS[line.payoutType as PayoutType] ?? line.payoutType) : "",
    payoutDetailsText(line.payoutDetails),
    line.agreementSignedAt ? `подписан${line.agreementNumber ? ` № ${line.agreementNumber}` : ""}` : "не подписан",
    line.payableRub,
    String(line.accrualCount),
    line.carryOver ? `перенос (меньше ${sheet.minPayoutRub} ₽)` : "к выплате",
  ]);
  const csv = buildCsv([...SHEET_HEADER], rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvContentDisposition(`Ведомость партнёров ${stamp}.csv`),
      "Cache-Control": "no-store",
    },
  });
}
