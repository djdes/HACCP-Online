"use client";

import type { MobileAxis } from "@/lib/use-mobile-view";

/**
 * Переключатель оси карточного режима: «Сегодня» / «По периоду».
 *
 * Стоит рядом с «Карточки / Таблица» и отвечает на другой вопрос: не
 * «как показать», а «что показать» — сегодняшний день по всем строкам
 * или одну строку за весь период.
 */
export function MobileAxisToggle({
  axis,
  onChange,
  entityLabel = "По периоду",
}: {
  axis: MobileAxis;
  onChange: (next: MobileAxis) => void;
  /** Подпись второй вкладки: «По сотрудникам», «По помещениям». */
  entityLabel?: string;
}) {
  const options: Array<{ value: MobileAxis; label: string }> = [
    { value: "today", label: "Сегодня" },
    { value: "entity", label: entityLabel },
  ];

  return (
    <div
      role="tablist"
      aria-label="Что показывать"
      className="inline-flex w-full rounded-2xl border border-[#ececf4] bg-[#fafbff] p-1"
    >
      {options.map((option) => {
        const active = axis === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`min-h-[40px] flex-1 rounded-xl px-3 text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 ${
              active
                ? "bg-white text-[#3848c7] shadow-[0_1px_2px_rgba(11,16,36,0.06)]"
                : "text-[#6f7282] hover:text-[#0b1024]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
