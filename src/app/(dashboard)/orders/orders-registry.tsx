"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileCheck2, Pencil, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Реестр изданных приказов.
 *
 * Пустое состояние не прячем: строчка «пока ничего не издано» объясняет,
 * что этот блок вообще существует и чем он наполнится. Иначе экран
 * выглядел бы как просто список шаблонов, и человек не понял бы, что
 * заполненные приказы где-то хранятся.
 */
export type RegistryRow = {
  id: string;
  templateCode: string;
  title: string;
  number: string;
  /** ISO-строка: серверный компонент не отдаёт Date в клиентский. */
  issuedAt: string;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function OrdersRegistry({
  orders,
  canManage,
}: {
  orders: RegistryRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<RegistryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/orders?id=${encodeURIComponent(pendingDelete.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Не удалось удалить");
      }
      toast.success("Приказ удалён из реестра");
      setPendingDelete(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <FileCheck2 className="size-5 text-[#5566f6]" />
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Изданные приказы
        </h2>
        {orders.length > 0 ? (
          <span className="rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[12px] tabular-nums text-[#3848c7]">
            {orders.length}
          </span>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-10 text-center">
          <div className="text-[15px] font-medium text-[#0b1024]">
            Пока ни одного приказа
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-[1.55] text-[#6f7282]">
            Выберите шаблон ниже, заполните Ф. И. О. и номер — реквизиты
            организации подставятся сами. Изданные приказы останутся здесь, и
            их можно будет распечатать к проверке.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-3 rounded-2xl border border-[#ececf4] bg-white p-4 sm:flex-row sm:items-center"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#ecfdf5]">
                <CheckCircle2 className="size-4 text-[#116b2a]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-[#0b1024]">
                  Приказ № {order.number} — {order.title}
                </div>
                <div className="mt-0.5 text-[12.5px] text-[#6f7282]">
                  от {formatDate(order.issuedAt)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/orders/${order.templateCode}?id=${order.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#0b1024] transition-colors duration-150 hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                >
                  <Pencil className="size-3.5 text-[#5566f6]" />
                  Открыть
                </Link>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(order)}
                    aria-label="Удалить приказ"
                    className="inline-flex size-9 items-center justify-center rounded-2xl border border-[#dcdfed] bg-white text-[#a13a32] transition-colors duration-150 hover:border-[#a13a32]/40 hover:bg-[#fff4f2]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        variant="danger"
        title="Удалить приказ из реестра?"
        description={
          pendingDelete
            ? `Приказ № ${pendingDelete.number} — ${pendingDelete.title}`
            : undefined
        }
        bullets={[
          { label: "Запись исчезнет из реестра безвозвратно", tone: "warn" },
          { label: "Распечатанные бумажные экземпляры останутся у вас" },
          { label: "Шаблон никуда не денется — приказ можно издать заново" },
        ]}
        confirmLabel={deleting ? "Удаляем…" : "Удалить"}
        confirmDisabled={deleting}
      />
    </section>
  );
}
