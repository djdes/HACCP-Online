import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCompleted,
  applyReleased,
  type PoolLike,
  type PoolScopeLike,
} from "@/app/mini/_lib/task-pool-optimistic";

const POOL: PoolLike<PoolScopeLike> = {
  scopes: [
    {
      scopeKey: "hall",
      availability: "mine",
      claim: { id: "c1", status: "active" },
    },
    {
      scopeKey: "kitchen",
      availability: "taken",
      claim: { id: "c2", status: "active" },
    },
    { scopeKey: "bar", availability: "available", claim: null },
  ],
  myActive: { id: "c1" },
};

describe("applyCompleted", () => {
  it("своя задача становится «готово»", () => {
    const next = applyCompleted(POOL, "c1");
    assert.equal(next.scopes[0].availability, "completed");
    assert.equal(next.scopes[0].claim?.status, "completed");
  });

  it("снимает «я выполняю» — иначе все другие журналы остаются заперты", () => {
    // Самая дорогая ошибка этой фичи: подсказка «сначала заверши»
    // держалась бы на задаче, которую человек только что закрыл.
    assert.equal(applyCompleted(POOL, "c1").myActive, null);
  });

  it("чужие строки не трогает", () => {
    const next = applyCompleted(POOL, "c1");
    assert.deepEqual(next.scopes[1], POOL.scopes[1]);
    assert.deepEqual(next.scopes[2], POOL.scopes[2]);
  });

  it("незнакомый идентификатор ничего не ломает", () => {
    const next = applyCompleted(POOL, "нет-такого");
    assert.deepEqual(next.scopes, POOL.scopes);
    assert.deepEqual(next.myActive, POOL.myActive);
  });

  it("не меняет исходный объект", () => {
    // Откат после отказа сервера возможен только по сохранённому снимку.
    const before = JSON.stringify(POOL);
    applyCompleted(POOL, "c1");
    assert.equal(JSON.stringify(POOL), before);
  });
});

describe("applyReleased", () => {
  it("задача снова свободна для любого", () => {
    const next = applyReleased(POOL, "c1");
    assert.equal(next.scopes[0].availability, "available");
    assert.equal(next.scopes[0].claim, null);
    assert.equal(next.myActive, null);
  });
});
