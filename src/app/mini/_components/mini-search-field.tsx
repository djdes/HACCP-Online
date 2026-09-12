"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";

import { haptic } from "./use-haptic";

/**
 * Поле поиска по списку.
 *
 * Списки в Mini App длинные и плоские: 35 журналов, 40 единиц
 * оборудования, весь штат. Пока поиска нет, единственный способ найти
 * строку — крутить, а руки на кухне заняты.
 *
 * Размер шрифта 16 px — не вкусовщина: на iOS поле меньше 16 px при
 * фокусе заставляет Safari приблизить страницу, и после закрытия
 * клавиатуры экран остаётся увеличенным.
 */
export function MiniSearchField({
  value,
  onChange,
  placeholder,
  /** «Найдено 3 из 40» под полем — иначе пустой результат выглядит поломкой. */
  resultLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  resultLabel?: string;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
          style={{ color: "var(--mini-text-faint)" }}
          aria-hidden
        />
        <input
          id={id}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 w-full rounded-2xl pl-10 pr-10 text-[16px] outline-none [&::-webkit-search-cancel-button]:hidden"
          style={{
            background: "var(--mini-surface-2)",
            border: "1px solid var(--mini-divider-strong)",
            color: "var(--mini-text)",
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onChange("");
            }}
            aria-label="Очистить поиск"
            className="mini-press absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl"
            style={{ color: "var(--mini-text-muted)" }}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {resultLabel ? (
        <p className="px-1 text-[12px]" style={{ color: "var(--mini-text-muted)" }}>
          {resultLabel}
        </p>
      ) : null}
    </div>
  );
}
