import assert from "node:assert/strict";
import test from "node:test";

import {
  DOC_ADD_ROW_CLASS,
  DOC_AUTOFILL_STRIP_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_EXTRA_BLOCK_CLASS,
  DOC_LEGEND_CLASS,
  DOC_PAPER_HEADER_CLASS,
  DOC_TITLE_ROW_CLASS,
  JOURNAL_DIALOG_BODY_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_CONTENT_WIDE_CLASS,
  JOURNAL_DIALOG_FIELD_CLASS,
  JOURNAL_DIALOG_FIELD_CONTROL_CLASS,
  JOURNAL_DIALOG_FIELD_LABEL_CLASS,
  JOURNAL_DIALOG_FIELD_TRIGGER_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_HINT_CLASS,
  JOURNAL_DIALOG_LABEL_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  JOURNAL_DOCUMENT_SHELL_CLASS,
  JOURNAL_DOCUMENT_SELECTION_BAR_CLASS,
  JOURNAL_DOCUMENT_SELECTION_BAR_INNER_CLASS,
  JOURNAL_DOCUMENT_SELECTION_BAR_PILL_CLASS,
  JOURNAL_LIST_ACTIONS_CLASS,
  JOURNAL_LIST_CARD_CLASS,
  JOURNAL_LIST_HEADING_CLASS,
  JOURNAL_TAB_RAIL_CLASS,
  JOURNAL_TAB_VIEWPORT_CLASS,
  REGISTER_DOCUMENT_PAGE_CLASS,
} from "@/components/journals/journal-responsive";

test("journal responsive tokens keep mobile-first stacking and tighter shells", () => {
  assert.match(JOURNAL_LIST_HEADING_CLASS, /w-full/);
  assert.match(JOURNAL_LIST_HEADING_CLASS, /sm:max-w-\[70%\]/);
  assert.match(JOURNAL_LIST_ACTIONS_CLASS, /flex-col/);
  assert.match(JOURNAL_LIST_ACTIONS_CLASS, /sm:flex-row/);
  assert.match(JOURNAL_TAB_VIEWPORT_CLASS, /overflow-x-auto/);
  assert.match(JOURNAL_TAB_RAIL_CLASS, /min-w-max/);
  assert.match(JOURNAL_LIST_CARD_CLASS, /grid-cols-1/);
  assert.match(JOURNAL_LIST_CARD_CLASS, /sm:grid-cols-/);
  // Полоса выделения закреплена fixed и живёт вне потока страницы,
  // поэтому компенсирующих отрицательных отступов у неё быть не должно.
  assert.doesNotMatch(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /-mx-/);
  assert.match(REGISTER_DOCUMENT_PAGE_CLASS, /px-4/);
  assert.match(REGISTER_DOCUMENT_PAGE_CLASS, /sm:px-6/);
});

test("page-level horizontal geometry is declared exactly once", () => {
  // Оболочка документа — прозрачная обёртка на белом фоне раздела.
  // Горизонтальные паддинги задаёт контейнер страницы (max-w-[1296px]
  // px-4 md:px-6 в (dashboard)/layout.tsx и journals/[code]/layout.tsx),
  // поэтому у оболочки их быть не должно — иначе H1 документа уезжает
  // правее хлебных крошек.
  assert.doesNotMatch(JOURNAL_DOCUMENT_SHELL_CLASS, /(^|\s|:)px-\d/);
  assert.doesNotMatch(JOURNAL_DOCUMENT_SHELL_CLASS, /(^|\s|:)-?mx-\d/);
  // Вертикальный ритм оболочки при этом сохраняется.
  assert.match(JOURNAL_DOCUMENT_SHELL_CLASS, /\bpy-3\b/);
  assert.match(JOURNAL_DOCUMENT_SHELL_CLASS, /sm:py-4/);
});

test("journal tokens follow the haccp-online reference typography", () => {
  // H1 эталона — 32px/700 (docs/reference/haccp-online/typography.json).
  assert.match(JOURNAL_LIST_HEADING_CLASS, /text-\[clamp\(1\.75rem,2vw\+1rem,2rem\)\]/);
  assert.match(JOURNAL_LIST_HEADING_CLASS, /font-bold/);
  // Вкладки эталона — 14px/600, один размер на всех брейкпоинтах.
  assert.match(JOURNAL_TAB_RAIL_CLASS, /text-\[14px\]/);
  assert.match(JOURNAL_TAB_RAIL_CLASS, /font-semibold/);
  assert.doesNotMatch(JOURNAL_TAB_RAIL_CLASS, /sm:text-/);
  // Контент центрируется по контейнеру эталона — 1296px.
  assert.match(REGISTER_DOCUMENT_PAGE_CLASS, /max-w-\[1296px\]/);
});

test("document rhythm tokens follow the canonical block order spacing", () => {
  // H1 → полоса автозаполнения: 20px.
  assert.match(DOC_TITLE_ROW_CLASS, /\bmb-5\b/);
  assert.match(DOC_TITLE_ROW_CLASS, /justify-between/);
  // Полоса → бумажная шапка: 40px, полоса не печатается.
  assert.match(DOC_AUTOFILL_STRIP_CLASS, /\bmb-10\b/);
  assert.match(DOC_AUTOFILL_STRIP_CLASS, /print:hidden/);
  // Бумажная шапка → КАПС-заголовок: 28px.
  assert.match(DOC_PAPER_HEADER_CLASS, /\bmb-7\b/);
  // КАПС-заголовок → «Добавить»: 20px.
  assert.match(DOC_CAPS_TITLE_CLASS, /\bmb-5\b/);
  // «Добавить» → таблица: 12px, кнопки слева, в печать не идут.
  assert.match(DOC_ADD_ROW_CLASS, /\bmb-3\b/);
  assert.match(DOC_ADD_ROW_CLASS, /items-center/);
  assert.match(DOC_ADD_ROW_CLASS, /print:hidden/);
  // Таблица → легенда: 24px. Легенда → доп. таблица: 32px.
  assert.match(DOC_LEGEND_CLASS, /\bmt-6\b/);
  assert.match(DOC_EXTRA_BLOCK_CLASS, /\bmt-8\b/);
});

test("dialog grid keeps exactly two widths and one typography scale", () => {
  // Эталон (cleaning-02b-filled-dialog.png, cleaning-05-add-room-dialog.png):
  // компактное окно, шапка с линией, заголовок ~18px, поля с подписью сверху.
  assert.match(JOURNAL_DIALOG_CONTENT_CLASS, /sm:max-w-\[560px\]/);
  assert.match(JOURNAL_DIALOG_CONTENT_WIDE_CLASS, /sm:max-w-\[640px\]/);
  // Оба размера — одна и та же оболочка, различие только в ширине.
  assert.equal(
    JOURNAL_DIALOG_CONTENT_CLASS.replace("sm:max-w-[560px]", ""),
    JOURNAL_DIALOG_CONTENT_WIDE_CLASS.replace("sm:max-w-[640px]", ""),
  );
  assert.match(JOURNAL_DIALOG_CONTENT_CLASS, /\bp-0\b/);
  // Окно не выше 90vh и делится на фикс-шапку + скроллящееся тело,
  // иначе на 900px-экранах кнопка «Создать» уезжает за край без скролла.
  assert.match(JOURNAL_DIALOG_CONTENT_CLASS, /max-h-\[90vh\]/);
  assert.match(JOURNAL_DIALOG_CONTENT_CLASS, /\bflex-col\b/);
  assert.match(JOURNAL_DIALOG_BODY_CLASS, /overflow-y-auto/);
  assert.match(JOURNAL_DIALOG_BODY_CLASS, /\bmin-h-0\b/);
  assert.match(JOURNAL_DIALOG_HEADER_CLASS, /\bshrink-0\b/);
  // Шапка: px-6 py-4 + нижняя линия, заголовок 18px/600, тело px-6 py-5.
  assert.match(JOURNAL_DIALOG_HEADER_CLASS, /\bpx-6\b/);
  assert.match(JOURNAL_DIALOG_HEADER_CLASS, /\bpy-4\b/);
  assert.match(JOURNAL_DIALOG_HEADER_CLASS, /border-b/);
  assert.match(JOURNAL_DIALOG_TITLE_CLASS, /text-\[18px\]/);
  assert.match(JOURNAL_DIALOG_TITLE_CLASS, /font-semibold/);
  assert.match(JOURNAL_DIALOG_BODY_CLASS, /\bpx-6\b/);
  assert.match(JOURNAL_DIALOG_BODY_CLASS, /\bpy-5\b/);
  assert.match(JOURNAL_DIALOG_LABEL_CLASS, /text-\[13px\]/);
});

test("selection bar sticks under the app header and never prints", () => {
  // `sticky` прилипал только к ближайшему скроллящемуся предку и терялся
  // внутри overflow-viewport'ов журнальных таблиц. Полоса закреплена
  // жёстко: fixed под шапкой кабинета (её высота ровно 72px — см.
  // src/components/layout/header.tsx), z-40 выше липких заголовков таблиц.
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /\bfixed\b/);
  assert.doesNotMatch(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /\bsticky\b/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /top-\[72px\]/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /inset-x-0/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /\bz-40\b/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /print:hidden/);
  // Горизонтально — ровно по контентной колонке страницы.
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_INNER_CLASS, /max-w-\[1296px\]/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_INNER_CLASS, /\bpx-4\b/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_INNER_CLASS, /md:px-6/);
  // Сама «пилюля» — белая с blur, чтобы читаться поверх таблицы.
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_PILL_CLASS, /backdrop-blur/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_PILL_CLASS, /bg-white\/95/);
});

test("dialog fields are one full-width column with floating labels", () => {
  // Эталон cleaning-02b / climate_control-create-fail: рамка поля во всю
  // ширину окна, подпись мелким кеглем ВНУТРИ рамки сверху.
  assert.match(JOURNAL_DIALOG_FIELD_CLASS, /\bw-full\b/);
  assert.match(JOURNAL_DIALOG_FIELD_CLASS, /rounded-\[14px\]/);
  assert.match(JOURNAL_DIALOG_FIELD_LABEL_CLASS, /text-\[11\.5px\]/);
  // Контролы внутри рамки своей рамки/фона не имеют — иначе рамка в рамке.
  assert.match(JOURNAL_DIALOG_FIELD_CONTROL_CLASS, /border-0/);
  assert.match(JOURNAL_DIALOG_FIELD_CONTROL_CLASS, /bg-transparent/);
  // Главный фикс селектов: `SelectTrigger` по умолчанию `w-fit` и
  // схлопывался в пустую пилюлю ~50px — здесь он всегда во всю ширину.
  assert.match(JOURNAL_DIALOG_FIELD_TRIGGER_CLASS, /\bw-full\b/);
  assert.doesNotMatch(JOURNAL_DIALOG_FIELD_TRIGGER_CLASS, /\bw-fit\b/);
  // Подсказка «нет сотрудников на должности» — заметная, не серый микротекст.
  assert.match(JOURNAL_DIALOG_HINT_CLASS, /bg-\[#fff8e8\]/);
});

