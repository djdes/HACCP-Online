"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleArrowUp, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PLAN_CATALOG,
  catalogPlanIdFor,
  type CatalogPlanId,
} from "@/lib/plan-catalog";

type Props = {
  /** Текущее значение `Organization.subscriptionPlan`. */
  currentPlan: string;
  currentPlanLabel: string;
  activeUsers: number;
  freeUserLimit: number;
  /** Тестовый режим биллинга — оплата не списывается. */
  billingTestMode: boolean;
};

/**
 * Витрина тарифов на `/settings/subscription`.
 *
 * Тарифов ровно два, поэтому вместо таблицы сравнения — две карточки с
 * кумулятивным списком («Всё из «Бесплатного»» + дельта) и одной умной
 * кнопкой на карточку: менеджер не должен гадать, что ему нажать.
 */
export function PlanUpgrade({
  currentPlan,
  currentPlanLabel,
  activeUsers,
  freeUserLimit,
  billingTestMode,
}: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const currentId: CatalogPlanId = catalogPlanIdFor(currentPlan);
  const seatsLeft = Math.max(0, freeUserLimit - activeUsers);

  async function upgrade() {
    setPending(true);
    try {
      const res = await fetch("/api/settings/subscription/upgrade", {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Не удалось сменить тариф");
      toast.success("Тариф изменён на «Платный»", {
        description: billingTestMode
          ? "Сайт в тестовом режиме — оплата не требуется."
          : undefined,
      });
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось сменить тариф"
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
            Ваш план: {currentPlanLabel}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#6f7282]">
            <Users className="size-3.5" />
            {currentId === "free"
              ? `${activeUsers}/${freeUserLimit} сотрудников · свободно мест: ${seatsLeft}`
              : `${activeUsers} сотрудников · без лимита`}
          </p>
        </div>
        {billingTestMode ? (
          <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-[12px] font-medium text-[#116b2a]">
            Тестовый режим — оплата не списывается
          </span>
        ) : null}
      </div>

      {/* Предупреждение ровно на границе: следующий человек меняет тариф. */}
      {currentId === "free" && seatsLeft === 0 ? (
        <p className="mt-4 rounded-2xl border border-[#ffe9b0] bg-[#fffaf0] px-4 py-3 text-[13px] leading-relaxed text-[#3c4053]">
          Бесплатные места закончились. Следующий сотрудник переведёт
          организацию на платный тариф
          {billingTestMode
            ? " — сейчас это бесплатно, сайт в тестовом режиме."
            : "."}
        </p>
      ) : null}

      <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-2">
        {PLAN_CATALOG.map((plan) => {
          const isCurrent = plan.id === currentId;
          // Рекомендуем платный только тому, кто ещё на бесплатном —
          // иначе «Рекомендуем» висело бы вечно и перестало значить что-либо.
          const recommended = !isCurrent && plan.id === "paid";
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl border p-5 transition-colors",
                isCurrent && "border-[#ececf4] bg-[#fafbff]",
                recommended &&
                  "border-[#5566f6] bg-[#f5f6ff] ring-2 ring-[#5566f6]/20",
                !isCurrent && !recommended && "border-[#ececf4] bg-white"
              )}
            >
              <div className="flex min-h-6 items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-[#0b1024]">
                  {plan.nameRu}
                </span>
                {isCurrent ? (
                  <span className="rounded-full bg-[#eef1ff] px-2.5 py-0.5 text-[11px] font-medium text-[#3848c7]">
                    Ваш план
                  </span>
                ) : null}
                {recommended ? (
                  <span className="rounded-full bg-[#5566f6] px-2.5 py-0.5 text-[11px] font-medium text-white">
                    Рекомендуем
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-[#0b1024]">
                {plan.price}
                <span className="text-[14px] font-normal text-[#6f7282]">
                  {plan.priceHint}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#6f7282]">
                {plan.tagline}
              </p>

              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
                Что входит
              </div>
              <ul className="mt-2 flex-1 space-y-1.5 text-[13px]">
                {plan.inheritsFrom ? (
                  <li className="flex gap-2 font-medium text-[#0b1024]">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#5566f6]" />
                    <span>Всё из «{plan.inheritsFrom}»</span>
                  </li>
                ) : null}
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[#3c4053]">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#5566f6]/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {plan.id === "free" ? (
                  <button
                    type="button"
                    disabled
                    className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white text-[14px] font-medium text-[#9b9fb3]"
                  >
                    {isCurrent ? "Ваш план" : "Бесплатный тариф"}
                  </button>
                ) : isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white text-[14px] font-medium text-[#9b9fb3]"
                  >
                    Уже улучшено
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={pending}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors duration-200 hover:bg-[#4a5bf0] disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CircleArrowUp className="size-4" />
                    )}
                    Улучшить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-[#6f7282]">
        {billingTestMode
          ? "Оплата появится позже. Сейчас все функции доступны бесплатно — сайт в тестовом режиме."
          : "Тариф можно изменить в любой момент."}
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={upgrade}
        variant="info"
        title="Перейти на платный тариф?"
        description={
          billingTestMode
            ? "Сайт в тестовом режиме — оплата не требуется, отключить можно в любой момент."
            : "Тариф изменится сразу, отключить можно в любой момент."
        }
        bullets={[
          { label: "Сотрудников — без лимита", tone: "info" },
          { label: "Датчики и автозаполнение журналов", tone: "info" },
          {
            label: billingTestMode
              ? "Деньги не списываются — тестовый режим"
              : "Стоимость считается по числу активных сотрудников",
            tone: "default",
          },
        ]}
        confirmLabel="Улучшить тариф"
      />
    </section>
  );
}
