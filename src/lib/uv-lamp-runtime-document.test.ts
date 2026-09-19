import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEntryDurationMinutes,
  calculateMonthlyHours,
  isUvRuntimeEntryDataEmpty,
  listUvRuntimeSessions,
  normalizeUvRuntimeEntryData,
} from "./uv-lamp-runtime-document";

test("старая запись с одним сеансом читается как раньше", () => {
  const data = normalizeUvRuntimeEntryData({
    startTime: "09:00",
    endTime: "10:00",
  });
  assert.deepEqual(data, { startTime: "09:00", endTime: "10:00" });
  assert.equal(listUvRuntimeSessions(data).length, 1);
  assert.equal(calculateEntryDurationMinutes(data), 60);
});

test("несколько сеансов за день суммируются", () => {
  const data = normalizeUvRuntimeEntryData({
    startTime: "09:00",
    endTime: "10:00",
    extraSessions: [
      { startTime: "14:00", endTime: "14:30" },
      { startTime: "20:00", endTime: "21:00" },
    ],
  });
  assert.equal(listUvRuntimeSessions(data).length, 3);
  assert.equal(calculateEntryDurationMinutes(data), 60 + 30 + 60);
});

test("мусор в extraSessions отбрасывается", () => {
  const data = normalizeUvRuntimeEntryData({
    startTime: "09:00",
    endTime: "10:00",
    extraSessions: [null, 5, { startTime: "", endTime: "" }, { startTime: "12:00" }],
  });
  assert.deepEqual(data.extraSessions, [{ startTime: "12:00", endTime: "" }]);
});

test("месячные часы учитывают все сеансы", () => {
  const months = calculateMonthlyHours(
    [
      {
        date: "2026-03-02",
        data: normalizeUvRuntimeEntryData({
          startTime: "09:00",
          endTime: "10:00",
          extraSessions: [{ startTime: "15:00", endTime: "16:00" }],
        }),
      },
    ],
    100,
  );
  assert.deepEqual(months, [{ month: "2026-03", hours: 2, remaining: 98 }]);
});

test("пустая запись остаётся пустой", () => {
  assert.equal(
    isUvRuntimeEntryDataEmpty(normalizeUvRuntimeEntryData({})),
    true,
  );
  assert.equal(
    isUvRuntimeEntryDataEmpty(
      normalizeUvRuntimeEntryData({
        startTime: "",
        endTime: "",
        extraSessions: [{ startTime: "10:00", endTime: "11:00" }],
      }),
    ),
    false,
  );
});
