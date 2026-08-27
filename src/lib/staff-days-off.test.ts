import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WEEKLY_DAYS_OFF,
  buildDayOffOverrides,
  isStaffDayOff,
  normalizeWeeklyDaysOff,
  planWorkOffBulk,
  weekdayIndex,
  weeklyDaysOffLabel,
} from "@/lib/staff-days-off";

// 2026-08-24 — понедельник, значит 29-е суббота, 30-е воскресенье.
const MONDAY = "2026-08-24";
const FRIDAY = "2026-08-28";
const SATURDAY = "2026-08-29";
const SUNDAY = "2026-08-30";

test("weekdayIndex: 0=Пн … 6=Вс, считается в UTC", () => {
  assert.equal(weekdayIndex(MONDAY), 0);
  assert.equal(weekdayIndex(FRIDAY), 4);
  assert.equal(weekdayIndex(SATURDAY), 5);
  assert.equal(weekdayIndex(SUNDAY), 6);
  assert.equal(weekdayIndex(new Date("2026-08-30T00:00:00.000Z")), 6);
});

test("normalizeWeeklyDaysOff чистит мусор, дубли и сортирует", () => {
  assert.deepEqual(normalizeWeeklyDaysOff([6, 5, 5, 99, -1, "3", null]), [3, 5, 6]);
  assert.deepEqual(normalizeWeeklyDaysOff(null), []);
  assert.deepEqual(normalizeWeeklyDaysOff("сб"), []);
});

test("isStaffDayOff: матрица правило × явная отметка", () => {
  const weekender = { weeklyDaysOff: [...DEFAULT_WEEKLY_DAYS_OFF] };
  const noRule = { weeklyDaysOff: [] };

  // 1. Только правило.
  assert.equal(isStaffDayOff(weekender, SATURDAY), true);
  assert.equal(isStaffDayOff(weekender, MONDAY), false);

  // 2. Явный "off" побеждает правило «рабочий день».
  assert.equal(isStaffDayOff(weekender, MONDAY, "off"), true);
  assert.equal(isStaffDayOff(noRule, MONDAY, "off"), true);

  // 3. Явный "work" побеждает правило «выходной».
  assert.equal(isStaffDayOff(weekender, SATURDAY, "work"), false);

  // 4. Нет ни правила, ни отметки — рабочий день.
  assert.equal(isStaffDayOff(noRule, SUNDAY), false);
  assert.equal(isStaffDayOff(null, SUNDAY), false);
  assert.equal(isStaffDayOff(undefined, SUNDAY, null), false);
});

test("buildDayOffOverrides складывает строки в карту с дефолтом off", () => {
  const map = buildDayOffOverrides([
    { userId: "u1", date: new Date("2026-08-24T00:00:00.000Z"), kind: "off" },
    { userId: "u1", date: SATURDAY, kind: "work" },
    { userId: "u2", date: SUNDAY, kind: null },
  ]);
  assert.equal(map.get("u1|2026-08-24"), "off");
  assert.equal(map.get(`u1|${SATURDAY}`), "work");
  assert.equal(map.get(`u2|${SUNDAY}`), "off");
  assert.equal(map.get("u3|2026-08-24"), undefined);
});

test("planWorkOffBulk пишет строку только при расхождении с правилом", () => {
  const weekly = new Map<string, number[]>([["u1", [5, 6]]]);

  const plan = planWorkOffBulk(
    [
      // Совпадает с правилом — исключение не нужно, чистим старое.
      { userId: "u1", date: SATURDAY, enabled: true },
      // Расходится с правилом — сохраняем "work".
      { userId: "u1", date: SUNDAY, enabled: false },
      // Расходится с правилом — сохраняем "off".
      { userId: "u1", date: MONDAY, enabled: true },
      // Совпадает с правилом (будни рабочие) — чистим.
      { userId: "u1", date: FRIDAY, enabled: false },
    ],
    weekly
  );

  assert.deepEqual(plan.upserts, [
    { userId: "u1", date: MONDAY, kind: "off" },
    { userId: "u1", date: SUNDAY, kind: "work" },
  ]);
  assert.deepEqual(plan.deletes, [
    { userId: "u1", date: FRIDAY },
    { userId: "u1", date: SATURDAY },
  ]);
});

test("planWorkOffBulk идемпотентен: повтор и дубли дают тот же план", () => {
  const weekly = new Map<string, number[]>([
    ["u1", [5, 6]],
    ["u2", []],
  ]);
  const items = [
    { userId: "u1", date: MONDAY, enabled: true },
    { userId: "u2", date: SATURDAY, enabled: true },
  ];

  const once = planWorkOffBulk(items, weekly);
  const twice = planWorkOffBulk([...items, ...items], weekly);
  assert.deepEqual(twice, once);

  // Последний клик по одной и той же клетке побеждает.
  const repainted = planWorkOffBulk(
    [
      { userId: "u1", date: MONDAY, enabled: true },
      { userId: "u1", date: MONDAY, enabled: false },
    ],
    weekly
  );
  assert.deepEqual(repainted.upserts, []);
  assert.deepEqual(repainted.deletes, [{ userId: "u1", date: MONDAY }]);
});

test("planWorkOffBulk: сотрудник без правила хранит каждый выходной явно", () => {
  const plan = planWorkOffBulk(
    [{ userId: "u2", date: SUNDAY, enabled: true }],
    new Map<string, number[]>()
  );
  assert.deepEqual(plan.upserts, [{ userId: "u2", date: SUNDAY, kind: "off" }]);
  assert.deepEqual(plan.deletes, []);
});

test("weeklyDaysOffLabel человекочитаем", () => {
  assert.equal(weeklyDaysOffLabel([5, 6]), "Сб, Вс");
  assert.equal(weeklyDaysOffLabel([]), "не задано");
});
