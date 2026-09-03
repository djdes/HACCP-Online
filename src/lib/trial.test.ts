/**
 * Тестовый период: статус по плану/датам и решение о дневном лимите.
 * Запуск: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  TRIAL_DAYS,
  TRIAL_LIMITS,
  decideTrialWrite,
  formatDaysRu,
  getTrialStatus,
  trialDaysLeftLabel,
} from "@/lib/trial";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-03T10:00:00.000Z");

test("trial с subscriptionEnd в будущем — идёт, daysLeft округляется вверх", () => {
  const status = getTrialStatus(
    {
      subscriptionPlan: "trial",
      subscriptionEnd: new Date(now.getTime() + 8.5 * DAY),
      createdAt: new Date(now.getTime() - 5.5 * DAY),
    },
    now
  );
  assert.equal(status.phase, "trial");
  assert.equal(status.limited, true);
  assert.equal(status.daysLeft, 9);
  assert.equal(status.dayNumber, 6);
  assert.equal(trialDaysLeftLabel(status), "осталось 9 дней");
});

test("trial без subscriptionEnd — считаем от createdAt + TRIAL_DAYS", () => {
  const createdAt = new Date(now.getTime() - 2 * DAY);
  const status = getTrialStatus(
    { subscriptionPlan: "trial", subscriptionEnd: null, createdAt },
    now
  );
  assert.equal(status.phase, "trial");
  assert.equal(status.endsAt?.getTime(), createdAt.getTime() + TRIAL_DAYS * DAY);
  assert.equal(status.daysLeft, TRIAL_DAYS - 2);
});

test("15-й день — expired: daysLeft 0, dayNumber 15, лимиты действуют", () => {
  const createdAt = new Date(now.getTime() - 14 * DAY - 60_000);
  const status = getTrialStatus(
    { subscriptionPlan: "trial", subscriptionEnd: undefined, createdAt },
    now
  );
  assert.equal(status.phase, "expired");
  assert.equal(status.limited, true);
  assert.equal(status.daysLeft, 0);
  assert.equal(status.dayNumber, 15);
  assert.equal(trialDaysLeftLabel(status), "закончился");
});

test("ROOT продлил subscriptionEnd — тест снова идёт", () => {
  const status = getTrialStatus(
    {
      subscriptionPlan: "trial",
      subscriptionEnd: "2026-09-20T00:00:00.000Z",
      createdAt: new Date(now.getTime() - 40 * DAY),
    },
    now
  );
  assert.equal(status.phase, "trial");
  assert.equal(status.daysLeft, 17);
});

test("последний день теста — подпись «последний день»", () => {
  const status = getTrialStatus(
    {
      subscriptionPlan: "trial",
      subscriptionEnd: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 13 * DAY),
    },
    now
  );
  assert.equal(status.daysLeft, 1);
  assert.equal(trialDaysLeftLabel(status), "последний день");
});

test("free — лимиты действуют, отсчёта нет; paid и paused — без лимитов", () => {
  const free = getTrialStatus(
    { subscriptionPlan: "free", subscriptionEnd: null, createdAt: now },
    now
  );
  assert.equal(free.phase, "free");
  assert.equal(free.limited, true);
  assert.equal(free.endsAt, null);

  const paid = getTrialStatus(
    { subscriptionPlan: "paid", subscriptionEnd: null, createdAt: now },
    now
  );
  assert.equal(paid.phase, "paid");
  assert.equal(paid.limited, false);

  const paused = getTrialStatus(
    { subscriptionPlan: "paused", subscriptionEnd: null, createdAt: now },
    now
  );
  assert.equal(paused.phase, "other");
  assert.equal(paused.limited, false);
});

test("пустой план читается как trial", () => {
  const status = getTrialStatus(
    { subscriptionPlan: null, subscriptionEnd: null, createdAt: now },
    now
  );
  assert.equal(status.phase, "trial");
});

test("decideTrialWrite: 50-я запись проходит, 51-я — нет (боевой режим)", () => {
  const limit = TRIAL_LIMITS.entriesPerDay;
  const ok = decideTrialWrite({ limited: true, used: limit - 1, count: 1, testMode: false });
  assert.equal(ok.allowed, true);
  assert.equal(ok.used, limit);
  assert.equal(ok.softExceeded, false);

  const blocked = decideTrialWrite({ limited: true, used: limit, count: 1, testMode: false });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.used, limit);
  assert.equal(blocked.limit, limit);
});

test("decideTrialWrite: пачка из 30 записей при 25 использованных не проходит", () => {
  const blocked = decideTrialWrite({ limited: true, used: 25, count: 30, testMode: false });
  assert.equal(blocked.allowed, false);
  const ok = decideTrialWrite({ limited: true, used: 20, count: 30, testMode: false });
  assert.equal(ok.allowed, true);
  assert.equal(ok.used, 50);
});

test("decideTrialWrite: тестовый режим биллинга не блокирует, но помечает превышение", () => {
  const soft = decideTrialWrite({ limited: true, used: 50, count: 1, testMode: true });
  assert.equal(soft.allowed, true);
  assert.equal(soft.softExceeded, true);
  assert.equal(soft.used, 51);
});

test("decideTrialWrite: платный тариф — без лимита", () => {
  const paid = decideTrialWrite({ limited: false, used: 500, count: 10, testMode: false });
  assert.equal(paid.allowed, true);
  assert.equal(paid.softExceeded, false);
});

test("formatDaysRu склоняет дни", () => {
  assert.equal(formatDaysRu(1), "1 день");
  assert.equal(formatDaysRu(3), "3 дня");
  assert.equal(formatDaysRu(11), "11 дней");
  assert.equal(formatDaysRu(14), "14 дней");
});
