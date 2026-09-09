"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Ячейка счёта по безналу в ROOT-карточке: PDF, «Оплата поступила», «Отменить». */
export function InvoiceActions({
  orderId,
  amountRub,
  organizationName,
  pending,
}: {
  orderId: number;
  amountRub: number;
  organizationName: string;
  pending: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"paid" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(kind: "paid" | "cancel") {
    setBusy(true);
    try {
      const response = await fetch(`/api/root/orders/${orderId}/${kind === "paid" ? "mark-paid" : "cancel"}`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Не удалось");
      toast.success(kind === "paid" ? `Счёт № ${orderId} оплачен — подписка продлена, письмо ушло` : `Счёт № ${orderId} отменён`);
      setConfirm(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const small =
    "inline-flex h-8 items-center rounded-xl border border-[#dcdfed] bg-white px-2.5 text-[12.5px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-50";

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <a href={`/api/payments/invoice/${orderId}/pdf`} className={small}>
        Счёт (PDF)
      </a>
      {pending ? (
        <>
          <button type="button" onClick={() => setConfirm("paid")} disabled={busy} className={`${small} border-[#5566f6]/40 text-[#3848c7]`}>
            Оплата поступила
          </button>
          <button type="button" onClick={() => setConfirm("cancel")} disabled={busy} className={`${small} text-[#a13a32]`}>
            Отменить
          </button>
        </>
      ) : null}
      <ConfirmDialog
        open={confirm === "paid"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run("paid")}
        variant="info"
        title={`Деньги по счёту № ${orderId} пришли?`}
        description={`${organizationName}, ${amountRub.toLocaleString("ru-RU")} ₽. Сверьте с выпиской: отменить подтверждение нельзя.`}
        bullets={[
          { label: "Подписка организации продлится" },
          { label: "Клиенту уйдёт письмо «Оплата получена» с УПД" },
          { label: "Партнёрские и реферальные начисления — как после кассы" },
        ]}
        confirmLabel="Да, оплата поступила"
        confirmDisabled={busy}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run("cancel")}
        variant="warn"
        title={`Отменить счёт № ${orderId}?`}
        description="Счёт перестанет скачиваться, клиент сможет выставить новый."
        confirmLabel="Отменить счёт"
        confirmDisabled={busy}
      />
    </span>
  );
}
