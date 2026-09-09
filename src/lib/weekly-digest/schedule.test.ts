import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isDigestSlot, localParts, shouldSendWeeklyDigest } from "@/lib/weekly-digest/schedule";

// 2026-09-14 — понедельник. 05:00 UTC = 08:00 в Москве = 15:00 во Владивостоке.
const mondayMoscow8 = new Date("2026-09-14T05:00:00.000Z");

describe("localParts / isDigestSlot", () => {
  it("считает день недели и час по поясу организации", () => {
    assert.deepEqual(localParts(mondayMoscow8, "Europe/Moscow"), { weekday: 1, hour: 8 });
    assert.deepEqual(localParts(mondayMoscow8, "Asia/Vladivostok"), { weekday: 1, hour: 15 });
    assert.equal(isDigestSlot(mondayMoscow8, "Europe/Moscow"), true);
    assert.equal(isDigestSlot(mondayMoscow8, "Asia/Vladivostok"), false);
    // Владивосток: понедельник 08:00 = воскресенье 22:00 UTC.
    assert.equal(isDigestSlot(new Date("2026-09-13T22:00:00.000Z"), "Asia/Vladivostok"), true);
  });
  it("неизвестный пояс — как Москва", () => {
    assert.deepEqual(localParts(mondayMoscow8, "Nowhere/Nope"), { weekday: 1, hour: 8 });
  });
});

describe("shouldSendWeeklyDigest", () => {
  it("в слот — шлём, вне слота — нет, недавно слали — нет, force — всегда", () => {
    assert.deepEqual(shouldSendWeeklyDigest({ now: mondayMoscow8, timeZone: "Europe/Moscow", lastSentAt: null }), { send: true, reason: "slot" });
    assert.deepEqual(shouldSendWeeklyDigest({ now: new Date("2026-09-14T06:00:00.000Z"), timeZone: "Europe/Moscow", lastSentAt: null }), { send: false, reason: "not-slot" });
    assert.deepEqual(
      shouldSendWeeklyDigest({ now: mondayMoscow8, timeZone: "Europe/Moscow", lastSentAt: new Date("2026-09-13T05:00:00.000Z") }),
      { send: false, reason: "sent-recently" }
    );
    assert.deepEqual(
      shouldSendWeeklyDigest({ now: mondayMoscow8, timeZone: "Europe/Moscow", lastSentAt: new Date("2026-09-07T05:00:00.000Z") }),
      { send: true, reason: "slot" }
    );
    assert.deepEqual(shouldSendWeeklyDigest({ now: new Date("2026-09-16T12:00:00.000Z"), timeZone: "Europe/Moscow", lastSentAt: new Date(), force: true }), { send: true, reason: "force" });
  });
});
