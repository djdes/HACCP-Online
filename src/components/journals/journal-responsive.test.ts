import assert from "node:assert/strict";
import test from "node:test";

import {
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
