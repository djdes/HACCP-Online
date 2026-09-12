"use client";

import { type ReactNode } from "react";

import { haptic } from "@/app/mini/_components/use-haptic";

/**
 * Главное действие журнала, прижатое к низу экрана телефона.
 *
 * Не путать со `sticky-action-bar.tsx`: та липнет СВЕРХУ и держит ряд
 * «Добавить строку / Настроить» над таблицей. Эта — снизу, и в ней
 * ровно одно главное действие смены.
 *
 * Зачем снизу: список на двадцать сотрудников длиннее экрана втрое, и
 * кнопка над ним требует доскроллить обратно. Внизу её достаёт большой
 * палец, не перехватывая телефон.
 *
 * Появляется, только когда делать действительно есть что: иначе полоса
 * молча съедала бы место у последней строки списка.
 *
 * Нижний отступ считает `env(safe-area-inset-bottom)` — на айфонах с
 * домашней полосой кнопка иначе оказывается наполовину под ней.
 */
export function BottomActionBar({
  primary,
  secondary,
  hint,
}: {
  primary: {
    label: string;
    onRun: () => void;
    disabled?: boolean;
    icon?: ReactNode;
  } | null;
  secondary?: { label: string; onRun: () => void } | null;
  /** Короткая строка над кнопкой: «осталось 8 из 9». */
  hint?: ReactNode;
}) {
  if (!primary) return null;

  return (
    <div
      className="sticky inset-x-0 bottom-0 z-30 -mx-4 mt-3 border-t border-[#ececf4] bg-white/95 px-4 pt-3 backdrop-blur sm:hidden print:hidden"
      style={{ paddingBottom: "var(--safe-b)" }}
    >
      {hint ? (
        <div className="mb-2 text-center text-[12px] text-[#6f7282]">{hint}</div>
      ) : null}
      <div className="flex gap-2">
        {secondary ? (
          <button
            type="button"
            onClick={secondary.onRun}
            className="min-h-[52px] shrink-0 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            {secondary.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            haptic("medium");
            primary.onRun();
          }}
          disabled={primary.disabled}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[15px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
        >
          {primary.icon}
          {primary.label}
        </button>
      </div>
    </div>
  );
}
