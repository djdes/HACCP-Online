import assert from "node:assert/strict";
import test from "node:test";

import {
  cleaningConfigSchema,
  parseCleaningConfigSafe,
  parseCleaningConfigStrict,
} from "./config-schema";

test("parseCleaningConfigSafe accepts empty object with defaults", () => {
  const r = parseCleaningConfigSafe({});
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.data.selectedRoomIds, []);
    assert.deepEqual(r.data.matrix, {});
    assert.equal(r.data.skipWeekends, false);
  }
});

test("parseCleaningConfigSafe accepts null", () => {
  const r = parseCleaningConfigSafe(null);
  assert.equal(r.ok, true);
});

test("rooms-mode minimum config validates", () => {
  const r = parseCleaningConfigSafe({
    cleaningMode: "rooms",
    selectedRoomIds: ["room-1", "room-2"],
    selectedCleanerUserIds: ["user-1"],
    matrix: { "room-1": { "2026-05-08": "T" } },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.cleaningMode, "rooms");
    assert.equal(r.data.selectedRoomIds.length, 2);
  }
});

test("pairs-mode legacy config validates", () => {
  const r = parseCleaningConfigSafe({
    cleaningMode: "pairs",
    responsiblePairs: [
      {
        id: "pair-1",
        cleaningTitle: "Уборщик",
        cleaningUserId: "user-1",
        cleaningUserName: "Зинаида",
        controlTitle: "Зав. произв.",
        controlUserId: "user-2",
        controlUserName: "Ярослав",
      },
    ],
    rooms: [
      {
        id: "room-1",
        name: "Кухня",
        currentScope: ["Пол", "Столы"],
        generalScope: ["Все поверхности"],
        currentDays: 31, // Mon-Fri bitmask
        generalDays: 64, // Sun
      },
    ],
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.cleaningMode, "pairs");
    assert.equal(r.data.responsiblePairs.length, 1);
    assert.equal(r.data.rooms[0].currentDays, 31);
  }
});

test("invalid matrix shape returns issues, not throws", () => {
  const r = parseCleaningConfigSafe({
    matrix: "this should be an object", // wrong type
  });
  assert.equal(r.ok, false);
});

test("strict parse throws on invalid input", () => {
  assert.throws(() => {
    parseCleaningConfigStrict({ cleaningMode: "invalid-mode" });
  });
});

test("currentDays bitmask range enforced (0..127)", () => {
  const r = parseCleaningConfigSafe({
    rooms: [
      { id: "r1", name: "x", currentDays: 999 }, // выходит за 127
    ],
  });
  assert.equal(r.ok, false);
});

test("verifierByRoomId record validates", () => {
  const r = parseCleaningConfigSafe({
    verifierByRoomId: { "room-1": "user-1", "room-2": "user-2" },
  });
  assert.equal(r.ok, true);
});

test("matrix value can be empty string (cleared cell)", () => {
  const r = parseCleaningConfigSafe({
    matrix: { "room-1": { "2026-05-08": "" } },
  });
  assert.equal(r.ok, true);
});

test("matrix value can be initials (after webhook completion)", () => {
  const r = parseCleaningConfigSafe({
    matrix: { "room-1": { "2026-05-08": "ЗП" } },
  });
  assert.equal(r.ok, true);
});

test("schema is independent from any external mutation", () => {
  // Гарантируем что schema — frozen. Если понадобится менять — через
  // отдельный module и osnova контракта.
  const before = JSON.stringify(cleaningConfigSchema.shape);
  parseCleaningConfigSafe({ cleaningMode: "pairs" });
  const after = JSON.stringify(cleaningConfigSchema.shape);
  assert.equal(before, after);
});
