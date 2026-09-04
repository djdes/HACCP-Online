import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRoomDirectoryToClimateConfig,
  buildClimateConfigFromRooms,
  climateRowIdForRoom,
  listClimateRoomsNotInDocument,
  normalizeClimateDocumentConfig,
  normalizeClimateRoomNorms,
  suggestDirectoryRoomForClimateRow,
} from "./climate-document";
import {
  applyRoomDirectoryToSanitationConfig,
  buildSanitationDayConfigFromRooms,
  createEmptySanitationRow,
  listSanitationRoomsNotInDocument,
  normalizeSanitationDayConfig,
  sanitationRowIdForRoom,
  suggestDirectoryRoomForSanitationRow,
} from "./sanitation-day-document";

const rooms = [
  {
    id: "R1",
    name: "Сухой склад",
    climateNorms: {
      temperature: { enabled: true, min: 10, max: 20 },
      humidity: { enabled: false, min: null, max: null },
    },
  },
  { id: "R2", name: "Горячий цех", climateNorms: null },
];

// ---------------------------------------------------------------- climate

test("buildClimateConfigFromRooms: id room-<Room.id>, roomId, нормы из справочника или дефолт", () => {
  const cfg = buildClimateConfigFromRooms(rooms);
  assert.equal(cfg.rooms.length, 2);
  assert.equal(cfg.rooms[0].id, climateRowIdForRoom("R1"));
  assert.equal(cfg.rooms[0].roomId, "R1");
  assert.deepEqual(cfg.rooms[0].temperature, { enabled: true, min: 10, max: 20 });
  assert.equal(cfg.rooms[0].humidity.enabled, false);
  assert.deepEqual(cfg.rooms[1].temperature, { enabled: true, min: 18, max: 25 });
  assert.equal(buildClimateConfigFromRooms([]).rooms[0].id, "room-0");
});

test("normalizeClimateDocumentConfig сохраняет roomId и не выдумывает его", () => {
  const cfg = normalizeClimateDocumentConfig({
    rooms: [
      { id: "room-R1", roomId: "R1", name: "x" },
      { id: "legacy", name: "y" },
    ],
  });
  assert.equal(cfg.rooms[0].roomId, "R1");
  assert.equal("roomId" in cfg.rooms[1], false);
});

test("applyRoomDirectoryToClimateConfig: Room wins по имени и нормам, ключи строк не меняются", () => {
  const raw = normalizeClimateDocumentConfig({
    rooms: [
      { id: "room-R1", roomId: "R1", name: "старое имя", temperature: { enabled: true, min: 1, max: 2 } },
      { id: "room-R2", roomId: "R2", name: "старое 2", temperature: { enabled: true, min: 3, max: 4 } },
      { id: "room-gone", roomId: "R9", name: "удалённое" },
      { id: "legacy", name: "без связи" },
    ],
  });
  const eff = applyRoomDirectoryToClimateConfig(raw, rooms);
  assert.equal(eff.rooms[0].id, "room-R1");
  assert.equal(eff.rooms[0].name, "Сухой склад");
  assert.deepEqual(eff.rooms[0].temperature, { enabled: true, min: 10, max: 20 });
  // Нормы в справочнике не заданы → снапшот строки остаётся.
  assert.equal(eff.rooms[1].name, "Горячий цех");
  assert.deepEqual(eff.rooms[1].temperature, { enabled: true, min: 3, max: 4 });
  assert.equal(eff.rooms[2].name, "удалённое");
  assert.equal(eff.rooms[3].name, "без связи");
  // raw не мутирован
  assert.equal(raw.rooms[0].name, "старое имя");
});

test("normalizeClimateRoomNorms: null для пустого/мусора", () => {
  assert.equal(normalizeClimateRoomNorms(null), null);
  assert.equal(normalizeClimateRoomNorms({}), null);
  assert.equal(normalizeClimateRoomNorms("x"), null);
  assert.deepEqual(normalizeClimateRoomNorms({ temperature: { enabled: false } })?.temperature, {
    enabled: false,
    min: null,
    max: null,
  });
});

test("listClimateRoomsNotInDocument / suggestDirectoryRoomForClimateRow", () => {
  const cfg = normalizeClimateDocumentConfig({
    rooms: [{ id: "room-R1", roomId: "R1", name: "x" }, { id: "l", name: "горячий ЦЕХ" }],
  });
  assert.deepEqual(listClimateRoomsNotInDocument(cfg, rooms).map((r) => r.id), ["R2"]);
  assert.equal(suggestDirectoryRoomForClimateRow(cfg.rooms[1], rooms)?.id, "R2");
  assert.equal(suggestDirectoryRoomForClimateRow(cfg.rooms[0], rooms), null);
});

// ---------------------------------------------------------------- sanitation

test("buildSanitationDayConfigFromRooms: строки с roomId, пусто — дефолт", () => {
  const cfg = buildSanitationDayConfigFromRooms(rooms, new Date("2026-03-05T00:00:00Z"));
  assert.equal(cfg.year, 2026);
  assert.deepEqual(
    cfg.rows.map((r) => [r.id, r.roomId, r.roomName]),
    [
      [sanitationRowIdForRoom("R1"), "R1", "Сухой склад"],
      [sanitationRowIdForRoom("R2"), "R2", "Горячий цех"],
    ],
  );
  assert.equal(buildSanitationDayConfigFromRooms([]).rows[0].id, "row-1");
});

test("normalizeSanitationDayConfig сохраняет roomId; createEmptySanitationRow с roomId", () => {
  const cfg = normalizeSanitationDayConfig({
    rows: [{ id: "a", roomId: "R1", roomName: "x" }, { id: "b", roomName: "y" }],
  });
  assert.equal(cfg.rows[0].roomId, "R1");
  assert.equal("roomId" in cfg.rows[1], false);
  const row = createEmptySanitationRow("Имя", "R7");
  assert.equal(row.id, sanitationRowIdForRoom("R7"));
  assert.equal(row.roomId, "R7");
});

test("applyRoomDirectoryToSanitationConfig: имя из Room, legacy — как есть", () => {
  const raw = normalizeSanitationDayConfig({
    rows: [
      { id: "row-room-R1", roomId: "R1", roomName: "старое" },
      { id: "legacy", roomName: "свободный текст" },
    ],
  });
  const eff = applyRoomDirectoryToSanitationConfig(raw, rooms);
  assert.equal(eff.rows[0].roomName, "Сухой склад");
  assert.equal(eff.rows[1].roomName, "свободный текст");
  assert.deepEqual(listSanitationRoomsNotInDocument(raw, rooms).map((r) => r.id), ["R2"]);
  assert.equal(
    suggestDirectoryRoomForSanitationRow({ roomName: "  горячий цех ", roomId: undefined }, rooms)?.id,
    "R2",
  );
});
