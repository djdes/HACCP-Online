import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEMO_ORG_TTL_DAYS,
  demoDaysLeft,
  demoExpiresAtFrom,
  demoOrgName,
} from "@/lib/demo-organization.shared";
import { getDemoRoster } from "@/lib/demo-organization-roster";
import { getOnboardingPreset } from "@/lib/onboarding-presets";

describe("getDemoRoster", () => {
  for (const type of ["restaurant", "bakery", "meat", "other"]) {
    it(`${type}: каждая должность есть в пресете и даёт доступ к гигиене`, () => {
      const preset = getOnboardingPreset(type);
      const roster = getDemoRoster(type);
      for (const person of roster.people) {
        const position = preset.positions.find((p) => p.name === person.position);
        assert.ok(position, `${person.name}: должность «${person.position}» не в пресете ${type}`);
        assert.ok(
          position.journalCodes.includes("hygiene"),
          `${person.position}: нет доступа к гигиеническому журналу`
        );
      }
    });

    it(`${type}: телефоны и ФИО уникальны, есть управляющий и уборщик`, () => {
      const roster = getDemoRoster(type);
      const phones = new Set(roster.people.map((p) => p.phone));
      const names = new Set(roster.people.map((p) => p.name));
      assert.equal(phones.size, roster.people.length);
      assert.equal(names.size, roster.people.length);
      assert.ok(roster.people.some((p) => p.role === "manager"));
      assert.ok(roster.people.some((p) => p.position === "Уборщик"));
      assert.ok(roster.rooms.length >= 3);
      assert.ok(roster.areas.some((a) => a.equipment.some((e) => e.tempMax < 0)));
    });
  }
});

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
