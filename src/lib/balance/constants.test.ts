import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERRAL_COOKIE,
  formatPoints,
  pointsToSpend,
  readCookie,
  referralRewardFor,
  reviewKindFromMime,
  reviewRewardFor,
} from "@/lib/balance/constants";

test("списание баллов ограничено ценой тарифа, а не суммой заказа", () => {
  // Заказ «подписка 1990 + железо 12000», на балансе 5000: списать можно
  // только подписочную часть — железо это физический товар.
  assert.equal(
    pointsToSpend({ balanceRub: 5000, subscriptionRub: 1990, usePoints: true }),
    1990,
  );
});

test("списание баллов ограничено балансом", () => {
  assert.equal(
    pointsToSpend({ balanceRub: 500, subscriptionRub: 1990, usePoints: true }),
    500,
  );
});

test("тумблер выключен — баллы не списываются", () => {
  assert.equal(
    pointsToSpend({ balanceRub: 5000, subscriptionRub: 1990, usePoints: false }),
    0,
  );
});

test("отрицательный баланс не превращается в начисление", () => {
  assert.equal(
    pointsToSpend({ balanceRub: -100, subscriptionRub: 1990, usePoints: true }),
    0,
  );
});

test("реферальная награда — 30 % с округлением до рубля", () => {
  assert.equal(referralRewardFor(1990), 597);
  assert.equal(referralRewardFor(0), 0);
  assert.equal(referralRewardFor(-100), 0);
  assert.equal(referralRewardFor(1495), 449); // 448.5 → 449
});

test("вид отзыва определяется по MIME вложения", () => {
  assert.equal(reviewKindFromMime(null), "text");
  assert.equal(reviewKindFromMime("image/jpeg"), "photo");
  assert.equal(reviewKindFromMime("image/png"), "photo");
  assert.equal(reviewKindFromMime("video/mp4"), "video");
  assert.equal(reviewKindFromMime("video/quicktime"), "video");
  // HEIC браузеры на лендинге не рисуют — отклоняем на входе.
  assert.equal(reviewKindFromMime("image/heic"), null);
  assert.equal(reviewKindFromMime("application/pdf"), null);
});

test("MIME с параметрами и в верхнем регистре распознаётся", () => {
  assert.equal(reviewKindFromMime("IMAGE/JPEG; charset=binary"), "photo");
});

test("тарифы отзывов", () => {
  assert.equal(reviewRewardFor("text"), 300);
  assert.equal(reviewRewardFor("photo"), 750);
  assert.equal(reviewRewardFor("video"), 1990);
});

test("формат суммы баллов — как в остальном кабинете", () => {
  assert.equal(formatPoints(1490).replace(/ /g, " "), "1 490 ₽");
});

test("readCookie достаёт реферальную метку из заголовка", () => {
  const request = new Request("https://wesetup.ru/order", {
    headers: { cookie: `theme=dark; ${REFERRAL_COOKIE}=ABCD2345; other=1` },
  });
  assert.equal(readCookie(request, REFERRAL_COOKIE), "ABCD2345");
  assert.equal(readCookie(request, "missing"), null);
});

test("readCookie на запросе без cookie возвращает null", () => {
  const request = new Request("https://wesetup.ru/order");
  assert.equal(readCookie(request, REFERRAL_COOKIE), null);
});
