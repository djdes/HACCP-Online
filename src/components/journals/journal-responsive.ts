/**
 * H1 списка журнала. Масштаб эталона lk.haccp-online.ru: 32px/700
 * (docs/reference/haccp-online/typography.json → listPage.h1). clamp
 * оставлен ради узких экранов, верхняя граница — ровно 2rem = 32px.
 */
export const JOURNAL_LIST_HEADING_CLASS =
  "w-full text-[clamp(1.75rem,2vw+1rem,2rem)] font-bold leading-tight tracking-[-0.02em] text-[#0b1024] sm:max-w-[70%]";

/**
 * Ритм страницы СПИСКА документов журнала (эталон: hygiene-grid.png).
 *
 * Порядок: крошки → строка «H1 слева + Инструкция/Создать документ справа»
 * → вкладки «Активные/Закрытые» → карточки документов. Один шаг 32px
 * между всеми тремя блоками — на всех 13 журналах одинаково.
 */
export const JOURNAL_LIST_STACK_CLASS = "space-y-8";

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

/* ------------------------------------------------------------------ *
 * Канонический вертикальный ритм страницы документа
 * ------------------------------------------------------------------ *
 *
 * Замерен по эталону lk.haccp-online.ru
 * (docs/reference/haccp-online/screenshots/cleaning-04-grid.png,
 *  cleaning-07-grid-with-room.png, fryer_oil-grid.png).
 *
 * Порядок блоков на странице документа — один для всех 13 обязательных
 * журналов:
 *
 *   1. хлебные крошки            (рендерятся страницей, не клиентом)
 *   2. H1 слева + «Настройки журнала» / «⋯» справа  → DOC_TITLE_ROW_CLASS
 *   3. полоса «Автоматически заполнять журнал»      → DOC_AUTOFILL_STRIP_CLASS
 *   4. бумажная ХАССП-шапка                          → DOC_PAPER_HEADER_CLASS
 *   5. центрированный КАПС-заголовок                 → DOC_CAPS_TITLE_CLASS
 *   6. «Добавить» + доп. тулбары слева над таблицей  → DOC_ADD_ROW_CLASS
 *   7. основная таблица
 *   8. «Условные обозначения»                        → DOC_LEGEND_CLASS
 *   9. дополнительные таблицы / приложения           → DOC_EXTRA_BLOCK_CLASS
 *
 * Ритм эталона: крошки→H1 12, H1→полоса 20, полоса→шапка 40,
 * шапка→капс 28, капс→«Добавить» 20, «Добавить»→таблица 12,
 * таблица→легенда 24, легенда→вторая таблица 32.
 *
 * ВАЖНО: держим ритм в этих трёх-четырёх константах, а не голыми
 * числами в 13 файлах — иначе разнобой возвращается на следующей правке.
 */

/**
 * Корневая обёртка тела документа. Ритм задают сами блоки (mb-*),
 * поэтому общего `space-y-*` тут намеренно нет: blanket-отступ
 * перебивал бы канон.
 */
export const DOC_BODY_STACK_CLASS = "print:space-y-0";

/** H1 страницы документа — та же типографика, что у H1 списка (32px/700). */
export const DOC_HEADING_CLASS =
  "text-[clamp(1.75rem,2vw+1rem,2rem)] leading-tight font-bold tracking-[-0.02em] text-[#0b1024]";

/** Строка заголовка: H1 слева, действия справа. 20px до следующего блока. */
export const DOC_TITLE_ROW_CLASS =
  "mb-5 flex flex-wrap items-start justify-between gap-4 print:hidden";

/** Полоса автозаполнения во всю ширину контейнера. 40px до бумажной шапки. */
export const DOC_AUTOFILL_STRIP_CLASS =
  "mb-10 rounded-[22px] bg-[#f3f4fe] px-4 py-3.5 print:hidden sm:px-6 sm:py-4";

/** Бумажная ХАССП-шапка. 28px до КАПС-заголовка. */
export const DOC_PAPER_HEADER_CLASS = "mb-7";

/** Центрированный КАПС-заголовок документа. 20px до «Добавить». */
export const DOC_CAPS_TITLE_CLASS = "mb-5";

/** Строка «Добавить» и доп. тулбаров слева над таблицей. 12px до таблицы. */
export const DOC_ADD_ROW_CLASS =
  "mb-3 flex flex-wrap items-center gap-3 print:hidden";

/** «Условные обозначения» под таблицей. 24px сверху. */
export const DOC_LEGEND_CLASS = "mt-6";

/** Дополнительные таблицы и приложения под легендой. 32px сверху. */
export const DOC_EXTRA_BLOCK_CLASS = "mt-8";
