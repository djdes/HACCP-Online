import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAnnouncementActive,
  normalizeStatus,
  serviceState,
  type Announcement,
  type Incident,
} from "@/lib/platform-status";

const now = new Date("2026-09-10T10:00:00.000Z");
const base: Announcement = {
  id: "a1",
  kind: "maintenance",
  text: "Плановые работы сегодня в 03:00",
  link: null,
  startsAt: null,
  endsAt: null,
  active: true,
  updatedAt: now.toISOString(),
};

describe("isAnnouncementActive", () => {
  it("включён и в окне — показываем; выключен, пуст, рано или поздно — нет", () => {
    assert.equal(isAnnouncementActive(base, now), true);
    assert.equal(isAnnouncementActive({ ...base, active: false }, now), false);
    assert.equal(isAnnouncementActive({ ...base, text: "  " }, now), false);
    assert.equal(isAnnouncementActive({ ...base, startsAt: "2026-09-11T00:00:00.000Z" }, now), false);
    assert.equal(isAnnouncementActive({ ...base, endsAt: "2026-09-09T00:00:00.000Z" }, now), false);
    assert.equal(isAnnouncementActive({ ...base, startsAt: "2026-09-10T09:00:00.000Z", endsAt: "2026-09-10T11:00:00.000Z" }, now), true);
    assert.equal(isAnnouncementActive(null, now), false);
  });
});

describe("serviceState", () => {
  const open = (kind: Incident["kind"]): Incident => ({ id: kind, kind, title: "x", note: null, startedAt: now.toISOString(), resolvedAt: null });
  it("инцидент важнее работ, закрытые не считаются, база важнее всего", () => {
    assert.equal(serviceState([]), "operational");
    assert.equal(serviceState([open("maintenance")]), "maintenance");
    assert.equal(serviceState([open("maintenance"), open("incident")]), "degraded");
    assert.equal(serviceState([{ ...open("incident"), resolvedAt: now.toISOString() }]), "operational");
    assert.equal(serviceState([], false), "degraded");
  });
});

describe("normalizeStatus", () => {
  it("мусор не ломает, лишнее отбрасывается", () => {
    const s = normalizeStatus({ announcement: { text: "hi", kind: "weird", active: true }, incidents: [{ id: "1", title: "t", startedAt: "2026-09-10T00:00:00.000Z" }, { nope: true }] });
    assert.equal(s.announcement?.kind, "info");
    assert.equal(s.announcement?.id, "announcement");
    assert.equal(s.incidents.length, 1);
    assert.equal(s.incidents[0].kind, "incident");
    assert.deepEqual(normalizeStatus(null), { announcement: null, incidents: [] });
  });
});
