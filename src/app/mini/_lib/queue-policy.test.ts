import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideQueueOutcome,
  retryDelayMs,
} from "@/app/mini/_lib/queue-policy";

describe("decideQueueOutcome", () => {
  it("создано — убираем из очереди", () => {
    assert.deepEqual(decideQueueOutcome({ kind: "http", status: 201 }), {
      kind: "done",
    });
    // Повтор с тем же ключом идемпотентности: сервер отдаёт прежний
    // ответ 201 или 200, второй записи не появляется.
    assert.deepEqual(decideQueueOutcome({ kind: "http", status: 200 }), {
      kind: "done",
    });
  });

  it("нет сети — оставляем", () => {
    assert.deepEqual(decideQueueOutcome({ kind: "network" }), { kind: "retry" });
  });

  it("409 «уже сохраняется» — оставляем, а не считаем отправленным", () => {
    // Обычно это наша же прошлая попытка и запись появится. Но бронь
    // могла остаться от процесса, который умер, не создав запись, —
    // удалив здесь, мы потеряли бы работу человека навсегда.
    assert.deepEqual(decideQueueOutcome({ kind: "http", status: 409 }), {
      kind: "retry",
    });
  });

  it("сессия протухла — оставляем до следующего входа", () => {
    for (const status of [401, 403]) {
      assert.deepEqual(
        decideQueueOutcome({ kind: "http", status }),
        { kind: "retry" },
        `status ${status}`,
      );
    }
  });

  it("сервер просит подождать — оставляем", () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      assert.deepEqual(
        decideQueueOutcome({ kind: "http", status }),
        { kind: "retry" },
        `status ${status}`,
      );
    }
  });

  it("данные не пройдут никогда — сообщаем, а не молчим", () => {
    // Повторять бессмысленно, но и удалить втихую нельзя: человек
    // считает, что запись сделана.
    for (const status of [400, 404, 413, 422]) {
      assert.deepEqual(
        decideQueueOutcome({ kind: "http", status }),
        { kind: "rejected" },
        `status ${status}`,
      );
    }
  });
});

describe("retryDelayMs", () => {
  it("растёт с попытками", () => {
    assert.ok(retryDelayMs(1) < retryDelayMs(3));
  });

  it("упирается в потолок — смена не должна ждать полчаса", () => {
    assert.equal(retryDelayMs(50), 5 * 60_000);
    assert.ok(Number.isFinite(retryDelayMs(1000)));
  });

  it("нулевая попытка не даёт отрицательной паузы", () => {
    assert.ok(retryDelayMs(0) > 0);
  });
});
