import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { liveEventMatches } from "@/lib/live-refetch-match";

const at = "2026-09-09T10:00:00.000Z";

describe("liveEventMatches", () => {
  it("reconnect касается всех экранов", () => {
    assert.equal(liveEventMatches({ type: "reconnect", at }, { types: ["support"] }), true);
  });

  it("чужой тип события не трогает экран", () => {
    assert.equal(liveEventMatches({ type: "balance", at }, { types: ["journal"] }), false);
    assert.equal(liveEventMatches({ type: "support", kind: "message", at }, { types: ["support"] }), true);
  });

  it("журнал: фильтр по кодам, событие без кодов — про всех", () => {
    const changed = (codes: unknown) => ({ type: "journal" as const, kind: "changed", at, data: { codes } });
    const hygieneOnly = { types: ["journal" as const], codes: ["hygiene"] };
    assert.equal(liveEventMatches(changed(["hygiene", "cleaning"]), hygieneOnly), true);
    assert.equal(liveEventMatches(changed(["cleaning"]), hygieneOnly), false);
    assert.equal(liveEventMatches(changed([]), hygieneOnly), true);
    assert.equal(liveEventMatches(changed(undefined), hygieneOnly), true);
    assert.equal(liveEventMatches(changed([42]), hygieneOnly), true);
  });

  it("без фильтра по кодам любой журнал подходит", () => {
    assert.equal(
      liveEventMatches({ type: "journal", kind: "changed", at, data: { codes: ["x"] } }, { types: ["journal"] }),
      true
    );
  });
});
