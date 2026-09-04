import assert from "node:assert/strict";
import test from "node:test";

import {
  listCleaningCodeEntries,
  listCleaningRoomCompletions,
  mergeCleaningRoomCompletion,
  normalizeCleanerByRoomId,
  normalizeCleaningDocumentConfig,
  resolveDocumentController,
  resolveRoomCleaners,
  resolveRoomController,
} from "./cleaning-document";
import { hasExplicitPerRowDistribution } from "./tasksflow-bulk-assign";

const base = {
  selectedRoomIds: ["r1", "r2", "r3", "r4"],
  selectedCleanerUserIds: ["u1", "u2"],
  roomsRaceMode: false,
  cleanerByRoomId: {} as Record<string, string[]>,
};

// ---------------------------------------------------------------- AC2

test("resolveRoomCleaners: round-robin по индексу в selectedRoomIds", () => {
  assert.deepEqual(resolveRoomCleaners(base, "r1"), ["u1"]);
  assert.deepEqual(resolveRoomCleaners(base, "r2"), ["u2"]);
  assert.deepEqual(resolveRoomCleaners(base, "r3"), ["u1"]);
  assert.deepEqual(resolveRoomCleaners(base, "r4"), ["u2"]);
});

test("resolveRoomCleaners: race → весь пул", () => {
  const cfg = { ...base, roomsRaceMode: true };
  assert.deepEqual(resolveRoomCleaners(cfg, "r3"), ["u1", "u2"]);
});

test("resolveRoomCleaners: закрепление заменяет только свою зону", () => {
  const cfg = { ...base, cleanerByRoomId: { r2: ["u1"] } };
  assert.deepEqual(resolveRoomCleaners(cfg, "r2"), ["u1"]);
  // Соседи не сдвинулись.
  assert.deepEqual(resolveRoomCleaners(cfg, "r1"), ["u1"]);
  assert.deepEqual(resolveRoomCleaners(cfg, "r3"), ["u1"]);
  assert.deepEqual(resolveRoomCleaners(cfg, "r4"), ["u2"]);
});

test("resolveRoomCleaners: несколько закреплённых = гонка в зоне", () => {
  const cfg = { ...base, cleanerByRoomId: { r1: ["u2", "u1"] } };
  assert.deepEqual(resolveRoomCleaners(cfg, "r1"), ["u2", "u1"]);
});

test("resolveRoomCleaners: закреплённый вне пула игнорируется", () => {
  const cfg = { ...base, cleanerByRoomId: { r1: ["ghost"] } };
  assert.deepEqual(resolveRoomCleaners(cfg, "r1"), ["u1"]);
});

test("resolveRoomCleaners: пустой пул → никого", () => {
  const cfg = { ...base, selectedCleanerUserIds: [], cleanerByRoomId: { r1: ["u1"] } };
  assert.deepEqual(resolveRoomCleaners(cfg, "r1"), []);
});

test("normalizeCleanerByRoomId: чужие комнаты, чужие люди, дубли", () => {
  const out = normalizeCleanerByRoomId(
    { r1: ["u1", "u1", "ghost"], r9: ["u1"], r2: [], r3: "u1" },
    ["r1", "r2", "r3"],
    ["u1", "u2"],
  );
  assert.deepEqual(out, { r1: ["u1"] });
});

test("normalizeCleaningDocumentConfig: cleanerByRoomId проходит нормализацию", () => {
  const cfg = normalizeCleaningDocumentConfig({
    cleaningMode: "rooms",
    selectedRoomIds: ["r1"],
    selectedCleanerUserIds: ["u1"],
    cleanerByRoomId: { r1: ["u1", "u2"], r2: ["u1"] },
  });
  assert.deepEqual(cfg.cleanerByRoomId, { r1: ["u1"] });
});

test("resolveRoomController: зона → документ → controlResponsibles[0]", () => {
  const ctrl = { id: "c", kind: "control" as const, title: "", userId: "boss", userName: "", code: "С1" };
  assert.equal(
    resolveRoomController({ verifierByRoomId: { r1: ["v1"] }, controlUserId: "d", controlResponsibles: [ctrl] }, "r1"),
    "v1",
  );
  assert.equal(
    resolveRoomController({ verifierByRoomId: {}, controlUserId: "d", controlResponsibles: [ctrl] }, "r1"),
    "d",
  );
  assert.equal(
    resolveRoomController({ verifierByRoomId: {}, controlUserId: null, controlResponsibles: [ctrl] }, "r1"),
    "boss",
  );
  assert.equal(resolveDocumentController({ controlUserId: null, controlResponsibles: [] }), null);
});

test("listCleaningCodeEntries: rooms-mode кодирует пул С1..СN", () => {
  const list = listCleaningCodeEntries(
    { cleaningMode: "rooms", selectedCleanerUserIds: ["u2", "u1"], cleaningResponsibles: [] },
    new Map([["u1", "Иванова"], ["u2", "Петрова"]]),
  );
  assert.deepEqual(
    list.map((x) => [x.code, x.userId, x.userName]),
    [["С1", "u2", "Петрова"], ["С2", "u1", "Иванова"]],
  );
});

// ---------------------------------------------------------------- AC1

test("mergeCleaningRoomCompletion: две зоны одного уборщика в один день", () => {
  const first = mergeCleaningRoomCompletion(undefined, {
    roomId: "r1",
    cleanerUserId: "u1",
    dateKey: "2026-09-04",
    completedAt: "2026-09-04T08:00:00.000Z",
  });
  const second = mergeCleaningRoomCompletion(first, {
    roomId: "r2",
    cleanerUserId: "u1",
    dateKey: "2026-09-04",
    completedAt: "2026-09-04T09:00:00.000Z",
  });
  const rooms = listCleaningRoomCompletions(second).map((c) => c.roomId).sort();
  assert.deepEqual(rooms, ["r1", "r2"]);
  // Legacy-поля указывают на последнюю зону.
  assert.equal(second.roomId, "r2");
  assert.equal(second.completedAt, "2026-09-04T09:00:00.000Z");
});

test("listCleaningRoomCompletions: legacy-запись без rooms читается", () => {
  const out = listCleaningRoomCompletions({
    kind: "cleaning_room",
    roomId: "r1",
    dateKey: "2026-09-04",
    cleanerUserId: "u1",
    completedAt: "x",
    controllerUserId: "boss",
    controllerCompletedAt: "y",
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].roomId, "r1");
  assert.equal(out[0].controllerUserId, "boss");
});

test("listCleaningRoomCompletions: activities-запись → пусто", () => {
  assert.deepEqual(listCleaningRoomCompletions({ activities: [] }), []);
});

test("mergeCleaningRoomCompletion: legacy-запись апгрейдится без потери зоны", () => {
  const merged = mergeCleaningRoomCompletion(
    { kind: "cleaning_room", roomId: "r1", dateKey: "d", cleanerUserId: "u1", completedAt: "a" },
    { roomId: "r2", cleanerUserId: "u1", dateKey: "d", completedAt: "b" },
  );
  assert.deepEqual(Object.keys(merged.rooms as object).sort(), ["r1", "r2"]);
});

// ---------------------------------------------------------------- AC7

test("hasExplicitPerRowDistribution: только cleaning с room:: строками", () => {
  assert.equal(hasExplicitPerRowDistribution("cleaning", [{ rowKey: "room::r1::cleaner::u1" }]), true);
  assert.equal(hasExplicitPerRowDistribution("cleaning", [{ rowKey: "pair-1" }]), false);
  assert.equal(hasExplicitPerRowDistribution("hygiene", [{ rowKey: "room::r1::cleaner::u1" }]), false);
});
