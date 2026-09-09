import assert from "node:assert/strict";
import test from "node:test";

import {
  documentViewClasses,
  resolveInitialView,
} from "@/lib/use-mobile-view";

test("saved choice wins over the viewport default", () => {
  assert.equal(resolveInitialView("cards", true, "cards"), "cards");
  assert.equal(resolveInitialView("table", false, "cards"), "table");
});

test("without a saved choice: wide viewport → table, narrow → fallback", () => {
  assert.equal(resolveInitialView(null, true, "cards"), "table");
  assert.equal(resolveInitialView(null, false, "cards"), "cards");
  assert.equal(resolveInitialView("garbage", false, "table"), "table");
});

test("before the choice is restored the breakpoint decides (no SSR flash)", () => {
  const cls = documentViewClasses("cards", false);
  assert.match(cls.cards, /\bsm:hidden\b/);
  assert.match(cls.table, /\bhidden\b/);
  assert.match(cls.table, /\bsm:block\b/);
  assert.match(cls.table, /\bprint:block\b/);
});

test("after restore the state decides on every width", () => {
  const cards = documentViewClasses("cards", true);
  assert.doesNotMatch(cards.cards, /\bsm:hidden\b/);
  assert.match(cards.cards, /\bprint:hidden\b/);
  assert.match(cards.table, /^hidden\b/);
  assert.doesNotMatch(cards.table, /\bsm:block\b/);
  assert.match(cards.table, /\bprint:block\b/);

  const table = documentViewClasses("table", true);
  assert.equal(table.table, "");
});
