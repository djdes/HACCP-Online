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

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIsNarrowViewport } from "@/components/ui/spotlight-tour";
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
 *
 * На телефоне — bottom-sheet (как `fill-guide-dialog`): лист прижат к низу,
 * не выше 88vh, шапка и футер фиксированы, середина скроллится. На sm+ —
 * центрированная карточка 560px.
 */
export function PartnerHint({ rates, variant = "site", className }: Props) {
  const [open, setOpen] = useState(false);
  const mini = variant === "mini";
  // На телефоне окно не помещалось: карточка висела на `bottom-3`, росла
  // вверх и упиралась в адресную строку — шапка с заголовком уезжала за
  // край. Лист снизу решает это сам: высота в dvh, скроллится середина.
  const narrow = useIsNarrowViewport();

  const trigger = (
    <button
      type="button"
      aria-label="Партнёрская программа: ваш логотип вместо WeSetup"
      title="Партнёрская программа"
      onClick={narrow ? () => setOpen(true) : undefined}
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
  );

  const body = (
    <div className="space-y-4 sm:space-y-5">
            <section>
              <SectionLabel>Как это выглядит у клиента</SectionLabel>
              <WhiteLabelMock />
            </section>

            <section>
              <SectionLabel>Вознаграждение</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-3">
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
              <SectionLabel>Что можно настроить</SectionLabel>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                <Feature icon={Palette}>Логотип и акцентный цвет кабинета</Feature>
                <Feature icon={Check}>Приветствие при входе</Feature>
                <Feature icon={Phone}>Контакты поддержки в кабинете и боте</Feature>
                <Feature icon={FileSignature}>Подпись в PDF-журналах</Feature>
              </ul>
            </section>
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-2 px-1 py-1 sm:flex-row-reverse sm:items-center sm:justify-between sm:px-0 sm:py-0">
            <Link
              href="/settings/partner"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
            >
              Стать партнёром
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/partners"
              className="text-center text-[13px] font-medium text-[#3848c7] hover:underline"
              onClick={() => setOpen(false)}
            >
              Подробнее о программе
            </Link>
    </div>
  );

  if (narrow) {
    return (
      <>
        {trigger}
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Ваш бренд в WeSetup"
          subtitle="Клиенты под вашим логотипом, вознаграждение с их подписки"
          footer={footer}
        >
          {body}
        </BottomSheet>
      </>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[#0b1024]/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        {/* Глобальный cap для [role=dialog] на мобиле (globals.css) даёт
            width: calc(100vw - 1.5rem) — поэтому лист центрируем по
            горизонтали и отступаем от низа на 12px, а не тянем на всю
            ширину. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 z-[71] flex w-[calc(100vw-24px)] max-w-[560px] -translate-x-1/2 flex-col overflow-hidden border border-[#ececf4] bg-white text-[#0b1024] shadow-[0_24px_60px_-24px_rgba(11,16,36,0.45)] outline-none",
            "bottom-3 max-h-[88vh] supports-[height:100dvh]:max-h-[88dvh] rounded-3xl",
            "sm:bottom-auto sm:top-1/2 sm:max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] sm:-translate-y-1/2",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          )}
        >
          {/* Header — фиксированный */}
          <div className="flex shrink-0 items-start gap-3 border-b border-[#ececf4] px-4 pb-3.5 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6] sm:size-10">
              <Handshake className="size-4.5 sm:size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[16px] font-semibold leading-tight tracking-[-0.02em] sm:text-[18px]">
                Ваш бренд в WeSetup
              </DialogPrimitive.Title>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[#6f7282] sm:text-[13px]">
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

          {/* Body — скроллится. Содержимое общее с листом снизу. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {body}
          </div>

          {/* Footer — фиксированный. На телефоне кнопка во всю ширину,
              ссылка «Подробнее» под ней по центру. */}
          <div className="shrink-0 border-t border-[#ececf4] px-6 py-4">
            {footer}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7282] sm:text-[12px]">
      {children}
    </div>
  );
}

/**
 * CSS-макет вместо скриншота: шапка кабинета с плейсхолдером логотипа и
 * подвал PDF с подписью. Не устаревает при смене дизайна и весит ноль.
 * Все элементы шапки — `shrink-0` или `truncate`, чтобы на 318px
 * контента ничего не наезжало и не обрезалось молча.
 */
function WhiteLabelMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ececf4] bg-[#fafbff]">
      {/* Шапка кабинета */}
      <div className="flex min-w-0 items-center gap-2 border-b border-[#ececf4] bg-white px-3 py-2.5">
        <span className="flex h-6 shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-[#5566f6]/50 bg-[#eef1ff] px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3848c7]">
          <Palette className="size-3" />
          Ваш логотип
        </span>
        <span className="min-w-0 truncate text-[11px] font-semibold text-[#0b1024]">Кафе «Ромашка»</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="h-5 w-10 rounded-md bg-[#f1f2f8]" />
          <span className="hidden h-5 w-8 rounded-md bg-[#f1f2f8] sm:block" />
          <span className="size-5 rounded-full bg-[#5566f6]/80" />
        </span>
      </div>
      {/* Содержимое кабинета — схематично */}
      <div className="grid grid-cols-3 gap-2 px-3 py-3">
        <span className="h-8 rounded-lg bg-[#ecfdf5] sm:h-9" />
        <span className="h-8 rounded-lg bg-[#ecfdf5] sm:h-9" />
        <span className="h-8 rounded-lg bg-[#fff4f2] sm:h-9" />
      </div>
      {/* Подвал PDF */}
      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-dashed border-[#dcdfed] bg-white px-3 py-2 text-[10px] text-[#6f7282]">
        <span className="min-w-0 truncate">
          Подготовлено: <span className="font-semibold text-[#0b1024]">Ваша компания</span> · +7 900 000-00-00
        </span>
        <span className="shrink-0 rounded-full bg-[#f5f6ff] px-1.5 py-0.5 text-[9px] text-[#3848c7]">PDF</span>
      </div>
    </div>
  );
}

/**
 * Плитка ставки. На телефоне — компактная строка «иконка · значение ·
 * подпись», на sm+ — карточка с крупным значением (три в ряд).
 */
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
    <div className="flex items-center gap-3 rounded-2xl border border-[#ececf4] bg-white px-3 py-2.5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:block sm:p-3">
      <Icon className="size-4 shrink-0 text-[#5566f6]" />
      <div className="min-w-0 sm:mt-2">
        <span className="whitespace-nowrap text-[16px] font-semibold tabular-nums tracking-[-0.02em] text-[#0b1024] sm:block sm:text-[18px]">
          {value}
        </span>
        <span className="ml-2 text-[12px] leading-snug text-[#6f7282] sm:ml-0 sm:mt-0.5 sm:block sm:text-[11px]">
          {label}
        </span>
      </div>
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
    <li className="flex items-center gap-2 rounded-xl bg-[#f5f6ff] px-3 py-2 text-[12.5px] text-[#0b1024] sm:text-[13px]">
      <Icon className="size-3.5 shrink-0 text-[#5566f6]" />
      {children}
    </li>
  );
}
