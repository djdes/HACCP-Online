"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  Check,
  Cpu,
  FileSignature,
  Gift,
  Handshake,
  Palette,
  Phone,
  X,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import type { PartnerHintRates } from "@/lib/partners/partner-hint";

type Props = {
  rates: PartnerHintRates;
  /**
   * `site` — светлая шапка кабинета; `mini` — тёмная шапка Mini App,
   * иконка берёт цвет из CSS-переменных темы.
   */
  variant?: "site" | "mini";
  className?: string;
};

function formatRub(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(value))} ₽`;
}

/**
 * Еле заметная иконка рядом с логотипом: «здесь может быть ваш бренд».
 * Клик — модалка с сутью партнёрства, живым CSS-макетом white-label,
 * действующими ставками и кнопкой «Стать партнёром». Показывается только
 * тем, кому это уместно — см. `decidePartnerHint`.
 */
export function PartnerHint({ rates, variant = "site", className }: Props) {
  const [open, setOpen] = useState(false);
  const mini = variant === "mini";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Партнёрская программа: ваш логотип вместо WeSetup"
          title="Партнёрская программа"
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
            mini
              ? "text-[var(--mini-text)] opacity-35 hover:opacity-80"
              : "text-[#c5c8d9] hover:bg-[#f5f6ff] hover:text-[#5566f6]",
            className,
          )}
        >
          <Handshake className="size-4" />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[#0b1024]/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[71] flex max-h-[90vh] w-[calc(100vw-24px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-[#ececf4] bg-white text-[#0b1024] shadow-[0_24px_60px_-24px_rgba(11,16,36,0.45)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header — фиксированный */}
          <div className="flex shrink-0 items-start gap-3 border-b border-[#ececf4] px-6 pb-4 pt-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
              <Handshake className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">
                Ваш бренд в WeSetup
              </DialogPrimitive.Title>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#6f7282]">
                Ведите клиентов по СанПиН и ХАССП под своим логотипом и
                получайте вознаграждение с их подписки и оборудования.
              </p>
            </div>
            <DialogPrimitive.Close
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#9b9fb3] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024]"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body — скроллится */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                Как это выглядит у клиента
              </div>
              <WhiteLabelMock />
            </section>

            <section>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                Вознаграждение
              </div>
              <div className="grid grid-cols-3 gap-2">
                <RateTile
                  icon={BadgePercent}
                  value={`${rates.subscriptionPercent}%`}
                  label={`с подписки, ${rates.subscriptionMonths} мес.`}
                />
                <RateTile
                  icon={Cpu}
                  value={`${rates.hardwarePercent}%`}
                  label="с оборудования"
                />
                <RateTile
                  icon={Gift}
                  value={formatRub(rates.bonusAmountRub)}
                  label={`бонус после ${rates.bonusAfterPayments}-го платежа`}
                />
              </div>
            </section>

            <section>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                Что можно настроить
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                <Feature icon={Palette}>Логотип и акцентный цвет кабинета</Feature>
                <Feature icon={Check}>Приветствие при входе</Feature>
                <Feature icon={Phone}>Контакты поддержки в кабинете и боте</Feature>
                <Feature icon={FileSignature}>Подпись в PDF-журналах</Feature>
              </ul>
            </section>
          </div>

          {/* Footer — фиксированный */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-[#ececf4] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/partners"
              className="text-[13px] font-medium text-[#3848c7] hover:underline"
              onClick={() => setOpen(false)}
            >
              Подробнее о программе
            </Link>
            <Link
              href="/settings/partner"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
            >
              Стать партнёром
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * CSS-макет вместо скриншота: шапка кабинета с плейсхолдером логотипа и
 * подвал PDF с подписью. Не устаревает при смене дизайна и весит ноль.
 */
function WhiteLabelMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ececf4] bg-[#fafbff]">
      {/* Шапка кабинета */}
      <div className="flex items-center gap-2 border-b border-[#ececf4] bg-white px-3 py-2.5">
        <span className="flex h-6 items-center gap-1.5 rounded-lg border border-dashed border-[#5566f6]/50 bg-[#eef1ff] px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3848c7]">
          <Palette className="size-3" />
          Ваш логотип
        </span>
        <span className="text-[11px] font-semibold text-[#0b1024]">Кафе «Ромашка»</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-5 w-14 rounded-md bg-[#f1f2f8]" />
          <span className="h-5 w-10 rounded-md bg-[#f1f2f8]" />
          <span className="size-5 rounded-full bg-[#5566f6]/80" />
        </span>
      </div>
      {/* Содержимое кабинета — схематично */}
      <div className="grid grid-cols-3 gap-2 px-3 py-3">
        <span className="h-9 rounded-lg bg-[#ecfdf5]" />
        <span className="h-9 rounded-lg bg-[#ecfdf5]" />
        <span className="h-9 rounded-lg bg-[#fff4f2]" />
      </div>
      {/* Подвал PDF */}
      <div className="flex items-center justify-between border-t border-dashed border-[#dcdfed] bg-white px-3 py-2 text-[10px] text-[#6f7282]">
        <span>
          Подготовлено: <span className="font-semibold text-[#0b1024]">Ваша компания</span> · +7 900 000-00-00
        </span>
        <span className="rounded-full bg-[#f5f6ff] px-1.5 py-0.5 text-[9px] text-[#3848c7]">PDF</span>
      </div>
    </div>
  );
}

function RateTile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BadgePercent;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ececf4] bg-white p-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <Icon className="size-4 text-[#5566f6]" />
      <div className="mt-2 text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-[#0b1024]">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-[#6f7282]">{label}</div>
    </div>
  );
}

function Feature({
  icon: Icon,
  children,
}: {
  icon: typeof BadgePercent;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl bg-[#f5f6ff] px-3 py-2 text-[13px] text-[#0b1024]">
      <Icon className="size-3.5 shrink-0 text-[#5566f6]" />
      {children}
    </li>
  );
}
