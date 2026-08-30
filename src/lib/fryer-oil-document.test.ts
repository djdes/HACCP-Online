import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FRYER_OIL_SHIFT,
  defaultFryerOilDocumentConfig,
  fryerOilDayKey,
  normalizeFryerOilDocumentConfig,
  normalizeFryerOilEntryData,
  normalizeFryerOilShift,
  parseShiftTime,
} from "@/lib/fryer-oil-document";

test("fryerOilDayKey groups rows by the date the person entered", () => {
  // Несколько фритюрниц за один день — несколько строк с одной датой.
  // Диалог собирает их в один день именно по этому ключу.
  const day = "2026-08-28";
  const rows = ["10:00", "14:00", "19:00"].map((time) => ({
    date: `${day}T${time}:00.000Z`,
    data: normalizeFryerOilEntryData({ startDate: day }),
  }));

  assert.deepEqual(
    rows.map(fryerOilDayKey),
    [day, day, day],
    "строки одного дня обязаны давать один ключ"
  );
});

test("fryerOilDayKey falls back to the technical date for seeded rows", () => {
  // Журнал заводит по пустой строке на каждый день периода, и в них
  // startDate пустой. Без фолбэка все заготовки склеились бы в один
  // «пустой день», и открыв 5 августа человек увидел бы весь месяц.
  const seeded = {
    date: "2026-08-28T00:00:00.000Z",
    data: normalizeFryerOilEntryData({ _autoSeeded: true }),
  };

  assert.equal(seeded.data.startDate, "");
  assert.equal(fryerOilDayKey(seeded), "2026-08-28");
});

test("fryerOilDayKey keeps seeded and filled rows of the same day together", () => {
  const seeded = {
    date: "2026-08-28T00:00:00.000Z",
    data: normalizeFryerOilEntryData({}),
  };
  const filled = {
    date: "2026-08-28T10:00:00.000Z",
    data: normalizeFryerOilEntryData({ startDate: "2026-08-28" }),
  };

  assert.equal(fryerOilDayKey(seeded), fryerOilDayKey(filled));
});

test("normalizeFryerOilEntryData leaves measurements empty", () => {
  // Журнал показывают Роспотребнадзору: заготовка новой строки не имеет
  // права нести показатели за непроведённый контроль.
  const blank = normalizeFryerOilEntryData({});

  assert.equal(blank.startHour, null);
  assert.equal(blank.startMinute, null);
  assert.equal(blank.endHour, null);
  assert.equal(blank.endMinute, null);
  assert.equal(blank.qualityStart, null);
  assert.equal(blank.qualityEnd, null);
  assert.equal(blank.carryoverKg, 0);
  assert.equal(blank.disposedKg, 0);
});

test("parseShiftTime accepts valid HH:MM and rejects the rest", () => {
  assert.deepEqual(parseShiftTime("07:00"), { hour: 7, minute: 0 });
  assert.deepEqual(parseShiftTime("16:30"), { hour: 16, minute: 30 });
  assert.deepEqual(parseShiftTime(" 7:05 "), { hour: 7, minute: 5 });

  // Мусор в конфиге не должен ронять форму — вызывающий падает на «сейчас».
  assert.equal(parseShiftTime(""), null);
  assert.equal(parseShiftTime("25:00"), null);
  assert.equal(parseShiftTime("07:60"), null);
  assert.equal(parseShiftTime("утро"), null);
});

test("normalizeFryerOilShift falls back to the default shift", () => {
  assert.deepEqual(normalizeFryerOilShift(undefined), DEFAULT_FRYER_OIL_SHIFT);
  assert.deepEqual(normalizeFryerOilShift({ startTime: "нет" }), DEFAULT_FRYER_OIL_SHIFT);
  assert.deepEqual(normalizeFryerOilShift({ startTime: "08:15", endTime: "20:00" }), {
    startTime: "08:15",
    endTime: "20:00",
  });
});

test("default fryer config carries the 07:00-16:00 shift", () => {
  const config = defaultFryerOilDocumentConfig();

  assert.equal(config.shift.startTime, "07:00");
  assert.equal(config.shift.endTime, "16:00");
});

test("normalizeFryerOilDocumentConfig keeps a saved shift", () => {
  const config = normalizeFryerOilDocumentConfig({
    shift: { startTime: "06:30", endTime: "18:30" },
  });

  assert.deepEqual(config.shift, { startTime: "06:30", endTime: "18:30" });
});
