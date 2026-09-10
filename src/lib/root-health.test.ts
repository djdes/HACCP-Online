import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { riskFlags } from "@/lib/root-health";

const now = new Date("2026-09-10T12:00:00.000Z");
const base = {
  id: "o",
  name: "Кафе",
  createdAt: new Date("2026-06-01"),
  subscriptionPlan: "paid",
  subscriptionEnd: new Date("2026-12-01"),
  lastEntryAt: new Date("2026-09-09"),
  openIncidents: 0,
  managersWithTelegram: 1,
  activeUsers: 5,
};

describe("riskFlags", () => {
  it("здоровая организация — без флагов", () => {
    assert.deepEqual(riskFlags(base, now), []);
  });
  it("флаги: старые записи, подписка, отклонения, Telegram, один пользователь", () => {
    const flags = riskFlags({ ...base, lastEntryAt: new Date("2026-08-01"), subscriptionEnd: new Date("2026-09-12"), openIncidents: 2, managersWithTelegram: 0, activeUsers: 1 }, now);
    assert.deepEqual(flags.map((f) => f.key), ["no-entries", "subscription", "incidents", "no-telegram", "solo"]);
  });
  it("новая организация без записей: только после трёх дней; бесплатный тариф не считается", () => {
    assert.deepEqual(riskFlags({ ...base, createdAt: new Date("2026-09-09"), lastEntryAt: null }, now), []);
    assert.equal(riskFlags({ ...base, createdAt: new Date("2026-09-01"), lastEntryAt: null }, now)[0]?.key, "never-started");
    assert.deepEqual(riskFlags({ ...base, subscriptionPlan: "free", subscriptionEnd: new Date("2026-09-11") }, now), []);
  });
});
