import assert from "node:assert/strict";
import test from "node:test";

import {
  appendUvRuntimeSession,
  calculateEntryDurationMinutes,
  calculateMonthlyHours,
  isUvRuntimeEntryDataEmpty,
  listUvRuntimeSessionSlots,
  listUvRuntimeSessions,
  normalizeUvRuntimeEntryData,
  removeUvRuntimeSession,
  updateUvRuntimeSession,
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

test("слоты сеансов не теряют пустой первый сеанс", () => {
  const data = normalizeUvRuntimeEntryData({
    startTime: "",
    endTime: "",
    extraSessions: [{ startTime: "14:00", endTime: "15:00" }],
  });
  assert.deepEqual(listUvRuntimeSessionSlots(data), [
    { startTime: "", endTime: "" },
    { startTime: "14:00", endTime: "15:00" },
  ]);
});

test("второй сеанс можно изменить", () => {
  const data = normalizeUvRuntimeEntryData({
    startTime: "09:00",
    endTime: "10:00",
    extraSessions: [{ startTime: "14:00", endTime: "15:00" }],
  });
  const next = updateUvRuntimeSession(data, 1, { endTime: "16:00" });
  assert.deepEqual(next.extraSessions, [{ startTime: "14:00", endTime: "16:00" }]);
  assert.equal(calculateEntryDurationMinutes(next), 60 + 120);
});

test("удаление первого сеанса поднимает следующий в плоские поля", () => {
  const data = normalizeUvRuntimeEntryData({
    startTime: "09:00",
    endTime: "10:00",
    extraSessions: [
      { startTime: "14:00", endTime: "15:00" },
      { startTime: "20:00", endTime: "21:00" },
    ],
  });
  const next = removeUvRuntimeSession(data, 0);
  assert.equal(next.startTime, "14:00");
  assert.equal(next.endTime, "15:00");
  assert.deepEqual(next.extraSessions, [{ startTime: "20:00", endTime: "21:00" }]);
});

test("удаление последнего доп. сеанса возвращает форму старой записи", () => {
  const data = normalizeUvRuntimeEntryData({
    startTime: "09:00",
    endTime: "10:00",
    extraSessions: [{ startTime: "14:00", endTime: "15:00" }],
  });
  assert.deepEqual(removeUvRuntimeSession(data, 1), {
    startTime: "09:00",
    endTime: "10:00",
  });
});

test("добавление сеанса дописывает его в конец дня", () => {
  const data = normalizeUvRuntimeEntryData({ startTime: "09:00", endTime: "10:00" });
  const next = appendUvRuntimeSession(data, { startTime: "18:00", endTime: "19:00" });
  assert.deepEqual(next.extraSessions, [{ startTime: "18:00", endTime: "19:00" }]);
  assert.equal(calculateEntryDurationMinutes(next), 120);
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
