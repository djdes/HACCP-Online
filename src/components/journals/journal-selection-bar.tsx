"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  JOURNAL_DOCUMENT_SELECTION_BAR_CLASS,
  JOURNAL_DOCUMENT_SELECTION_BAR_INNER_CLASS,
  JOURNAL_DOCUMENT_SELECTION_BAR_PILL_CLASS,
} from "@/components/journals/journal-responsive";

type Props = {
  /** Сколько строк выделено. При 0 полоса не рендерится. */
  count: number;
  /** Снять выделение. */
  onClear: () => void;
  /** Удалить выделенные строки. Если не передан — кнопки удаления нет. */
  onDelete?: () => void;
  deleting?: boolean;
  /** Короткая подсказка «что произойдёт» справа от счётчика. */
  hint?: string;
  /** Дополнительные действия журнала (слева от «Удалить»). */
  children?: ReactNode;
};

/**
 * Единая полоса действий над выделенными строками документа.
 *
 * До этой правки каждый из 13 обязательных журналов рисовал её по-своему
 * (где-то две кнопки в ряд, где-то текст без счётчика, где-то sticky top-0
 * уезжал под шапку). Теперь состав и геометрия одни:
 *
 *   [×] Выбрано: N   ·  подсказка            [доп. действия] [Удалить]
 *
 * Геометрия — `JOURNAL_DOCUMENT_SELECTION_BAR_CLASS`: `position: fixed`
 * под шапкой кабинета (72px), z-40, по ширине контентной колонки
 * (1296px + px-4 md:px-6), белый фон с blur и тенью. Полоса видна при
 * любом скролле — в том числе внутри горизонтальных viewport'ов таблиц,
 * где `sticky` не работал. Никогда не печатается.
 */
export function JournalSelectionBar({
  count,
  onClear,
  onDelete,
  deleting = false,
  hint,
  children,
}: Props) {
  // Портал обязателен: страницы журналов лежат в full-bleed обёртке с
  // `-translate-x-1/2`, а transform у предка превращает `position: fixed`
  // в «прибит к контейнеру» — полоса уезжала при скролле. Рендерим в body.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  if (count <= 0 || !portalTarget) return null;

  return createPortal(
    <div className={JOURNAL_DOCUMENT_SELECTION_BAR_CLASS}>
      <div className={JOURNAL_DOCUMENT_SELECTION_BAR_INNER_CLASS}>
        <div
          className={JOURNAL_DOCUMENT_SELECTION_BAR_PILL_CLASS}
          role="region"
          aria-label="Действия над выбранными строками"
        >
          <button
            type="button"
            onClick={onClear}
            title="Снять выделение"
            aria-label="Снять выделение"
            className="rounded-full p-1.5 text-[#6f7282] transition-colors duration-150 hover:bg-[#f1f2f8] hover:text-black focus:ring-4 focus:ring-[#5566f6]/15 focus:outline-none"
          >
            <X className="size-4" />
          </button>
          <span className="text-[14px] font-semibold text-[#0b1024]">
            Выбрано: {count}
          </span>
          {hint ? (
            <span className="hidden text-[13px] text-[#6f7282] sm:inline">{hint}</span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {children}
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                disabled={deleting}
                title="Удалить выделенные строки без возможности отмены"
                className="h-10 gap-1.5 rounded-xl border-[#ffd7d3] bg-[#fff4f2] px-3.5 text-[14px] font-semibold text-[#ff3b30] shadow-none transition-colors duration-150 hover:bg-[#ffeae7] hover:text-[#ff3b30]"
              >
                <Trash2 className="size-4" />
                {deleting ? "Удаление…" : "Удалить"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
