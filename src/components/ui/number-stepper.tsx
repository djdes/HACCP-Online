"use client";

import { Minus, Plus } from "lucide-react";

/**
 * Счётчик с кнопками −/+.
 *
 * Для маленьких целых величин (точки, порции, часы) он лучше поля
 * ввода: нельзя напечатать «две» или «-3», а нужное значение
 * выставляется одним касанием — на телефоне это заметно быстрее, чем
 * вызывать клавиатуру.
 *
 * Поле оставлено доступным с клавиатуры: ↑/↓ меняют значение, ручной
 * ввод разрешён и приводится к границам при потере фокуса.
 */
export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
}) {
  function clamp(n: number) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  return (
    <div className="inline-flex h-11 items-center gap-1 rounded-2xl border border-[#dcdfed] bg-white p-1">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Меньше"
        className="flex size-9 items-center justify-center rounded-xl text-[#3c4053] transition-colors hover:bg-[#f5f6ff] hover:text-[#3848c7] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <input
        value={value}
        aria-label={ariaLabel}
        inputMode="numeric"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits === "" ? min : clamp(Number(digits)));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(value + 1));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(value - 1));
          }
        }}
        className="w-10 bg-transparent text-center text-[15px] font-semibold tabular-nums text-[#0b1024] focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Больше"
        className="flex size-9 items-center justify-center rounded-xl text-[#3c4053] transition-colors hover:bg-[#f5f6ff] hover:text-[#3848c7] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
