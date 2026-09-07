"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";

/**
 * Числовое поле журнала «под перчатки».
 *
 * Чем отличается от голого `<Input type="number">`, который стоял в
 * журналах до этого:
 *
 *  1. `inputMode="decimal"` — на iOS без него клавиатура приезжает без
 *     разделителя дробной части. По репозиторию `inputMode` был выставлен
 *     ровно в одном файле из семи с числовым вводом.
 *  2. Высота 48px вместо 40 и степперы `−/+` по краям: NN/g — для мелких
 *     приращений степпер быстрее клавиатуры, а в перчатках попасть в
 *     44-пиксельную кнопку реальнее, чем в узкое поле.
 *  3. Норма подписана ПОД полем и подсвечивается сразу при вводе, а не
 *     после сохранения. Раньше диапазон жил в подзаголовке карточки, и в
 *     момент набора его не было видно.
 *  4. Русская запятая принимается наравне с точкой — на сервере
 *     `buildCompletionValidator` это уже умеет, поле не должно спорить.
 *
 * Компонент неуправляемо-управляемый: значение хранит вызывающий,
 * `onChange` отдаёт сырую строку (пустая = очистили), `onCommit` —
 * момент, когда значение пора сохранять (blur или степпер).
 */
export type NumberFieldProps = {
  value: string;
  onChange: (next: string) => void;
  onCommit?: (next: string) => void;
  label?: string;
  /** Единица измерения — рисуется внутри поля справа («°C», «%»). */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Норма для подсказки и подсветки: «норма 2…6 °C». */
  norm?: { min?: number | null; max?: number | null } | null;
  /** Своя подпись под полем вместо автоматической нормы. */
  hint?: string;
  /** Дополнительный контрол справа — голосовой ввод, датчик, щуп. */
  trailing?: React.ReactNode;
  className?: string;
};

/** Строка → число с поддержкой запятой. NaN и пустое → null. */
export function parseNumeric(raw: string): number | null {
  const normalized = String(raw ?? "").trim().replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Значение вне нормы? null-норма и пустое значение — всегда «в норме». */
export function isOutOfNorm(
  raw: string,
  norm?: { min?: number | null; max?: number | null } | null
): boolean {
  if (!norm) return false;
  const value = parseNumeric(raw);
  if (value === null) return false;
  if (typeof norm.min === "number" && value < norm.min) return true;
  if (typeof norm.max === "number" && value > norm.max) return true;
  return false;
}

export function formatNorm(
  norm?: { min?: number | null; max?: number | null } | null,
  unit?: string
): string | null {
  if (!norm) return null;
  const hasMin = typeof norm.min === "number";
  const hasMax = typeof norm.max === "number";
  const suffix = unit ? ` ${unit}` : "";
  if (hasMin && hasMax) return `норма ${norm.min}…${norm.max}${suffix}`;
  if (hasMax) return `норма не выше ${norm.max}${suffix}`;
  if (hasMin) return `норма не ниже ${norm.min}${suffix}`;
  return null;
}

export function NumberField({
  value,
  onChange,
  onCommit,
  label,
  unit,
  min,
  max,
  step = 1,
  placeholder,
  disabled,
  id,
  norm,
  hint,
  trailing,
  className = "",
}: NumberFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const outOfNorm = isOutOfNorm(value, norm);
  const normHint = hint ?? formatNorm(norm, unit);

  function nudge(direction: 1 | -1) {
    if (disabled) return;
    const current = parseNumeric(value) ?? 0;
    // Плавающая арифметика: 4.1 + 0.1 = 4.199999. Округляем по числу
    // знаков в шаге, иначе в журнал уедет «4.199999999999999».
    const decimals = String(step).split(".")[1]?.length ?? 0;
    let next = current + direction * step;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    const text = next.toFixed(decimals);
    onChange(text);
    onCommit?.(text);
  }

  return (
    <div className={`min-w-0 ${className}`}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1 block text-[12px] font-medium text-[#6f7282]"
        >
          {label}
        </label>
      ) : null}

      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          aria-label="Уменьшить"
          onClick={() => nudge(-1)}
          disabled={disabled}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#dcdfed] bg-white text-[#3c4053] transition-colors duration-150 hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            id={inputId}
            // `text` + `inputMode`, а не `type="number"`: числовой инпут в
            // Safari молча отбрасывает значение с запятой и не даёт его
            // прочитать из `event.target.value`.
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            placeholder={placeholder ?? "—"}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onCommit?.(event.target.value)}
            className={`h-12 w-full rounded-2xl border bg-white px-3.5 text-[16px] tabular-nums text-[#0b1024] transition-colors duration-150 placeholder:text-[#9b9fb3] focus:outline-none focus:ring-4 disabled:bg-[#fafbff] disabled:text-[#6f7282] ${
              outOfNorm
                ? "border-[#e0857d] bg-[#fff4f2] text-[#a13a32] focus:border-[#d2453d] focus:ring-[#d2453d]/15"
                : "border-[#dcdfed] focus:border-[#5566f6] focus:ring-[#5566f6]/15"
            } ${unit ? "pr-10" : ""}`}
          />
          {unit ? (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-[#9b9fb3]">
              {unit}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Увеличить"
          onClick={() => nudge(1)}
          disabled={disabled}
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#dcdfed] bg-white text-[#3c4053] transition-colors duration-150 hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>

        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>

      {normHint ? (
        <div
          className={`mt-1 text-[12px] ${
            outOfNorm ? "font-medium text-[#a13a32]" : "text-[#9b9fb3]"
          }`}
        >
          {outOfNorm ? `Вне нормы · ${normHint}` : normHint}
        </div>
      ) : null}
    </div>
  );
}
