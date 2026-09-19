import assert from "node:assert/strict";
import test from "node:test";

import { normalizePestControlEntryData } from "./pest-control-document";

test("запись без времени не превращается в 00:00", () => {
  const data = normalizePestControlEntryData({
    performedDate: "2026-03-02",
    performedHour: "",
    performedMinute: "",
    event: "Дератизация",
  });
  assert.equal(data.timeSpecified, false);
  assert.equal(data.performedHour, "");
  assert.equal(data.performedMinute, "");
});

test("указанное время сохраняется и дополняется нулём", () => {
  const data = normalizePestControlEntryData({
    performedDate: "2026-03-02",
    performedHour: "9",
    performedMinute: "5",
  });
  assert.equal(data.timeSpecified, true);
  assert.equal(data.performedHour, "09");
  assert.equal(data.performedMinute, "05");
});

test("полночь остаётся полночью, если время задано явно", () => {
  const data = normalizePestControlEntryData({
    performedDate: "2026-03-02",
    performedHour: "00",
    performedMinute: "00",
    timeSpecified: true,
  });
  assert.equal(data.timeSpecified, true);
  assert.equal(data.performedHour, "00");
  assert.equal(data.performedMinute, "00");
});
