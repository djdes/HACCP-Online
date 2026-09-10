import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeNps, shouldAskNps } from "@/lib/nps";

const now = new Date("2026-09-10T12:00:00.000Z");

describe("shouldAskNps", () => {
  it("не раньше двух недель после регистрации и не чаще раза в 90 дней", () => {
    assert.equal(shouldAskNps({ orgCreatedAt: new Date("2026-09-01"), npsAskedAt: null, now }), false);
    assert.equal(shouldAskNps({ orgCreatedAt: new Date("2026-06-01"), npsAskedAt: null, now }), true);
    assert.equal(shouldAskNps({ orgCreatedAt: new Date("2026-06-01"), npsAskedAt: new Date("2026-08-01"), now }), false);
    assert.equal(shouldAskNps({ orgCreatedAt: new Date("2026-06-01"), npsAskedAt: new Date("2026-05-01"), now }), true);
  });
});

describe("computeNps", () => {
  it("промоутеры минус критики в процентах", () => {
    assert.deepEqual(computeNps([10, 9, 8, 7, 6, 3]), { total: 6, promoters: 2, passives: 2, detractors: 2, nps: 0, average: 7.2 });
    assert.equal(computeNps([10, 10, 9]).nps, 100);
    assert.equal(computeNps([]).nps, null);
  });
});
