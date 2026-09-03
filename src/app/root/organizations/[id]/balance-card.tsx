"use client";

import { useState } from "react";
import { Coins, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  formatPoints,
  transactionKindLabel,
} from "@/lib/balance/constants";

export type BalanceCardTransaction = {
  id: string;
  amount: number;
  kind: string;
  description: string;
  createdAt: string;
};

/**
 * Карточка баллов организации в ROOT: сколько на балансе, кто привёл, кого
 * привела эта организация, последние движения и ручная корректировка.
 *
 * Корректировка — через `ConfirmDialog` с последствиями: это прямое
 * изменение денежного обязательства платформы, и «случайно нажал» здесь
 * стоить дорого.
 */
export function BalanceCard({
  organizationId,
  organizationName,
  balanceRub,
  referredByName,
  referredCount,
  transactions,
}: {
  organizationId: string;
  organizationName: string;
  balanceRub: number;
  referredByName: string | null;
  referredCount: number;
  transactions: BalanceCardTransaction[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [sign, setSign] = useState<1 | -1>(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsedAmount = Number.parseInt(amount.replace(/\s/g, ""), 10);
  const valid =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    comment.trim().length >= 3;
  const delta = valid ? parsedAmount * sign : 0;

  async function submit() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/root/organizations/${organizationId}/balance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: delta, comment: comment.trim() }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        balanceRub?: number;
      };
      if (!response.ok) {
        toast.error(body.error ?? "Не удалось изменить баланс");
        return;
      }
      toast.success(
        `Баланс: ${formatPoints(body.balanceRub ?? 0)} (${delta > 0 ? "+" : "−"}${formatPoints(
          Math.abs(delta),
        )})`,
      );
      setAmount("");
      setComment("");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[18px] font-semibold">
          <Coins className="size-5 text-[#5566f6]" />
          Баланс баллов
        </span>
        <span className="text-[26px] font-semibold tabular-nums text-[#0b1024]">
          {formatPoints(balanceRub)}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-4 text-[14px] sm:grid-cols-3 sm:gap-6">
        <div>
          <dt className="text-[#8a8ea4]">Пригласила</dt>
          <dd className="mt-1 font-semibold text-black">
            {referredByName ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[#8a8ea4]">Привела</dt>
          <dd className="mt-1 font-semibold tabular-nums text-black">
            {referredCount}
          </dd>
        </div>
        <div>
          <dt className="text-[#8a8ea4]">Движений</dt>
          <dd className="mt-1 font-semibold tabular-nums text-black">
            {transactions.length}
          </dd>
        </div>
      </dl>

      {transactions.length > 0 ? (
        <div className="mt-5 max-h-[280px] overflow-y-auto rounded-2xl border border-[#eef0f6]">
          <table className="w-full text-[13.5px]">
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-[#f2f3f8] last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-[#8a8ea4]">
                    {new Date(transaction.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-3 py-2 text-[#6f7282]">
                    {transactionKindLabel(transaction.kind)}
                  </td>
                  <td className="px-3 py-2 text-[#0b1024]">
                    {transaction.description}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${
                      transaction.amount > 0 ? "text-[#116b2a]" : "text-[#a13a32]"
                    }`}
                  >
                    {transaction.amount > 0 ? "+" : "−"}
                    {formatPoints(Math.abs(transaction.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 text-[14px] text-[#9b9fb3]">
          Движений по баллам не было.
        </p>
      )}

      <div className="mt-5 border-t border-[#eef0f6] pt-5">
        <div className="text-[13px] font-medium text-[#0b1024]">
          Ручная корректировка
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-2xl border border-[#dcdfed]">
            <button
              type="button"
              onClick={() => setSign(1)}
              className={`inline-flex h-11 items-center gap-1.5 px-4 text-[14px] font-medium transition-colors ${
                sign === 1
                  ? "bg-[#5566f6] text-white"
                  : "bg-white text-[#0b1024] hover:bg-[#f5f6ff]"
              }`}
            >
              <Plus className="size-4" />
              Начислить
            </button>
            <button
              type="button"
              onClick={() => setSign(-1)}
              className={`inline-flex h-11 items-center gap-1.5 px-4 text-[14px] font-medium transition-colors ${
                sign === -1
                  ? "bg-[#a13a32] text-white"
                  : "bg-white text-[#0b1024] hover:bg-[#fff4f2]"
              }`}
            >
              <Minus className="size-4" />
              Списать
            </button>
          </div>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value.replace(/[^\d]/g, "").slice(0, 7))
            }
            placeholder="500"
            className="h-11 w-[120px] rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] tabular-nums text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 300))}
            placeholder="За что — увидит клиент в истории"
            className="h-11 min-w-[240px] flex-1 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0b1024] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#1b2140] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Применить
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        title={
          sign > 0
            ? `Начислить ${formatPoints(Math.abs(delta))}?`
            : `Списать ${formatPoints(Math.abs(delta))}?`
        }
        description={`Организация «${organizationName}». Баланс станет ${formatPoints(
          balanceRub + delta,
        )}.`}
        bullets={[
          { label: `Комментарий увидит клиент в истории: «${comment.trim()}»` },
          {
            label: "Запись попадёт в журнал действий и в леджер баллов",
            tone: "info",
          },
          ...(sign < 0
            ? [{ label: "Списание необратимо — вернуть можно только начислением", tone: "warn" as const }]
            : []),
        ]}
        confirmLabel={sign > 0 ? "Начислить" : "Списать"}
        variant={sign > 0 ? "default" : "danger"}
      />
    </div>
  );
}
