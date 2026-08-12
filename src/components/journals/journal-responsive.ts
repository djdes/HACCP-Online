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

/**
 * Полоса «выбрано N строк» — ЗАКРЕПЛЕНА ЖЁСТКО.
 *
 * Раньше стояло `sticky top-[72px]`, но sticky «прилипает» только к
 * ближайшему скроллящемуся предку: внутри `overflow-x-auto`-viewport'ов
 * журнальных таблиц полоса уезжала вместе с содержимым и терялась.
 * Теперь это `position: fixed` под шапкой кабинета (её высота — ровно
 * 72px, см. `src/components/layout/header.tsx`), поэтому действия над
 * выделением видны при ЛЮБОМ скролле.
 *
 * z-40 — выше липких заголовков таблиц (z-10/z-20) и на уровень выше
 * шапки (z-30), с которой полоса не пересекается по вертикали.
 * При пустом выделении компонент вообще не рендерится, в печать не идёт.
 */
export const JOURNAL_DOCUMENT_SELECTION_BAR_CLASS =
  "fixed inset-x-0 top-[72px] z-40 print:hidden";

/**
 * Внутренняя «пилюля» полосы: ровно по ширине контентной колонки страницы
 * (max-w-[1296px] + те же px-4 md:px-6, что у `(dashboard)/layout.tsx`),
 * чтобы полоса не разливалась во весь экран на широких мониторах.
 */
export const JOURNAL_DOCUMENT_SELECTION_BAR_INNER_CLASS =
  "mx-auto w-full max-w-[1296px] px-4 pt-2 md:px-6";

/** Сама «пилюля» действий — белая, с blur и тенью поверх таблицы. */
export const JOURNAL_DOCUMENT_SELECTION_BAR_PILL_CLASS =
  "flex flex-wrap items-center gap-3 rounded-[14px] border border-[#dcdfed] bg-white/95 px-4 py-3 shadow-[0_8px_24px_rgba(40,45,86,0.08)] backdrop-blur";

/**
 * Оболочка документа. Раньше несла border + shadow — на сером фоне это
 * читалось как «лист бумаги». Теперь фон раздела журналов сам белый
 * (см. `journals/[code]/layout.tsx`), поэтому рамка вокруг белого на
 * белом была бы «рамкой ради рамки» — убрана, как на эталоне.
 *
 * Горизонтальные отступы тоже убраны: на белом фоне это прозрачная
 * обёртка, а её `px-4 sm:px-6 lg:px-8` были ВТОРЫМ слоем padding'а поверх
 * контейнера страницы и сдвигали H1 документа правее хлебных крошек.
 * Горизонтальную геометрию задаёт ровно один контейнер — страница.
 * Остались только вертикальные отступы.
 */
export const JOURNAL_DOCUMENT_SHELL_CLASS =
  "rounded-[20px] bg-white py-3 sm:py-4 lg:py-5";

export const JOURNAL_DOCUMENT_HEADER_CLASS =
  "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5";

export const JOURNAL_DOCUMENT_ACTIONS_CLASS =
  "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3";

export const JOURNAL_TABLE_VIEWPORT_CLASS =
  "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 rounded-[14px] bg-white";

/* ------------------------------------------------------------------ *
 * Единая сетка модальных окон журналов
 * ------------------------------------------------------------------ *
 *
 * Эталон lk.haccp-online.ru (cleaning-02b-filled-dialog.png,
 * cleaning-05-add-room-dialog.png, staff-05-add-employee-form.png):
 * окно компактное (~480-560px), шапка с нижней линией, заголовок ~18-20px,
 * поля с подписью НАД инпутом, кнопка действия справа внизу.
 *
 * До этой правки в 13 журналах жили ширины 480/520/560/620/640/720/760/
 * 840/860/900/970/980, заголовки 18/20/22/24/42px и паддинги
 * px-6…px-18 — то есть каждый диалог был «свой». Держим ровно два
 * размера: обычный (560) и широкий, под редакторы таблиц/списков (640).
 */
export const JOURNAL_DIALOG_CONTENT_CLASS =
  "w-[calc(100vw-2rem)] max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-[24px] border-0 p-0 shadow-[0_24px_80px_rgba(40,45,86,0.16)] sm:max-w-[560px]";

export const JOURNAL_DIALOG_CONTENT_WIDE_CLASS =
  "w-[calc(100vw-2rem)] max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-[24px] border-0 p-0 shadow-[0_24px_80px_rgba(40,45,86,0.16)] sm:max-w-[640px]";

/** Шапка окна: подпись слева, крестик справа, нижняя линия. */
export const JOURNAL_DIALOG_HEADER_CLASS =
  "flex flex-row items-center justify-between gap-4 border-b border-[#ececf4] px-6 py-4";

/** Заголовок окна — 18px/600, один размер во всех журналах. */
export const JOURNAL_DIALOG_TITLE_CLASS =
  "text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]";

export const JOURNAL_DIALOG_BODY_CLASS = "space-y-5 px-6 py-5";

/** Подвал окна: действие справа внизу, как на эталоне. */
export const JOURNAL_DIALOG_FOOTER_CLASS =
  "flex flex-wrap items-center justify-end gap-2 border-t border-[#ececf4] px-6 py-4";

/** Подпись поля НАД инпутом — 13px/500. Legacy: новые поля используют
 * floating label внутри рамки (JOURNAL_DIALOG_FIELD_*). */
export const JOURNAL_DIALOG_LABEL_CLASS = "text-[13px] font-medium text-[#3c4053]";

/* ------------------------------------------------------------------ *
 * Поле диалога: floating label ВНУТРИ рамки
 * ------------------------------------------------------------------ *
 *
 * Эталон lk.haccp-online.ru (cleaning-02-create-dialog.png,
 * cleaning-02b-filled-dialog.png, climate_control-create-fail.png,
 * hygiene-create-fail.png): у каждого поля рамка одной ширины (full-width),
 * подпись мелким кеглем прижата к верхнему краю рамки и НЕ исчезает при
 * заполнении, значение — 15px под ней.
 *
 * До этой правки в диалогах жили три разных манеры: «Label над инпутом»,
 * «плейсхолдер вместо подписи» и «Label + тот же текст плейсхолдером»,
 * а селекты рендерились `w-fit`-пилюлями по ширине контента (50-190px)
 * рядом с full-width textarea — правый край формы был рваным.
 *
 * Компоненты, которые эти токены собирают: `journal-dialog-field.tsx`.
 */

/** Рамка поля. Всегда full-width — одна колонка на весь диалог. */
export const JOURNAL_DIALOG_FIELD_CLASS =
  "w-full rounded-[14px] border border-[#dfe1ec] bg-white px-3.5 pt-1.5 pb-2 transition-colors duration-150 focus-within:border-[#5566f6] focus-within:ring-4 focus-within:ring-[#5566f6]/15";

/** Та же рамка в состоянии ошибки — как на hygiene-create-fail.png. */
export const JOURNAL_DIALOG_FIELD_INVALID_CLASS =
  "border-[#e5484d] focus-within:border-[#e5484d] focus-within:ring-[#e5484d]/15";

/** Floating label внутри рамки — 11.5px, всегда виден. */
export const JOURNAL_DIALOG_FIELD_LABEL_CLASS =
  "block text-[11.5px] leading-[1.35] font-normal text-[#8a8fa3]";

/** Инпут внутри рамки: своей рамки/фона/тени нет — их даёт контейнер. */
export const JOURNAL_DIALOG_FIELD_CONTROL_CLASS =
  "h-7 w-full min-w-0 rounded-none border-0 bg-transparent p-0 text-[15px] leading-[1.5] text-[#0b1024] shadow-none outline-none placeholder:text-[#9b9fb3] focus-visible:border-0 focus-visible:ring-0 disabled:opacity-60 md:text-[15px]";

/** Textarea внутри рамки (периодичность контроля, примечания). */
export const JOURNAL_DIALOG_FIELD_TEXTAREA_CLASS =
  "min-h-[68px] w-full resize-none rounded-none border-0 bg-transparent p-0 text-[15px] leading-[1.45] text-[#0b1024] shadow-none outline-none placeholder:text-[#9b9fb3] focus-visible:border-0 focus-visible:ring-0 md:text-[15px]";

/**
 * SelectTrigger внутри рамки. `w-full` вместо дефолтного `w-fit` —
 * именно `w-fit` схлопывал «Должность ответственного за уборку» в пустую
 * пилюлю ~50px, когда предзаполненного значения не было в списке опций.
 */
export const JOURNAL_DIALOG_FIELD_TRIGGER_CLASS =
  "h-7 w-full justify-between rounded-none border-0 bg-transparent p-0 text-[15px] text-[#0b1024] shadow-none focus-visible:ring-0 data-[size=default]:h-7 data-[size=sm]:h-7 data-[placeholder]:text-[#9b9fb3] [&>span]:truncate";

/** Заметный (amber) хинт под полем — «сотрудников на должности нет». */
export const JOURNAL_DIALOG_HINT_CLASS =
  "mt-2 rounded-xl border border-[#f2d9a0] bg-[#fff8e8] px-3.5 py-2.5 text-[12.5px] leading-[1.4] text-[#8a6212]";

/** Текст ошибки под полем — как «Поле не заполнено» на эталоне. */
export const JOURNAL_DIALOG_ERROR_CLASS =
  "mt-1.5 text-[12.5px] leading-[1.35] text-[#e5484d]";

/** Единственная кнопка действия справа внизу («Создать» / «Сохранить»). */
export const JOURNAL_DIALOG_SUBMIT_CLASS =
  "h-10 rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-[#4a5bf0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15";

/** Ряд с кнопкой действия: всегда справа, всегда одна кнопка. */
export const JOURNAL_DIALOG_ACTIONS_CLASS = "flex justify-end pt-1";

/** Вертикальный ритм колонки полей внутри диалога. */
export const JOURNAL_DIALOG_FIELDS_CLASS = "space-y-4";

export const JOURNAL_DIALOG_GRID_CLASS = "grid gap-4 sm:gap-5 md:grid-cols-2";

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
