import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FINE_ARTICLES, sumFines } from "@/lib/seo/fines";

describe("sumFines", () => {
  it("складывает диапазоны и помечает приостановление", () => {
    const t = sumFines(["6.6", "14.43-1"]);
    assert.deepEqual(t.legal, [130_000, 350_000]);
    assert.deepEqual(t.ip, [25_000, 40_000]);
    assert.equal(t.suspension, true);
    assert.equal(t.count, 2);
  });
  it("ничего не выбрано — нули", () => {
    assert.deepEqual(sumFines([]), { ip: [0, 0], legal: [0, 0], official: [0, 0], suspension: false, count: 0 });
  });
  it("у каждой статьи верхняя граница не меньше нижней", () => {
    for (const a of FINE_ARTICLES) {
      assert.ok(a.ip[1] >= a.ip[0] && a.legal[1] >= a.legal[0] && a.official[1] >= a.official[0], a.id);
    }
  });
});
