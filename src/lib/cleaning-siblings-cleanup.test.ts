import assert from "node:assert/strict";
import test from "node:test";

import { extractRoomIdFromCleanerRowKey } from "./cleaning-siblings-cleanup";

test("extractRoomIdFromCleanerRowKey: валидный rowKey", () => {
  assert.equal(
    extractRoomIdFromCleanerRowKey("room::abc-123::cleaner::42"),
    "abc-123",
  );
});

test("extractRoomIdFromCleanerRowKey: roomId с двоеточиями невалиден (limit by ::)", () => {
  // roomId не должен содержать `::` — мы используем `::` как разделитель.
  // Конкретно для прод формат: roomId это cuid (без `::`).
  assert.equal(
    extractRoomIdFromCleanerRowKey("room::a::b::cleaner::42"),
    null,
  );
});

test("extractRoomIdFromCleanerRowKey: pairs-mode rowKey не подходит", () => {
  // pairs-mode использует другой формат, не должен совпасть.
  assert.equal(
    extractRoomIdFromCleanerRowKey("cleaning_pair::123"),
    null,
  );
});

test("extractRoomIdFromCleanerRowKey: пустая строка → null", () => {
  assert.equal(extractRoomIdFromCleanerRowKey(""), null);
});

test("extractRoomIdFromCleanerRowKey: room-only rowKey без cleaner → null", () => {
  // Строка для room-row в matrix (используется как rowId таблицы).
  // Не race-задача, siblings cleanup не применяется.
  assert.equal(extractRoomIdFromCleanerRowKey("room::abc-123"), null);
});

test("extractRoomIdFromCleanerRowKey: пустой userId → null", () => {
  // Совпадение с parseRoomsModeRowKey в tasksflow-adapters/cleaning.ts:
  // обе функции должны одинаково rejectить malformed rowKey.
  assert.equal(extractRoomIdFromCleanerRowKey("room::abc::cleaner::"), null);
});
