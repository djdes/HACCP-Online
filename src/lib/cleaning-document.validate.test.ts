import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRoomScheduleToMatrix,
  normalizeCleaningDocumentConfig,
  validateCleaningDocumentConfig,
  type CleaningDocumentConfig,
} from "./cleaning-document";

function roomsModeConfig(
  patch: Partial<CleaningDocumentConfig> = {},
): CleaningDocumentConfig {
  return normalizeCleaningDocumentConfig(
    { cleaningMode: "rooms", ...patch },
    { users: [] },
  );
}

test("validate: rooms-mode без справочника, но со строками в config.rooms — сохраняется", () => {
  const config = roomsModeConfig({
    selectedRoomIds: [],
    selectedCleanerUserIds: [],
  });
  assert.equal(config.cleaningMode, "rooms");
  assert.ok(config.rooms.length > 0, "blueprint-строки должны остаться");
  assert.doesNotThrow(() => validateCleaningDocumentConfig(config));
});

test("validate: rooms-mode совсем без строк — ошибка", () => {
  const config = roomsModeConfig();
  assert.throws(() =>
    validateCleaningDocumentConfig({
      ...config,
      rooms: [],
      selectedRoomIds: [],
    }),
  );
});

test("validate: уборщик из cleaningResponsibles засчитывается", () => {
  const config = roomsModeConfig();
  assert.doesNotThrow(() =>
    validateCleaningDocumentConfig({
      ...config,
      selectedRoomIds: ["r1"],
      selectedCleanerUserIds: [],
      cleaningResponsibles: [
        {
          id: "c1",
          kind: "cleaning",
          code: "С1",
          title: "Уборщик",
          userId: "u1",
          userName: "Иван",
        },
      ],
    }),
  );
});

test("applyRoomScheduleToMatrix: roomIds ограничивает overwrite одним помещением", () => {
  const base = roomsModeConfig();
  const [roomA, roomB] = base.rooms;
  assert.ok(roomA && roomB, "нужны минимум два blueprint-помещения");

  const withMarks: CleaningDocumentConfig = {
    ...base,
    matrix: {
      [roomA.id]: { "2026-03-10": "T" },
      [roomB.id]: { "2026-03-10": "T" },
    },
  };

  const next = applyRoomScheduleToMatrix(
    withMarks,
    ["2026-03-10"],
    "overwrite",
    new Map([
      [
        roomA.id,
        {
          id: roomA.id,
          currentDays: 0,
          generalDays: 0,
          currentScheduleType: "weekly" as const,
          generalScheduleType: "weekly" as const,
          currentMonthDays: [],
          generalMonthDays: [],
        },
      ],
    ]),
    { roomIds: [roomA.id] },
  );

  // roomA попал под overwrite с пустым планом → отметка стёрта.
  assert.equal(next.matrix[roomA.id]?.["2026-03-10"], undefined);
  // roomB не трогали.
  assert.equal(next.matrix[roomB.id]?.["2026-03-10"], "T");
});
