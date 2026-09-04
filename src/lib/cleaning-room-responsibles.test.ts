import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRoomResponsiblesToConfig,
  countRoomsPerUser,
  toUserIdList,
} from "./cleaning-room-responsibles";
import {
  normalizeCleaningDocumentConfig,
  resolveRoomCleaners,
  resolveRoomController,
  resolveRoomControllers,
} from "./cleaning-document";

const base = {
  selectedRoomIds: ["r1", "r2", "r3"],
  selectedCleanerUserIds: ["u1", "u2"],
  roomsRaceMode: false,
  cleanerByRoomId: {} as Record<string, string[]>,
  verifierByRoomId: {} as Record<string, string[]>,
};

const rooms = [
  { id: "r1", cleanerUserIds: ["u3", "u1"], verifierUserIds: ["v1", "v2"] },
  { id: "r2", cleanerUserIds: [], verifierUserIds: [] },
  { id: "r9", cleanerUserIds: ["u9"], verifierUserIds: ["v9"] },
];

// ---------------------------------------------------------------- AC1

test("DB-уборщики комнаты заменяют закрепление, пул расширяется в порядке raw → новые", () => {
  const cfg = applyRoomResponsiblesToConfig(
    { ...base, cleanerByRoomId: { r1: ["u2"] } },
    rooms,
  );
  assert.deepEqual(cfg.cleanerByRoomId.r1, ["u3", "u1"]);
  assert.deepEqual(cfg.selectedCleanerUserIds, ["u1", "u2", "u3"]);
  assert.deepEqual(resolveRoomCleaners(cfg, "r1"), ["u3", "u1"]);
});

test("комнаты без DB-уборщиков сохраняют legacy-закрепление и пул", () => {
  const cfg = applyRoomResponsiblesToConfig(
    { ...base, cleanerByRoomId: { r2: ["u2"] } },
    rooms,
  );
  assert.deepEqual(cfg.cleanerByRoomId.r2, ["u2"]);
  assert.deepEqual(resolveRoomCleaners(cfg, "r2"), ["u2"]);
  // r3 — нет ни DB, ни закрепления → round-robin по индексу в
  // расширенном пуле [u1, u2, u3]: индекс 2 → u3.
  assert.deepEqual(resolveRoomCleaners(cfg, "r3"), ["u3"]);
});

test("комнаты вне selectedRoomIds игнорируются", () => {
  const cfg = applyRoomResponsiblesToConfig(base, rooms);
  assert.equal(cfg.cleanerByRoomId.r9, undefined);
  assert.equal(cfg.verifierByRoomId.r9, undefined);
  assert.ok(!cfg.selectedCleanerUserIds.includes("u9"));
});

test("неизвестные (архивные) сотрудники отбрасываются", () => {
  const cfg = applyRoomResponsiblesToConfig(
    base,
    rooms,
    new Set(["u1", "u2", "v2"]),
  );
  assert.deepEqual(cfg.cleanerByRoomId.r1, ["u1"]);
  assert.deepEqual(cfg.verifierByRoomId.r1, ["v2"]);
  assert.deepEqual(cfg.selectedCleanerUserIds, ["u1", "u2"]);
});

test("пустой raw-пул + DB-уборщики → непустой эффективный пул", () => {
  const cfg = applyRoomResponsiblesToConfig(
    { ...base, selectedCleanerUserIds: [] },
    rooms,
  );
  assert.deepEqual(cfg.selectedCleanerUserIds, ["u3", "u1"]);
  assert.deepEqual(resolveRoomCleaners(cfg, "r1"), ["u3", "u1"]);
});

test("вход не мутируется, дубли внутри комнаты схлопываются", () => {
  const input = {
    ...base,
    cleanerByRoomId: { r2: ["u2"] } as Record<string, string[]>,
    verifierByRoomId: {} as Record<string, string[]>,
  };
  const snapshot = JSON.stringify(input);
  const cfg = applyRoomResponsiblesToConfig(input, [
    { id: "r1", cleanerUserIds: ["u3", "u3"], verifierUserIds: ["v1", "v1"] },
  ]);
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(cfg.cleanerByRoomId.r1, ["u3"]);
  assert.deepEqual(cfg.verifierByRoomId.r1, ["v1"]);
});

// ---------------------------------------------------------------- AC2

test("resolveRoomControllers: комната → controlUserId → controlResponsibles[0]", () => {
  const cfg = applyRoomResponsiblesToConfig(
    { ...base, controlUserId: "c0", controlResponsibles: [] },
    rooms,
  );
  assert.deepEqual(resolveRoomControllers(cfg, "r1"), ["v1", "v2"]);
  assert.equal(resolveRoomController(cfg, "r1"), "v1");
  assert.deepEqual(resolveRoomControllers(cfg, "r2"), ["c0"]);
  assert.deepEqual(
    resolveRoomControllers(
      { verifierByRoomId: {}, controlUserId: null, controlResponsibles: [] },
      "r2",
    ),
    [],
  );
  assert.equal(
    resolveRoomController(
      { verifierByRoomId: {}, controlUserId: null, controlResponsibles: [] },
      "r2",
    ),
    null,
  );
});

test("нормализатор: legacy verifierByRoomId string → string[]", () => {
  const cfg = normalizeCleaningDocumentConfig({
    cleaningMode: "rooms",
    selectedRoomIds: ["r1", "r2"],
    selectedCleanerUserIds: ["u1"],
    verifierByRoomId: { r1: "v1", r2: ["v2", "v2", "v3"], r3: "", r4: 5 },
  });
  assert.deepEqual(cfg.verifierByRoomId, { r1: ["v1"], r2: ["v2", "v3"] });
});

// ---------------------------------------------------------------- helpers

test("countRoomsPerUser считает помещения по роли", () => {
  const cleaners = countRoomsPerUser(rooms, "cleaner");
  assert.equal(cleaners.get("u1"), 1);
  assert.equal(cleaners.get("u3"), 1);
  assert.equal(cleaners.get("u9"), 1);
  const verifiers = countRoomsPerUser(rooms, "verifier");
  assert.equal(verifiers.get("v1"), 1);
  assert.equal(verifiers.get("u1"), undefined);
});

test("toUserIdList чистит unknown", () => {
  assert.deepEqual(toUserIdList(["a", "", 1, "a", "b"]), ["a", "b"]);
  assert.deepEqual(toUserIdList(null), []);
});
