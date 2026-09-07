"use client";

import { CheckCircle2, ChevronRight } from "lucide-react";

/**
 * Карточки «Сегодня → кто/что».
 *
 * Зачем: карточный режим матричных журналов был построен по оси
 * сущности — раскрываешь сотрудника (холодильник, помещение), а внутри
 * все 15–31 день периода. Но ежедневная работа обратная: «отметить
 * сегодня по всем». Чтобы закрыть смену на двадцати сотрудниках, надо
 * было раскрыть каждого и найти сегодняшнюю строку среди пятнадцати.
 *
 * Здесь один экран = один день: плоский список сущностей, у каждой одно
 * значение и одно касание. Ось «по сотрудникам» никуда не делась — она
 * нужна, когда догоняешь пропущенные дни, и переключается в шапке.
 */
export type DayFirstItem = {
  id: string;
  /** Кто или что: сотрудник, холодильник, помещение. */
  title: string;
  subtitle?: string;
  /** Текущее значение за сегодня. Пусто — ещё не заполнено. */
  value?: React.ReactNode;
  /** Что произойдёт по нажатию — обычно открывается выбор значения. */
  onPress?: (event: React.MouseEvent) => void;
  /** Заблокировано (закрытый день, нет прав) — с причиной. */
  disabledReason?: string | null;
  /** Своя правая часть вместо значения: поле ввода, чипы. */
  trailing?: React.ReactNode;
};

export function DayFirstCards({
  items,
  emptyLabel = "На сегодня заполнять нечего.",
  bulkAction,
}: {
  items: DayFirstItem[];
  emptyLabel?: string;
  /** Действие «отметить всех» — показывается, пока есть незаполненные. */
  bulkAction?: { label: string; onRun: () => void; disabled?: boolean };
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5 text-center text-[13px] text-[#6f7282]">
        {emptyLabel}
      </div>
    );
  }

  const pending = items.filter((item) => !item.value && !item.disabledReason);

  return (
    <div className="space-y-2">
      {bulkAction && pending.length > 1 ? (
        <button
          type="button"
          onClick={bulkAction.onRun}
          disabled={bulkAction.disabled}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[#5566f6]/25 bg-[#f5f6ff] px-4 text-[14px] font-semibold text-[#3848c7] transition-colors duration-150 hover:border-[#5566f6]/45 hover:bg-[#eef1ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 disabled:opacity-60"
        >
          <CheckCircle2 className="size-4" />
          {bulkAction.label} · {pending.length}
        </button>
      ) : null}

      {items.map((item) => {
        const locked = Boolean(item.disabledReason);
        const filled = Boolean(item.value);

        return (
          <div
            key={item.id}
            className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
              filled
                ? "border-[#ececf4] bg-white"
                : locked
                  ? "border-[#ececf4] bg-[#fafbff]"
                  : "border-[#dfe3f5] bg-[#fbfcff]"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium text-[#0b1024]">
                {item.title}
              </div>
              {item.subtitle ? (
                <div className="truncate text-[12px] text-[#6f7282]">
                  {item.subtitle}
                </div>
              ) : null}
              {locked ? (
                <div className="mt-0.5 truncate text-[11px] text-[#9b9fb3]">
                  {item.disabledReason}
                </div>
              ) : null}
            </div>

            {item.trailing ? (
              <div className="shrink-0">{item.trailing}</div>
            ) : (
              <button
                type="button"
                onClick={item.onPress}
                disabled={locked || !item.onPress}
                className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 disabled:cursor-not-allowed disabled:opacity-60 ${
                  filled
                    ? "border-[#ececf4] bg-[#f5f6ff] text-[#3848c7] hover:bg-[#eef1ff]"
                    : "border-[#dcdfed] bg-white text-[#6f7282] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                }`}
              >
                {filled ? item.value : "Заполнить"}
                {!locked ? <ChevronRight className="size-3.5" /> : null}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
