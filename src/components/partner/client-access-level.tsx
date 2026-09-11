"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { readError } from "@/components/partner/ui";
import { PARTNER_ACCESS_LEVEL_LABELS, type PartnerAccessLevel } from "@/lib/partners/access-guard";
import { cn } from "@/lib/utils";

/**
 * Уровень доступа консультанта к кабинету клиента.
 *
 * Раньше его выбирал только клиент, и консультант, которому нужно было
 * что-то заполнить, упирался в «попросите клиента зайти в настройки».
 * Теперь переключает и консультант — но не молча: клиент получает
 * уведомление в кабинете, Telegram и на почту, событие попадает в его
 * журнал действий, а вернуть «только просмотр» он может одним кликом.
 *
 * Поэтому повышение спрашивает подтверждение, а понижение — нет:
 * отдавать себе меньше прав безопасно.
 */

const LEVEL_OPTIONS: Array<{
  value: PartnerAccessLevel;
  icon: typeof Eye;
  hint: string;
}> = [
  { value: "view", icon: Eye, hint: "Видите журналы и отчёты, ничего не меняете" },
  { value: "edit", icon: PencilLine, hint: "Заполняете журналы и настраиваете за клиента" },
];

export function ClientAccessLevel({
  organizationId,
  organizationName,
  level,
}: {
  organizationId: string;
  organizationName: string;
  level: PartnerAccessLevel;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);

  async function apply(next: PartnerAccessLevel) {
    setBusy(true);
    try {
      const res = await fetch(`/api/partner/clients/${organizationId}/access-level`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessLevel: next }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Не удалось изменить уровень доступа"));
        return;
      }
      toast.success(
        next === "edit"
          ? "Теперь вы можете заполнять журналы за клиента"
          : "Оставлен только просмотр",
      );
      setConfirmUpgrade(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function choose(next: PartnerAccessLevel) {
    if (next === level) return;
    if (next === "edit") setConfirmUpgrade(true);
    else void apply(next);
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {LEVEL_OPTIONS.map((option) => {
          const active = option.value === level;
          return (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              onClick={() => choose(option.value)}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150 disabled:opacity-50",
                active
                  ? "border-[#5566f6] bg-[#f5f6ff]"
                  : "border-[#dcdfed] bg-white hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-xl",
                  active ? "bg-[#5566f6] text-white" : "bg-[#eef1ff] text-[#5566f6]",
                )}
              >
                <option.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-[#0b1024]">
                  {PARTNER_ACCESS_LEVEL_LABELS[option.value]}
                </span>
                <span className="block text-[12px] leading-[1.45] text-[#6f7282]">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmUpgrade}
        onClose={() => setConfirmUpgrade(false)}
        onConfirm={() => apply("edit")}
        variant="info"
        title="Включить редактирование?"
        description={`Вы сможете заполнять журналы и менять настройки в кабинете «${organizationName}».`}
        bullets={[
          { label: "Клиент получит уведомление в кабинете, Telegram и на почту" },
          { label: "Событие попадёт в его журнал действий" },
          { label: "Клиент может вернуть «только просмотр» одним кликом" },
          { label: "Деньги, подписка и удаление организации останутся недоступны" },
        ]}
        confirmLabel="Включить редактирование"
      />
    </>
  );
}
