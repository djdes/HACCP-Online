"use client";

import { ChevronDown, Plus } from "lucide-react";
import { HYGIENE_STATUS_OPTIONS } from "@/lib/hygiene-document";
import type { WalkthroughPreviewKey } from "@/lib/journal-ui-walkthroughs";

/**
 * Мини-копии контролов для карточек шагов «Как заполнить?». Это не
 * скриншоты, а стилизованные div'ы: не устаревают при правке вёрстки,
 * не весят ничего и одинаково выглядят на сайте и в Mini App. Ключи —
 * из `journal-ui-walkthroughs.ts`; JSX живёт здесь (client), потому что
 * RSC не сериализует функции.
 */
const PRIMARY =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#5566f6] px-4 text-[13px] font-semibold text-white";
const CELL =
  "inline-flex h-8 min-w-[40px] items-center justify-center rounded-md border border-[#dcdfed] bg-white px-2 text-[12px] font-semibold text-[#0b1024]";
const CELL_ACTIVE = "border-[#5566f6] bg-[#f5f6ff] text-[#3848c7]";

function Arrow() {
  return <span className="text-[#9b9fb3]">→</span>;
}

const PREVIEWS: Record<WalkthroughPreviewKey, () => React.ReactNode> = {
  "button-create": () => (
    <span className={PRIMARY}>
      <Plus className="size-4" strokeWidth={2.5} />
      Создать документ
    </span>
  ),
  "button-add": () => (
    <span className={PRIMARY}>
      <Plus className="size-4" strokeWidth={2.5} />
      Добавить
      <ChevronDown className="size-3.5" />
    </span>
  ),
  "status-cycle": () => (
    <>
      {HYGIENE_STATUS_OPTIONS.map((option, i) => (
        <span key={option.value} className="inline-flex items-center gap-2">
          {i > 0 ? <Arrow /> : null}
          <span className={`${CELL} ${i === 0 ? CELL_ACTIVE : ""}`} title={option.label}>
            {option.code}
          </span>
        </span>
      ))}
    </>
  ),
  "temp-toggle": () => (
    <>
      <span className={`${CELL} ${CELL_ACTIVE}`}>нет</span>
      <span className={`${CELL} border-[#ffd2cd] bg-[#fff4f2] text-[#a13a32]`}>да</span>
    </>
  ),
  "button-add-room": () => (
    <span className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#5566f6] text-[13px] font-semibold text-white">
      <Plus className="size-4" strokeWidth={2.5} />
      Добавить помещение
    </span>
  ),
  "button-add-row": () => (
    <span className={PRIMARY}>
      <Plus className="size-4" strokeWidth={2.5} />
      Добавить строку
    </span>
  ),
  "measure-cells": () => (
    <div className="grid w-full max-w-[220px] grid-cols-2 gap-1 text-center text-[12px]">
      <div className="rounded-md border border-[#dcdfed] bg-[#f6f7fa] py-1 font-semibold text-[#3c4053]">
        T, °C
      </div>
      <div className="rounded-md border border-[#dcdfed] bg-[#f6f7fa] py-1 font-semibold text-[#3c4053]">
        ВВ, %
      </div>
      <div className="rounded-md border border-[#dcdfed] bg-white py-1.5 font-semibold text-[#0b1024]">
        21.5
      </div>
      <div className="rounded-md border border-[#ffd2cd] bg-white py-1.5 font-semibold text-[#d2453d]">
        82
      </div>
    </div>
  ),
};

export function WalkthroughPreview({ preview }: { preview: WalkthroughPreviewKey }) {
  const render = PREVIEWS[preview];
  return (
    <div
      aria-hidden
      className="pointer-events-none mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-3 py-2.5 select-none"
    >
      {render()}
    </div>
  );
}
