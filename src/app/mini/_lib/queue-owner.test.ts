import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canSendQueuedEntry, decideQueueOwner } from "@/app/mini/_lib/queue-owner";

describe("decideQueueOwner", () => {
  it("отправляет запись её же автору", () => {
    assert.deepEqual(decideQueueOwner("user-a", "user-a"), { kind: "send" });
  });

  it("НЕ отправляет чужую запись — иначе журнал подпишется не тем", () => {
    // Тот самый сценарий: повар А заполнил без связи, сдал смену,
    // повар Б вошёл на том же телефоне, появилась сеть.
    assert.deepEqual(decideQueueOwner("user-a", "user-b"), {
      kind: "wait_owner",
    });
    assert.equal(canSendQueuedEntry("user-a", "user-b"), false);
  });

  it("НЕ отправляет запись без автора — угадывать нельзя", () => {
    // Такие остались в очереди с версии базы 1.
    for (const legacy of [null, undefined, ""]) {
      assert.deepEqual(decideQueueOwner(legacy, "user-b"), {
        kind: "wait_unknown_owner",
      });
      assert.equal(canSendQueuedEntry(legacy, "user-b"), false);
    }
  });

  it("без сессии не отправляет ничего", () => {
    for (const nobody of [null, undefined, ""]) {
      assert.deepEqual(decideQueueOwner("user-a", nobody), { kind: "no_session" });
      assert.equal(canSendQueuedEntry("user-a", nobody), false);
    }
  });

  it("отсутствие сессии важнее отсутствия автора", () => {
    // Иначе порядок проверок мог бы дать «жду автора» там, где на самом
    // деле в приложении вообще никого нет.
    assert.deepEqual(decideQueueOwner(null, null), { kind: "no_session" });
  });

  it("пустой автор не совпадает с пустым пользователем", () => {
    assert.notEqual(decideQueueOwner("", "").kind, "send");
  });
});
