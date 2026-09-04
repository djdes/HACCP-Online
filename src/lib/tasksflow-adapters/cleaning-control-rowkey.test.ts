import assert from "node:assert/strict";
import test from "node:test";

import {
  buildControlRowKey,
  controllerScopeRoomIds,
  parseControlRowKey,
} from "./cleaning";

test("parseControlRowKey: legacy-ключ без проверяющего", () => {
  assert.deepEqual(parseControlRowKey("control::doc1::2026-09-04"), {
    documentId: "doc1",
    dateKey: "2026-09-04",
    verifierUserId: null,
  });
});

test("parseControlRowKey: ключ со своим проверяющим", () => {
  assert.deepEqual(parseControlRowKey("control::doc1::2026-09-04::v7"), {
    documentId: "doc1",
    dateKey: "2026-09-04",
    verifierUserId: "v7",
  });
  assert.equal(parseControlRowKey("room::r1::cleaner::u1"), null);
  assert.equal(parseControlRowKey("control::doc1"), null);
});

test("buildControlRowKey ↔ parseControlRowKey", () => {
  const a = buildControlRowKey("d", "2026-01-31");
  const b = buildControlRowKey("d", "2026-01-31", "v1");
  assert.equal(a, "control::d::2026-01-31");
  assert.equal(b, "control::d::2026-01-31::v1");
  assert.equal(parseControlRowKey(a)?.verifierUserId, null);
  assert.equal(parseControlRowKey(b)?.verifierUserId, "v1");
  assert.equal(buildControlRowKey("d", "2026-01-31", null), a);
});

test("controllerScopeRoomIds: без своих проверяющих — весь документ (undefined)", () => {
  const cfg = {
    selectedRoomIds: ["r1", "r2"],
    verifierByRoomId: {},
    controlUserId: "c0",
    controlResponsibles: [],
  };
  assert.equal(controllerScopeRoomIds(cfg, "c0"), undefined);
});

test("controllerScopeRoomIds: свои проверяющие — каждому свои помещения", () => {
  const cfg = {
    selectedRoomIds: ["r1", "r2", "r3"],
    verifierByRoomId: { r1: ["v1", "c0"], r2: ["v2"] },
    controlUserId: "c0",
    controlResponsibles: [],
  };
  assert.deepEqual([...controllerScopeRoomIds(cfg, "v1")!], ["r1"]);
  assert.deepEqual([...controllerScopeRoomIds(cfg, "v2")!], ["r2"]);
  // Контролёр документа: r1 (назначен явно) + r3 (без своих проверяющих).
  assert.deepEqual([...controllerScopeRoomIds(cfg, "c0")!], ["r1", "r3"]);
  assert.deepEqual([...controllerScopeRoomIds(cfg, "nobody")!], []);
});
