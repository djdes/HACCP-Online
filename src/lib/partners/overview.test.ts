import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysKey,
  aggregateOverview,
  filterOverviewClients,
  lastDayKeys,
  medBookExpiresWithin,
  type OverviewClientInput,
} from "./overview";

const NOW = new Date("2026-09-02T09:00:00.000Z");

function client(id: string, extra: Partial<OverviewClientInput> = {}): OverviewClientInput {
  return {
    partnerClientId: `pc-${id}`,
    organizationId: id,
    name: `Орг ${id}`,
    type: "cafe",
    plan: "pro",
    subscriptionEnd: null,
    timezone: "Europe/Moscow",
    attachedAt: new Date("2026-08-01T00:00:00.000Z"),
    detachedAt: null,
    accessLevel: "view",
    clientHidesBranding: false,
    ...extra,
  };
}

describe("partner overview aggregation", () => {
  it("lastDayKeys returns 7 keys ending today", () => {
    const keys = lastDayKeys(NOW, 7);
    assert.equal(keys.length, 7);
    assert.equal(keys[0], "2026-09-02");
    assert.equal(keys[6], "2026-08-27");
    assert.equal(addDaysKey("2026-09-02", 30), "2026-10-02");
  });

  it("active = entries in each of the last 7 days; gaps make the client inactive", () => {
    const docA = { id: "docA", organizationId: "A", code: "hygiene", dateFrom: new Date("2026-09-01"), dateTo: new Date("2026-09-30") };
    const docB = { id: "docB", organizationId: "B", code: "hygiene", dateFrom: new Date("2026-09-01"), dateTo: new Date("2026-09-30") };
    const fullWeek = lastDayKeys(NOW, 7).map((k) => ({ documentId: "docA", date: new Date(`${k}T00:00:00.000Z`) }));
    const withGap = fullWeek.slice(1).map((r) => ({ ...r, documentId: "docB" }));
    const res = aggregateOverview({
      now: NOW,
      clients: [client("A"), client("B")],
      docs: [docA, docB],
      docDays: [...fullWeek, ...withGap],
      fieldActivity: [],
      medBooks: [],
    });
    const a = res.clients.find((c) => c.organizationId === "A")!;
    const b = res.clients.find((c) => c.organizationId === "B")!;
    assert.equal(a.activeLast7Days, true);
    assert.equal(b.activeLast7Days, false);
    assert.equal(a.overdueToday, 0);
    assert.equal(b.overdueToday, 1, "docB has no entry today");
    assert.deepEqual(res.tiles, { clientsTotal: 2, activeLast7Days: 1, overdueToday: 1, medBooksExpiring30: 0 });
  });

  it("field entries count towards activity and lastActivityAt", () => {
    const days = lastDayKeys(NOW, 7);
    const res = aggregateOverview({
      now: NOW,
      clients: [client("A")],
      docs: [],
      docDays: [],
      fieldActivity: [{ organizationId: "A", lastAt: new Date("2026-09-02T08:00:00.000Z"), days }],
      medBooks: [],
    });
    assert.equal(res.clients[0].activeLast7Days, true);
    assert.equal(res.clients[0].lastActivityAt, "2026-09-02T08:00:00.000Z");
  });

  it("documents outside their date range are not overdue; config-based journals are ignored", () => {
    const expired = { id: "d1", organizationId: "A", code: "hygiene", dateFrom: new Date("2026-07-01"), dateTo: new Date("2026-07-31") };
    const cleaning = { id: "d2", organizationId: "A", code: "cleaning", dateFrom: new Date("2026-09-01"), dateTo: new Date("2026-09-30") };
    const res = aggregateOverview({ now: NOW, clients: [client("A")], docs: [expired, cleaning], docDays: [], fieldActivity: [], medBooks: [] });
    assert.equal(res.clients[0].overdueToday, 0);
  });

  it("med books expiring within 30 days (or already expired) are counted per client", () => {
    const soon = { examinations: { therapist: { date: "2025-09-10", expiryDate: "2026-09-20" } }, vaccinations: {} };
    const far = { examinations: { therapist: { date: "2026-06-01", expiryDate: "2027-06-01" } }, vaccinations: {} };
    const expired = { examinations: { therapist: { date: "2025-01-01", expiryDate: "2026-01-01" } }, vaccinations: {} };
    assert.equal(medBookExpiresWithin(soon, "2026-09-02", 30), true);
    assert.equal(medBookExpiresWithin(far, "2026-09-02", 30), false);
    assert.equal(medBookExpiresWithin(expired, "2026-09-02", 30), true);
    assert.equal(medBookExpiresWithin({ examinations: { t: { date: null, expiryDate: null } } }, "2026-09-02", 30), false);

    const res = aggregateOverview({
      now: NOW,
      clients: [client("A"), client("B")],
      docs: [],
      docDays: [],
      fieldActivity: [],
      medBooks: [
        { organizationId: "A", data: soon },
        { organizationId: "A", data: far },
        { organizationId: "B", data: far },
      ],
    });
    assert.equal(res.clients.find((c) => c.organizationId === "A")!.medBooksExpiring, 1);
    assert.equal(res.tiles.medBooksExpiring30, 1);
  });

  it("detached clients are kept as history but excluded from tiles and sorted last", () => {
    const res = aggregateOverview({
      now: NOW,
      clients: [client("Z", { detachedAt: new Date("2026-08-20"), name: "А первая по алфавиту" }), client("A", { name: "Я последняя" })],
      docs: [],
      docDays: [],
      fieldActivity: [],
      medBooks: [],
    });
    assert.equal(res.tiles.clientsTotal, 1);
    assert.equal(res.clients[0].organizationId, "A");
    assert.equal(res.clients[1].detachedAt !== null, true);
    assert.equal(filterOverviewClients(res.clients, "detached").length, 1);
    assert.equal(filterOverviewClients(res.clients, "all").length, 1);
    assert.equal(filterOverviewClients(res.clients, "inactive").length, 1);
  });
});
