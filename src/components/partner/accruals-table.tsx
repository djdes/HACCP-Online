import {
  ACCRUAL_KIND_LABELS,
  ACCRUAL_STATUS_LABELS,
  isReversalKind,
  type AccrualKind,
  type AccrualStatus,
} from "@/lib/partners/rewards";
import { EmptyState, Pill, formatDate, formatRubFixed, type PillTone } from "@/components/partner/ui";
import { cn } from "@/lib/utils";

/** Строка начисления, сериализованная для страницы (даты — ISO-строки). */
export type AccrualRow = {
  id: string;
  date: string;
  organizationId: string;
  clientName: string;
  kind: AccrualKind;
  paymentOrderId: number | null;
  baseAmountRub: number;
  ratePercent: number | null;
  amountRub: number;
  status: AccrualStatus;
  periodMonth: string;
  ruleVersion: number;
  paidAt: string | null;
  paidDocumentNo: string | null;
};

export function serializeAccrual(row: Omit<AccrualRow, "date" | "paidAt"> & { date: Date; paidAt: Date | null }): AccrualRow {
  return { ...row, date: row.date.toISOString(), paidAt: row.paidAt ? row.paidAt.toISOString() : null };
}

const STATUS_TONE: Record<AccrualStatus, PillTone> = { accrued: "neutral", payable: "indigo", paid: "ok" };

/**
 * Таблица начислений: одна и та же в карточке клиента и в разделе
 * «Вознаграждение». Сторно показываем красным со знаком минус, чтобы
 * возврат клиента был виден без чтения колонки «Вид».
 */
export function AccrualsTable({
  rows,
  showClient = true,
  emptyTitle = "Начислений пока нет",
  emptyHint = "Строки появятся после первой оплаты клиента, подключённого через вашу ссылку или код.",
}: {
  rows: AccrualRow[];
  showClient?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#ececf4]">
      <table className="w-full min-w-[720px] text-left text-[14px]">
        <thead className="bg-[#fafbff] text-[12px] uppercase tracking-[0.08em] text-[#6f7282]">
          <tr className="border-b border-[#ececf4]">
            <th className="px-4 py-2.5 font-medium">Дата</th>
            {showClient ? <th className="px-3 py-2.5 font-medium">Клиент</th> : null}
            <th className="px-3 py-2.5 font-medium">Вид</th>
            <th className="px-3 py-2.5 text-right font-medium">База</th>
            <th className="px-3 py-2.5 text-right font-medium">Ставка</th>
            <th className="px-3 py-2.5 text-right font-medium">Сумма</th>
            <th className="px-3 py-2.5 font-medium">Статус</th>
            <th className="px-4 py-2.5 font-medium">Период</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const reversal = isReversalKind(r.kind);
            return (
              <tr key={r.id} className="border-b border-[#f0f1f7] last:border-b-0">
                <td className="px-4 py-2.5 whitespace-nowrap text-[#3c4053]">{formatDate(r.date)}</td>
                {showClient ? <td className="px-3 py-2.5 text-[#0b1024]">{r.clientName}</td> : null}
                <td className="px-3 py-2.5">
                  <span className={cn(reversal ? "text-[#a13a32]" : "text-[#0b1024]")}>{ACCRUAL_KIND_LABELS[r.kind]}</span>
                  {r.paymentOrderId ? <span className="ml-1.5 text-[12px] text-[#9b9fb3]">№{r.paymentOrderId}</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#3c4053]">{formatRubFixed(r.baseAmountRub)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#3c4053]">
                  {r.ratePercent === null ? "—" : `${r.ratePercent}%`}
                </td>
                <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", reversal ? "text-[#a13a32]" : "text-[#0b1024]")}>
                  {formatRubFixed(r.amountRub)}
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone={STATUS_TONE[r.status]} title={r.paidAt ? `Выплачено ${formatDate(r.paidAt)}${r.paidDocumentNo ? `, док. ${r.paidDocumentNo}` : ""}` : undefined}>
                    {ACCRUAL_STATUS_LABELS[r.status]}
                  </Pill>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-[#6f7282]">
                  {r.periodMonth}
                  <span className="ml-1.5 text-[11px] text-[#9b9fb3]">v{r.ruleVersion}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
