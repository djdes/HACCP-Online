import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeDiscountRub,
  describeDiscount,
  isValidPromoCodeFormat,
  normalizePromoCode,
  validatePromo,
  type PromoRule,
} from "@/lib/promo/rules";

const base: PromoRule = {
  code: "WELCOME10",
  kind: "percent",
  value: 10,
  active: true,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  newClientsOnly: false,
};
const now = new Date("2026-09-09T12:00:00.000Z");
const ctx = { now, paidUses: 0, organizationHasPaidOrders: false };

describe("normalizePromoCode", () => {
  it("верхний регистр, без пробелов", () => {
    assert.equal(normalizePromoCode("  welcome 10 "), "WELCOME10");
    assert.equal(isValidPromoCodeFormat("WELCOME10"), true);
    assert.equal(isValidPromoCodeFormat("AB"), false);
    assert.equal(isValidPromoCodeFormat("ПРИВЕТ"), false);
  });
});

describe("validatePromo", () => {
  it("рабочий код проходит", () => {
    assert.deepEqual(validatePromo(base, ctx), { ok: true });
  });
  it("нет / отключён / рано / поздно / исчерпан / только новым", () => {
    assert.equal((validatePromo(null, ctx) as { reason: string }).reason, "not-found");
    assert.equal((validatePromo({ ...base, active: false }, ctx) as { reason: string }).reason, "inactive");
    assert.equal((validatePromo({ ...base, startsAt: new Date("2026-10-01") }, ctx) as { reason: string }).reason, "not-started");
    assert.equal((validatePromo({ ...base, endsAt: new Date("2026-09-01") }, ctx) as { reason: string }).reason, "expired");
    assert.equal((validatePromo({ ...base, maxUses: 3 }, { ...ctx, paidUses: 3 }) as { reason: string }).reason, "exhausted");
    assert.equal((validatePromo({ ...base, newClientsOnly: true }, { ...ctx, organizationHasPaidOrders: true }) as { reason: string }).reason, "new-clients-only");
    assert.deepEqual(validatePromo({ ...base, newClientsOnly: true }, ctx), { ok: true });
  });
});

describe("computeDiscountRub", () => {
  it("процент от подписки, целые рубли, не больше цены", () => {
    assert.equal(computeDiscountRub({ kind: "percent", value: 10 }, 1990), 199);
    assert.equal(computeDiscountRub({ kind: "percent", value: 100 }, 1990), 1990);
    assert.equal(computeDiscountRub({ kind: "percent", value: 150 }, 1990), 1990);
    assert.equal(computeDiscountRub({ kind: "fixed", value: 500 }, 1990), 500);
    assert.equal(computeDiscountRub({ kind: "fixed", value: 5000 }, 1990), 1990);
    assert.equal(computeDiscountRub({ kind: "fixed", value: 500 }, 0), 0);
  });
  it("подпись скидки", () => {
    assert.equal(describeDiscount({ kind: "percent", value: 10 }), "−10 %");
    assert.equal(describeDiscount({ kind: "fixed", value: 1500 }).replace(/[\u202f\u00a0]/g, " "), "−1 500 ₽");
  });
});
