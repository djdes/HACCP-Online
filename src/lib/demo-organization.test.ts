import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEMO_ORG_TTL_DAYS,
  demoDaysLeft,
  demoExpiresAtFrom,
  demoOrgName,
} from "@/lib/demo-organization.shared";

describe("demoOrgName", () => {
  it("берёт label сферы из анкеты", () => {
    assert.equal(demoOrgName("cafe"), "Демо — Кафе / Кофейня");
    assert.equal(demoOrgName("bakery"), "Демо — Пекарня");
  });

  it("незнакомая сфера → «Другое», а не пустое имя", () => {
    assert.equal(demoOrgName("???"), "Демо — Другое");
    assert.equal(demoOrgName(undefined), "Демо — Другое");
  });
});

describe("demoExpiresAtFrom / demoDaysLeft", () => {
  const now = new Date("2026-09-02T10:00:00Z");

  it("срок жизни — ровно DEMO_ORG_TTL_DAYS дней", () => {
    const expires = demoExpiresAtFrom(now);
    assert.equal(DEMO_ORG_TTL_DAYS, 7);
    assert.equal(expires.toISOString(), "2026-09-09T10:00:00.000Z");
  });

  it("дней осталось — округление вверх, в момент создания = TTL", () => {
    const expires = demoExpiresAtFrom(now);
    assert.equal(demoDaysLeft(expires, now), 7);
    assert.equal(demoDaysLeft(expires, new Date("2026-09-08T09:00:00Z")), 2);
    assert.equal(demoDaysLeft(expires, new Date("2026-09-09T09:59:00Z")), 1);
  });

  it("после истечения — 0, не отрицательное", () => {
    const expires = demoExpiresAtFrom(now);
    assert.equal(demoDaysLeft(expires, new Date("2026-09-20T00:00:00Z")), 0);
  });
});
