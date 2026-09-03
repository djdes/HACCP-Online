import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";

import { splitOrderAmount } from "@/lib/partners/accruals";
import { referralRewardFor } from "@/lib/balance/constants";
import { normalizeReferralCode } from "@/lib/balance/referral";

/**
 * База реферальной награды считается из двух слагаемых: подписочной части
 * заказа и списанных баллов. Без второго слагаемого клиент, оплативший
 * подписку баллами, приносил бы рекомендателю ноль — хотя подписка продана.
 */
function referralBase(order: {
  amountRub: number;
  bundleConfig: Record<string, number> | null;
  pointsSpent: number;
}): number {
  return (
    splitOrderAmount({
      amountRub: new Prisma.Decimal(order.amountRub),
      bundleConfig: order.bundleConfig,
    }).subscriptionRub + order.pointsSpent
  );
}

test("база награды по чистой подписке — вся сумма заказа", () => {
  const base = referralBase({
    amountRub: 1990,
    bundleConfig: null,
    pointsSpent: 0,
  });
  assert.equal(base, 1990);
  assert.equal(referralRewardFor(base), 597);
});

test("оплата подписки баллами всё равно даёт награду рекомендателю", () => {
  // Клиент закрыл 1990 ₽ баллами: деньгами пришло 0, но подписка продана.
  const base = referralBase({
    amountRub: 0,
    bundleConfig: null,
    pointsSpent: 1990,
  });
  assert.equal(base, 1990);
  assert.equal(referralRewardFor(base), 597);
});

test("частичная оплата баллами: база — подписка целиком, не остаток", () => {
  const base = referralBase({
    amountRub: 1490,
    bundleConfig: null,
    pointsSpent: 500,
  });
  assert.equal(base, 1990);
  assert.equal(referralRewardFor(base), 597);
});

test("нормализация реферального кода", () => {
  assert.equal(normalizeReferralCode("abcd2345"), "ABCD2345");
  assert.equal(normalizeReferralCode("  ABCD2345  "), "ABCD2345");
  // Длина фиксирована — «почти код» не должен резолвиться в чужой.
  assert.equal(normalizeReferralCode("ABCD234"), null);
  assert.equal(normalizeReferralCode("ABCD23456"), null);
  assert.equal(normalizeReferralCode("ABCD-234"), null);
  assert.equal(normalizeReferralCode(""), null);
  assert.equal(normalizeReferralCode(null), null);
});
