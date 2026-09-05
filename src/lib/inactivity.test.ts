import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INACTIVITY_PAUSE_DAYS, decideInactivity } from "./inactivity";

const D = (iso: string) => new Date(iso);
const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const NOW = D("2026-09-05T07:00:00.000Z");

function base(overrides: Partial<Parameters<typeof decideInactivity>[0]> = {}) {
  return decideInactivity({
    now: NOW,
    lastActivityAt: daysAgo(NOW, 10),
    createdAt: daysAgo(NOW, 400),
    warnedStage: null,
    warnedForActivityAt: null,
    ...overrides,
  });
}

describe("decideInactivity", () => {
  it("does nothing while more than 30 days remain", () => {
    const d = base({ lastActivityAt: daysAgo(NOW, 10) });
    assert.equal(d.action, "none");
    assert.equal(d.action === "none" && d.daysLeft, INACTIVITY_PAUSE_DAYS - 10);
  });

  it("warns at the 30-day stage exactly once for the same activity", () => {
    const last = daysAgo(NOW, 72); // 28 days left
    const first = base({ lastActivityAt: last });
    assert.deepEqual(first.action === "warn" && first.stage, 30);
    const again = base({ lastActivityAt: last, warnedStage: 30, warnedForActivityAt: last });
    assert.equal(again.action, "none");
  });

  it("moves to the next stage when its threshold is crossed", () => {
    const last = daysAgo(NOW, 87); // 13 days left
    const d = base({ lastActivityAt: last, warnedStage: 30, warnedForActivityAt: last });
    assert.equal(d.action === "warn" && d.stage, 14);
  });

  it("sends only the current stage when earlier ones were skipped", () => {
    const last = daysAgo(NOW, 98); // 2 days left, never warned
    const d = base({ lastActivityAt: last });
    assert.equal(d.action === "warn" && d.stage, 2);
  });

  it("restarts the series after new activity", () => {
    const oldActivity = daysAgo(NOW, 90);
    const fresh = daysAgo(NOW, 71); // 29 days left → stage 30 again
    const d = base({ lastActivityAt: fresh, warnedStage: 7, warnedForActivityAt: oldActivity });
    assert.equal(d.action === "warn" && d.stage, 30);
  });

  it("pauses at 100 days", () => {
    const d = base({ lastActivityAt: daysAgo(NOW, 100) });
    assert.equal(d.action, "pause");
  });

  it("uses createdAt when the organization never wrote anything", () => {
    const d = base({ lastActivityAt: null, createdAt: daysAgo(NOW, 95) });
    assert.equal(d.action === "warn" && d.stage, 7);
    const paused = base({ lastActivityAt: null, createdAt: daysAgo(NOW, 101) });
    assert.equal(paused.action, "pause");
  });
});
