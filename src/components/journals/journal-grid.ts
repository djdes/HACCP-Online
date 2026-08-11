import { JOURNAL_TABLE_VIEWPORT_CLASS } from "@/components/journals/journal-responsive";

/**
 * Единые токены «бумажной» сетки журнала.
 *
 * Раньше эти четыре константы дублировались локально в каждом
 * `*-document-client.tsx` (13+ копий), поэтому компактность таблиц
 * приходилось править построчно. Теперь размер/цвет меняется в одном месте.
 *
 * Screen ↔ print duality: НА ЭКРАНЕ — мягкие границы `#ececf4`,
 * серо-голубая шапка, скруглённый viewport. ПРИ ПЕЧАТИ инспектор РПН/СЭС
 * ждёт «бумагу» — чёрные рамки без заливок, поэтому каждый токен несёт
 * пару screen + `print:`. Print-часть трогать нельзя.
 */

export const GRID_CELL_CLASS = "border border-[#ececf4] print:border-black";

export const GRID_HEAD_CELL_CLASS =
  "border border-[#ececf4] bg-[#f8f9fc] print:border-black print:bg-white";

export const GRID_HEAD_CELL_PLAIN_CLASS =
  "border border-[#ececf4] bg-white print:border-black";

/** Скруглённый viewport вокруг таблицы; в печати — прозрачный wrapper. */
export const GRID_VIEWPORT_CLASS = `${JOURNAL_TABLE_VIEWPORT_CLASS} print:mx-0 print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:px-0 print:shadow-none`;

/**
 * Вариант viewport'а для «широких» журналов (hygiene / health_check), где
 * на десктопе таблица помещается целиком и горизонтальный скролл не нужен.
 */
export const GRID_VIEWPORT_WIDE_CLASS = `${JOURNAL_TABLE_VIEWPORT_CLASS} lg:overflow-visible print:mx-0 print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:px-0 print:shadow-none`;

export const CELL_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 focus-visible:relative focus-visible:z-10";

/**
 * Компактная типографика таблицы — эталон (lk.haccp-online.ru) держит
 * сетку заметно мельче нашей прежней. Клиенты используют эти токены там,
 * где раньше стояли хардкод `text-[14px] p-3`.
 */
export const GRID_TEXT_CLASS = "text-[13px]";
export const GRID_CELL_PAD_CLASS = "px-2 py-1.5";
