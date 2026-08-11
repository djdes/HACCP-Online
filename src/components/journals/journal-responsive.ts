/**
 * H1 списка журнала. Масштаб эталона lk.haccp-online.ru: 32px/700
 * (docs/reference/haccp-online/typography.json → listPage.h1). clamp
 * оставлен ради узких экранов, верхняя граница — ровно 2rem = 32px.
 */
export const JOURNAL_LIST_HEADING_CLASS =
  "w-full text-[clamp(1.75rem,2vw+1rem,2rem)] font-bold leading-tight tracking-[-0.02em] text-[#0b1024] sm:max-w-[70%]";

export const JOURNAL_LIST_ACTIONS_CLASS =
  "flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center";

export const JOURNAL_TAB_VIEWPORT_CLASS =
  "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Вкладки эталона — 14px/600 на всех брейкпоинтах. */
export const JOURNAL_TAB_RAIL_CLASS =
  "flex min-w-max gap-8 text-[14px] font-semibold sm:gap-12";

export const JOURNAL_LIST_CARD_CLASS =
  "grid grid-cols-1 gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3.5 sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_48px] sm:items-center sm:gap-0 sm:px-5 sm:py-3.5";

/**
 * Shared card typography (list of documents inside a journal). Normalized
 * across every *-documents-client.tsx so every journal card looks the same
 * as the climate_control card used as the reference.
 */
export const JOURNAL_CARD_TITLE_CLASS =
  "text-[15px] font-semibold tracking-[-0.02em] text-black";

export const JOURNAL_CARD_LABEL_CLASS = "text-[12.5px] text-[#84849a]";

export const JOURNAL_CARD_VALUE_CLASS =
  "mt-1.5 text-[13.5px] font-semibold text-black";

/**
 * Shared section divider used between title → label/value blocks in the
 * document list card. Horizontal line + top padding on mobile, vertical
 * line + left padding on desktop. On desktop the content is laid out as
 * a flex column centered vertically so label/value sits exactly between
 * the vertical dividers regardless of cell height differences.
 */
export const JOURNAL_CARD_SECTION_CLASS =
  "border-t border-[#e6e6f0] pt-3 sm:flex sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:px-10 sm:pt-0";

export const JOURNAL_DOCUMENT_SELECTION_BAR_CLASS =
  "sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-3 border-b border-[#dcdfed] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8";

/**
 * Оболочка документа. Раньше несла border + shadow — на сером фоне это
 * читалось как «лист бумаги». Теперь фон раздела журналов сам белый
 * (см. `journals/[code]/layout.tsx`), поэтому рамка вокруг белого на
 * белом была бы «рамкой ради рамки» — убрана, как на эталоне.
 * Горизонтальные отступы сохранены (mobile-first контракт, см. тест).
 */
export const JOURNAL_DOCUMENT_SHELL_CLASS =
  "rounded-[20px] bg-white px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-5";

export const JOURNAL_DOCUMENT_HEADER_CLASS =
  "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5";

export const JOURNAL_DOCUMENT_ACTIONS_CLASS =
  "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3";

export const JOURNAL_TABLE_VIEWPORT_CLASS =
  "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 rounded-[14px] bg-white";

export const JOURNAL_DIALOG_HEADER_CLASS =
  "border-b px-5 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-10";

export const JOURNAL_DIALOG_BODY_CLASS =
  "space-y-6 px-5 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-10";

export const JOURNAL_DIALOG_GRID_CLASS = "grid gap-4 sm:gap-6 md:grid-cols-2";

/** Ширина контента — 1296px, контейнер эталона (listPage.container.w). */
export const REGISTER_DOCUMENT_PAGE_CLASS =
  "mx-auto max-w-[1296px] px-4 py-2 sm:px-6 sm:py-3 lg:px-8";

export const REGISTER_DOCUMENT_HEADER_CLASS =
  "mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5";

export const REGISTER_DOCUMENT_ACTIONS_CLASS =
  "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3";

export const REGISTER_DOCUMENT_SUMMARY_CLASS =
  "mb-5 rounded-[16px] bg-[#f3f4fe] px-4 py-3 sm:px-5 sm:py-3.5";

export const REGISTER_DOCUMENT_SUMMARY_ROW_CLASS =
  "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4";

export const REGISTER_DOCUMENT_SUMMARY_STATS_CLASS =
  "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4";
