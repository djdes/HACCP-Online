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
  JOURNAL_DOCUMENT_SHELL_CLASS,
  JOURNAL_DOCUMENT_SELECTION_BAR_CLASS,
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
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /-mx-4/);
  assert.match(JOURNAL_DOCUMENT_SELECTION_BAR_CLASS, /sm:-mx-6/);
  assert.match(JOURNAL_DOCUMENT_SHELL_CLASS, /px-4/);
  assert.match(JOURNAL_DOCUMENT_SHELL_CLASS, /sm:px-6/);
  assert.match(REGISTER_DOCUMENT_PAGE_CLASS, /px-4/);
  assert.match(REGISTER_DOCUMENT_PAGE_CLASS, /sm:px-6/);
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
