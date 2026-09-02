"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Landmark, Link2, Palette } from "lucide-react";
import { toast } from "sonner";
import type { BrandingSettings } from "@/lib/partners/branding-admin";
import type { InviteTexts } from "@/lib/partners/invite-texts";
import { BrandingForm } from "@/components/partner/branding-form";
import { InviteLinkCard } from "@/components/partner/invite-link-card";
import { PayoutForm, type PayoutFormValue } from "@/components/partner/payout-form";
import { btnOutline, btnPrimary, readError } from "@/components/partner/ui";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "brand", title: "Логотип и контакты", icon: Palette, text: "Что увидят клиенты в блоке «Ваш консультант»" },
  { key: "invite", title: "Ссылка для клиентов", icon: Link2, text: "Скопируйте и отправьте первому клиенту" },
  { key: "payout", title: "Реквизиты для выплат", icon: Landmark, text: "Куда переводить вознаграждение" },
] as const;

/**
 * Три шага после одобрения заявки. Каждый шаг можно пропустить —
 * онбординг закрывается один раз (`POST /api/partner/onboarding`) и
 * больше не показывается; всё то же самое доступно в разделах кабинета.
 */
export function OnboardingWizard({
  branding,
  inviteTexts,
  payout,
  canEditPayout,
}: {
  branding: BrandingSettings;
  inviteTexts: InviteTexts;
  payout: PayoutFormValue;
  canEditPayout: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [finishing, setFinishing] = useState(false);

  async function finish() {
    setFinishing(true);
    try {
      const res = await fetch("/api/partner/onboarding", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Не удалось завершить настройку"));
      toast.success("Кабинет готов к работе");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось завершить настройку");
      setFinishing(false);
    }
  }

  function next(markDone?: string) {
    if (markDone) setDone((d) => ({ ...d, [markDone]: true }));
    if (step < STEPS.length - 1) setStep(step + 1);
    else void finish();
  }

  const current = STEPS[step];

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="border-b border-[#ececf4] px-5 py-5 md:px-7">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">Первая настройка</div>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Три шага — и можно подключать клиентов
        </h1>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          {STEPS.map((s, i) => {
            const active = i === step;
            const complete = done[s.key] || i < step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors duration-150",
                    active ? "border-[#5566f6] bg-[#f5f6ff]" : "border-[#ececf4] bg-white hover:bg-[#fafbff]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-xl",
                      complete ? "bg-[#ecfdf5] text-[#116b2a]" : active ? "bg-[#5566f6] text-white" : "bg-[#eef1ff] text-[#5566f6]",
                    )}
                  >
                    {complete ? <Check className="size-4" /> : <s.icon className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#0b1024]">
                      {i + 1}. {s.title}
                    </span>
                    <span className="block text-[12px] leading-[1.4] text-[#6f7282]">{s.text}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-5 py-5 md:px-7 md:py-6">
        {current.key === "brand" ? (
          <BrandingForm initial={branding} compact onSaved={() => next("brand")} />
        ) : null}
        {current.key === "invite" ? <InviteLinkCard texts={inviteTexts} compact /> : null}
        {current.key === "payout" ? (
          <PayoutForm initial={payout} canEdit={canEditPayout} onSaved={() => next("payout")} />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ececf4] px-5 py-4 md:px-7">
        <button
          type="button"
          className="text-[13px] font-medium text-[#6f7282] transition-colors hover:text-[#0b1024]"
          onClick={finish}
          disabled={finishing}
        >
          Пропустить настройку — всё это есть в разделах кабинета
        </button>
        <div className="flex gap-2">
          {step > 0 ? (
            <button type="button" className={btnOutline} onClick={() => setStep(step - 1)}>
              Назад
            </button>
          ) : null}
          <button type="button" className={btnPrimary} disabled={finishing} onClick={() => next()}>
            {step < STEPS.length - 1 ? (
              <>
                {current.key === "invite" ? "Дальше" : "Пропустить шаг"}
                <ArrowRight className="size-4" />
              </>
            ) : (
              <>
                <Check className="size-4" />
                {finishing ? "Завершаем…" : "Завершить настройку"}
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
