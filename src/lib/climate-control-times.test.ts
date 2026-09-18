import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeClimateControlTime,
  renameClimateControlTimes,
  type ClimateEntryData,
} from "./climate-document";

describe("renameClimateControlTimes", () => {
  const entry: ClimateEntryData = {
    responsibleTitle: null,
    measurements: {
      "room-1": {
        "10:00": { temperature: 21, humidity: 40 },
        "16:00": { temperature: 22, humidity: null },
      },
    },
    corrections: { "room-1:10:00:temperature": "проветрили", "room-1:16:00:humidity": "—" },
  };

  it("переносит замеры и комментарии под новое время", () => {
    const next = renameClimateControlTimes(entry, { "10:00": "09:30" });
    assert.deepEqual(next.measurements["room-1"]["09:30"], { temperature: 21, humidity: 40 });
    assert.equal(next.measurements["room-1"]["10:00"], undefined);
    assert.deepEqual(next.measurements["room-1"]["16:00"], { temperature: 22, humidity: null });
    assert.equal(next.corrections?.["room-1:09:30:temperature"], "проветрили");
    assert.equal(next.corrections?.["room-1:10:00:temperature"], undefined);
    assert.equal(next.corrections?.["room-1:16:00:humidity"], "—");
  });

  it("не затирает значения пустым слотом при переезде на занятое время", () => {
    const data: ClimateEntryData = {
      responsibleTitle: null,
      measurements: {
        "room-1": {
          "10:00": { temperature: null, humidity: null },
          "14:00": { temperature: 19, humidity: 50 },
        },
      },
    };
    const next = renameClimateControlTimes(data, { "10:00": "14:00" });
    assert.deepEqual(next.measurements["room-1"]["14:00"], { temperature: 19, humidity: 50 });
  });

  it("возвращает те же данные без изменений в mapping", () => {
    assert.equal(renameClimateControlTimes(entry, {}), entry);
    assert.equal(renameClimateControlTimes(entry, { "10:00": "10:00" }), entry);
  });
});

describe("normalizeClimateControlTime", () => {
  it("принимает ЧЧ:ММ и дополняет нулём", () => {
    assert.equal(normalizeClimateControlTime("9:05"), "09:05");
    assert.equal(normalizeClimateControlTime(" 16:30 "), "16:30");
  });
  it("отклоняет мусор", () => {
    assert.equal(normalizeClimateControlTime("25:00"), null);
    assert.equal(normalizeClimateControlTime("10-00"), null);
    assert.equal(normalizeClimateControlTime(10), null);
  });
});
