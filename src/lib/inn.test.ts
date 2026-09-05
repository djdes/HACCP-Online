import assert from "node:assert/strict";
import test from "node:test";

import { innDigits, isValidInn } from "./inn";

test("isValidInn: контрольная сумма юрлица и ИП", () => {
  assert.equal(isValidInn("7707083893"), true); // Сбербанк
  assert.equal(isValidInn("500100732259"), true); // ИП, 12 знаков
  assert.equal(isValidInn("7707083894"), false);
  assert.equal(isValidInn("1234567890"), false);
  assert.equal(isValidInn("770708389"), false);
  assert.equal(isValidInn(""), false);
});

test("innDigits оставляет только цифры", () => {
  assert.equal(innDigits(" 77-07 083893 "), "7707083893");
  assert.equal(innDigits(null), "");
});
