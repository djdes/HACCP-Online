import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FREE_MAX_USERS } from "@/lib/plan-limits";
import { EXTRA_USER_PRICE_RUB, SUBSCRIPTION_MAX_USERS } from "@/lib/plan-catalog";
import { pricingScaleRows, quoteSubscription } from "@/lib/subscription-pricing";

const BASE = 1990;

describe("quoteSubscription", () => {
  it("1 и 3 сотрудника — бесплатно, все суммы 0", () => {
    for (const n of [1, FREE_MAX_USERS]) {
      const q = quoteSubscription(n, BASE);
      assert.equal(q.isFree, true);
      assert.equal(q.baseRub, 0);
      assert.equal(q.extraEmployees, 0);
      assert.equal(q.extraRub, 0);
      assert.equal(q.monthlyRub, 0);
      assert.equal(q.yearlyRub, 0);
      assert.equal(q.tierLabel, "бесплатно");
    }
  });

  it("4 сотрудника — только подписка, без доплаты", () => {
    const q = quoteSubscription(FREE_MAX_USERS + 1, BASE);
    assert.equal(q.isFree, false);
    assert.equal(q.baseRub, BASE);
    assert.equal(q.extraEmployees, 0);
    assert.equal(q.extraRub, 0);
    assert.equal(q.monthlyRub, BASE);
    assert.equal(q.tierLabel, "подписка");
  });

  it("30 сотрудников — граница подписки, доплаты ещё нет", () => {
    const q = quoteSubscription(SUBSCRIPTION_MAX_USERS, BASE);
    assert.equal(q.monthlyRub, BASE);
    assert.equal(q.extraEmployees, 0);
    assert.equal(q.tierLabel, "подписка");
  });

  it("31 сотрудник — подписка + одна доплата", () => {
    const q = quoteSubscription(SUBSCRIPTION_MAX_USERS + 1, BASE);
    assert.equal(q.extraEmployees, 1);
    assert.equal(q.extraRub, EXTRA_USER_PRICE_RUB);
    assert.equal(q.monthlyRub, BASE + EXTRA_USER_PRICE_RUB);
    assert.equal(q.tierLabel, `подписка + 1 сверх ${SUBSCRIPTION_MAX_USERS}`);
  });

  it("35 сотрудников — подписка + 5 доплат, год = ×12 без скидки", () => {
    const q = quoteSubscription(SUBSCRIPTION_MAX_USERS + 5, BASE);
    assert.equal(q.extraEmployees, 5);
    assert.equal(q.extraRub, 5 * EXTRA_USER_PRICE_RUB);
    assert.equal(q.monthlyRub, BASE + 5 * EXTRA_USER_PRICE_RUB);
    assert.equal(q.yearlyRub, q.monthlyRub * 12);
    assert.equal(q.tierLabel, `подписка + 5 сверх ${SUBSCRIPTION_MAX_USERS}`);
  });

  it("цена подписки берётся у вызывающего, а не зашита в модуль", () => {
    const q = quoteSubscription(10, 2500);
    assert.equal(q.baseRub, 2500);
    assert.equal(q.monthlyRub, 2500);
  });

  it("0, отрицательные и NaN — бесплатно", () => {
    for (const n of [0, -5, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const q = quoteSubscription(n, BASE);
      assert.equal(q.isFree, true);
      assert.equal(q.employees, 0);
      assert.equal(q.monthlyRub, 0);
    }
  });

  it("дробное число сотрудников округляется вниз", () => {
    assert.equal(quoteSubscription(3.9, BASE).isFree, true);
    assert.equal(quoteSubscription(4.2, BASE).employees, 4);
  });
});

describe("pricingScaleRows", () => {
  it("три строки шкалы с константами модели", () => {
    const rows = pricingScaleRows(BASE);
    assert.equal(rows.length, 3);

    assert.equal(rows[0].range, `1–${FREE_MAX_USERS} сотрудников`);
    assert.equal(rows[0].price, "бесплатно");

    assert.equal(rows[1].range, `${FREE_MAX_USERS + 1}–${SUBSCRIPTION_MAX_USERS}`);
    assert.ok(rows[1].price.includes(BASE.toLocaleString("ru-RU")));
    assert.ok(rows[1].price.includes("за всю команду"));

    assert.equal(rows[2].range, `${SUBSCRIPTION_MAX_USERS + 1} и больше`);
    assert.ok(rows[2].price.includes(`+${EXTRA_USER_PRICE_RUB}`));
    assert.ok(rows[2].price.includes(`сверх ${SUBSCRIPTION_MAX_USERS}`));
  });
});
