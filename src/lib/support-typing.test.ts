import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TYPING_PING_MS,
  TYPING_TTL_MS,
  acceptTypingPing,
  createTypingPinger,
  isTypingFresh,
} from "@/lib/support-typing";

describe("isTypingFresh", () => {
  it("свежо, пока не прошёл TTL после последнего пинга", () => {
    assert.equal(isTypingFresh(1000, 1000 + TYPING_TTL_MS - 1), true);
    assert.equal(isTypingFresh(1000, 1000 + TYPING_TTL_MS), false);
    assert.equal(isTypingFresh(null, 5000), false);
    assert.equal(isTypingFresh(undefined, 5000), false);
  });

  it("TTL больше интервала пинга — индикатор не мигает между пингами", () => {
    assert.ok(TYPING_TTL_MS > TYPING_PING_MS);
  });
});

describe("createTypingPinger", () => {
  it("шлёт не чаще раза в интервал, первый пинг сразу", () => {
    let now = 10_000;
    let sent = 0;
    const ping = createTypingPinger(() => { sent += 1; }, 2500, () => now);
    ping();
    ping();
    now += 1000;
    ping();
    assert.equal(sent, 1);
    now += 1500;
    ping();
    assert.equal(sent, 2);
  });
});

describe("acceptTypingPing", () => {
  it("принимает не чаще раза в интервал на ключ, ключи независимы", () => {
    const seen = new Map<string, number>();
    assert.equal(acceptTypingPing(seen, "u1", 1000), true);
    assert.equal(acceptTypingPing(seen, "u1", 1500), false);
    assert.equal(acceptTypingPing(seen, "u2", 1500), true);
    assert.equal(acceptTypingPing(seen, "u1", 1000 + TYPING_PING_MS), true);
  });

  it("чистит старые ключи, когда карта разрастается", () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 5001; i += 1) seen.set(`old-${i}`, 0);
    assert.equal(acceptTypingPing(seen, "fresh", 120_000), true);
    assert.ok(seen.size < 10);
    assert.equal(seen.has("fresh"), true);
  });
});
