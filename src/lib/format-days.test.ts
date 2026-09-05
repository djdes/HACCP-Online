/**
 * Склонение «дней». Запуск: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";

import { formatDaysRu } from "@/lib/format-days";

test("formatDaysRu склоняет дни", () => {
  assert.equal(formatDaysRu(1), "1 день");
  assert.equal(formatDaysRu(3), "3 дня");
  assert.equal(formatDaysRu(11), "11 дней");
  assert.equal(formatDaysRu(14), "14 дней");
});
