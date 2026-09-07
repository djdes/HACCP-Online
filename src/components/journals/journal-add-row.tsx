"use client";

import { Plus } from "lucide-react";

/**
 * Последняя строка таблицы журнала — она же кнопка «добавить».
 *
 * Зачем: в бланке снизу оставляли несколько пустых строк-заготовок,
 * как на бумаге. На экране они ничего не значили: нажать на них было
 * нельзя, а человек видел «журнал с семью пустыми строками» и не
 * понимал, откуда берутся сотрудники. Теперь пустая строка ровно одна
 * и она кликабельная — открывает то же окно, что и «Добавить» сверху.
 *
 * На печать не идёт: на бумаге пустые строки задаются настройкой
 * «Добавлять пустых строк при печати».
 */
export function JournalAddRow({
  colSpan,
  label = "Добавить строку",
  onClick,
  disabled = false,
  /**
   * Ширина листа больше экрана — подпись прилипает к левому краю,
   * иначе на широкой сетке её не видно без прокрутки вбок.
   */
  sticky = true,
}: {
  colSpan: number;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  sticky?: boolean;
}) {
  return (
    <tr className="print:hidden" data-journal-add-row>
      <td colSpan={colSpan} className="border border-[#333] p-0 print:hidden">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`flex h-11 w-full items-center gap-2 px-3 text-left text-[13.5px] font-medium text-[#6f7282] transition-colors duration-150 hover:bg-[#f5f6ff] hover:text-[#3848c7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#5566f6]/15 disabled:pointer-events-none disabled:opacity-50 ${
            sticky ? "sticky left-0 w-fit min-w-full" : ""
          }`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#eef1ff] text-[#5566f6]">
            <Plus className="size-4" strokeWidth={2.5} />
          </span>
          {label}
        </button>
      </td>
    </tr>
  );
}
