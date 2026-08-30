import assert from "node:assert/strict";
import test from "node:test";

import {
  localDayKey,
  localTimeParts,
  localTimeValue,
} from "@/lib/entry-defaults";

test("localDayKey returns the local calendar day, not the UTC one", () => {
  // 01:30 по местным часам. Если считать дату через toISOString(), в
  // поясе восточнее UTC вернётся вчерашнее число — ночная смена
  // получала бы записи не тем днём.
  const localMidnightish = new Date(2026, 7, 28, 1, 30, 0);

  assert.equal(localDayKey(localMidnightish), "2026-08-28");
});

test("localDayKey pads month and day to two digits", () => {
  assert.equal(localDayKey(new Date(2026, 0, 5, 12, 0, 0)), "2026-01-05");
});

test("localTimeParts and localTimeValue agree", () => {
  const at = new Date(2026, 7, 28, 9, 5, 0);

  assert.deepEqual(localTimeParts(at), { hour: 9, minute: 5 });
  assert.equal(localTimeValue(at), "09:05");
});
