import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatSseComment,
  formatSseEvent,
  publishToOrganization,
  publishToUser,
  publishToUsers,
  subscribe,
  subscriberCount,
} from "@/lib/live-events";

/** Подписчик, который запоминает кадры и умеет «умереть». */
function fake(userId: string, organizationId: string | null = "org-1") {
  const frames: string[] = [];
  let alive = true;
  return {
    frames,
    kill: () => {
      alive = false;
    },
    subscriber: {
      userId,
      organizationId,
      send: (frame: string) => {
        if (!alive) return false;
        frames.push(frame);
        return true;
      },
    },
  };
}

describe("live-events", () => {
  it("событие доходит до всех вкладок одного человека и не доходит до чужих", () => {
    const a1 = fake("u1");
    const a2 = fake("u1");
    const b = fake("u2");
    const off = [a1, a2, b].map((f) => subscribe(f.subscriber));

    const delivered = publishToUser("u1", { type: "notification", kind: "support.reply" });

    assert.equal(delivered, 2);
    assert.equal(a1.frames.length, 1);
    assert.equal(a2.frames.length, 1);
    assert.equal(b.frames.length, 0, "чужому человеку — ничего");
    off.forEach((fn) => fn());
  });

  it("событие организации получают все, кто на неё смотрит", () => {
    const m1 = fake("u1", "org-1");
    const m2 = fake("u2", "org-1");
    const other = fake("u3", "org-2");
    const off = [m1, m2, other].map((f) => subscribe(f.subscriber));

    const delivered = publishToOrganization("org-1", {
      type: "balance",
      data: { amount: 500 },
    });

    assert.equal(delivered, 2);
    assert.equal(other.frames.length, 0, "другая организация не видит чужой баланс");
    off.forEach((fn) => fn());
  });

  it("мёртвое соединение выкидывается при первой же доставке", () => {
    // Иначе список рос бы до перезапуска процесса, а каждый publish
    // гонял бы по трупам.
    const dead = fake("u1");
    const live = fake("u1");
    const off = [dead, live].map((f) => subscribe(f.subscriber));
    const before = subscriberCount();
    dead.kill();

    const delivered = publishToUser("u1", { type: "notification" });

    assert.equal(delivered, 1);
    assert.equal(subscriberCount(), before - 1);
    off.forEach((fn) => fn());
  });

  it("отписка убирает подписчика", () => {
    const f = fake("u9");
    const before = subscriberCount();
    const off = subscribe(f.subscriber);
    assert.equal(subscriberCount(), before + 1);
    off();
    assert.equal(subscriberCount(), before);
    publishToUser("u9", { type: "notification" });
    assert.equal(f.frames.length, 0);
  });

  it("никого нет — доставлено ноль, ошибки нет", () => {
    assert.equal(publishToUser("никого", { type: "notification" }), 0);
  });
});

describe("кадры SSE", () => {
  it("событие: имя, JSON, пустая строка в конце", () => {
    const frame = formatSseEvent({
      type: "balance",
      at: "2026-09-09T00:00:00.000Z",
      data: { amount: 500 },
    });
    assert.match(frame, /^event: balance\n/);
    assert.match(frame, /\ndata: \{.*"amount":500.*\}\n\n$/);
    // JSON в одной строке — иначе `data:` разъехался бы.
    assert.equal(frame.split("data: ").length, 2);
  });

  it("перевод строки внутри данных не ломает кадр", () => {
    const frame = formatSseEvent({
      type: "notification",
      at: "x",
      data: { title: "две\nстроки" },
    });
    // Ровно одна строка data и ровно один терминатор.
    assert.equal((frame.match(/\ndata: /g) ?? []).length, 1);
    assert.ok(frame.endsWith("\n\n"));
  });

  it("комментарий не начинается с имени поля", () => {
    const frame = formatSseComment("ping");
    assert.equal(frame, ": ping\n\n");
    assert.equal(formatSseComment("a\nb"), ": a b\n\n");
  });
});

describe("publishToUsers", () => {
  it("доставляет каждому из списка один раз, дубли id не удваивают", () => {
    const got: string[] = [];
    const unsubscribeA = subscribe({
      userId: "a",
      organizationId: null,
      send: () => {
        got.push("a");
        return true;
      },
    });
    const unsubscribeB = subscribe({
      userId: "b",
      organizationId: null,
      send: () => {
        got.push("b");
        return true;
      },
    });
    const unsubscribeC = subscribe({
      userId: "c",
      organizationId: null,
      send: () => {
        got.push("c");
        return true;
      },
    });

    const delivered = publishToUsers(["a", "b", "a"], { type: "support", kind: "message" });

    assert.equal(delivered, 2);
    assert.deepEqual(got.sort(), ["a", "b"]);
    unsubscribeA();
    unsubscribeB();
    unsubscribeC();
  });
});
