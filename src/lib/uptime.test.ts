import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SAMPLES_PER_DAY, computeUptime } from "@/lib/uptime";

const now = new Date("2026-09-10T12:00:00.000Z");

describe("computeUptime", () => {
  it("без замеров — всё null", () => {
    const s = computeUptime([], now, 5);
    assert.equal(s.days.length, 5);
    assert.ok(s.days.every((d) => d.ratio === null));
    assert.equal(s.pct30, null);
  });
  it("прошлый день с полным набором замеров = 100%, с половиной = 50%; пропуски = простой; сегодня — по факту", () => {
    const yesterday = new Date("2026-09-09T00:00:00.000Z");
    const samples = [];
    for (let i = 0; i < SAMPLES_PER_DAY; i += 1) samples.push({ at: new Date(yesterday.getTime() + i * 5 * 60_000), ok: true });
    const twoDaysAgo = new Date("2026-09-08T00:00:00.000Z");
    for (let i = 0; i < SAMPLES_PER_DAY / 2; i += 1) samples.push({ at: new Date(twoDaysAgo.getTime() + i * 5 * 60_000), ok: true });
    samples.push({ at: new Date("2026-09-10T11:55:00.000Z"), ok: true }, { at: new Date("2026-09-10T11:50:00.000Z"), ok: false });
    const s = computeUptime(samples, now, 4);
    const byDate = Object.fromEntries(s.days.map((d) => [d.date, d.ratio]));
    assert.equal(byDate["2026-09-07"], null);
    assert.equal(byDate["2026-09-08"], 0.5);
    assert.equal(byDate["2026-09-09"], 1);
    assert.equal(byDate["2026-09-10"], 0.5);
    assert.equal(s.pct30, 66.7);
  });
});
