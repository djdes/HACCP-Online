import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LIVE_DOWN_THRESHOLD_MS, shouldShowLiveDown } from "@/lib/live-connection";

describe("shouldShowLiveDown", () => {
  const base = { online: true, visible: true, now: 1_000_000 };

  it("показывает только после минуты обрыва", () => {
    const downSince = base.now - LIVE_DOWN_THRESHOLD_MS + 1;
    assert.equal(shouldShowLiveDown({ ...base, status: "down", downSince }), false);
    assert.equal(
      shouldShowLiveDown({ ...base, status: "down", downSince: base.now - LIVE_DOWN_THRESHOLD_MS }),
      true
    );
  });

  it("отказ сервера (401) и намеренное закрытие — не обрыв", () => {
    const downSince = base.now - 10 * LIVE_DOWN_THRESHOLD_MS;
    assert.equal(shouldShowLiveDown({ ...base, status: "closed", downSince }), false);
    assert.equal(shouldShowLiveDown({ ...base, status: "idle", downSince }), false);
    assert.equal(shouldShowLiveDown({ ...base, status: "open", downSince }), false);
  });

  it("офлайн и скрытая вкладка молчат — у них свои индикаторы и своя логика", () => {
    const downSince = base.now - 10 * LIVE_DOWN_THRESHOLD_MS;
    assert.equal(shouldShowLiveDown({ ...base, status: "down", downSince, online: false }), false);
    assert.equal(shouldShowLiveDown({ ...base, status: "down", downSince, visible: false }), false);
  });

  it("без отметки начала обрыва не показывает", () => {
    assert.equal(shouldShowLiveDown({ ...base, status: "down", downSince: null }), false);
  });

  it("порог можно переопределить", () => {
    assert.equal(
      shouldShowLiveDown({ ...base, status: "down", downSince: base.now - 5, thresholdMs: 5 }),
      true
    );
  });
});
