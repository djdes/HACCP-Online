import assert from "node:assert/strict";
import test from "node:test";

import { limitDateKeysToToday } from "@/lib/staff-journal-autofill";

test("автозаполнение: даты после сегодня отбрасываются, сегодня и прошлое остаются", () => {
  assert.deepEqual(
    limitDateKeysToToday(["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-30"], "2026-09-16"),
    ["2026-09-15", "2026-09-16"]
  );
  assert.deepEqual(limitDateKeysToToday(["2026-10-01", "2026-10-02"], "2026-09-16"), []);
  assert.deepEqual(limitDateKeysToToday([], "2026-09-16"), []);
});

test("автозаполнение: порядок дат сохраняется, ключ «сегодня» по умолчанию — UTC-дата", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.deepEqual(limitDateKeysToToday(["2000-01-02", "2000-01-01", "2999-12-31"]), ["2000-01-02", "2000-01-01"]);
  assert.deepEqual(limitDateKeysToToday([today]), [today]);
});

test("график: гигиена получает статус дня, журнал здоровья в выходной остаётся пустым", async () => {
  const { buildStaffAutoFillEntryData } = await import("@/lib/staff-journal-autofill");
  assert.deepEqual(buildStaffAutoFillEntryData("hygiene", "day_off"), { status: "day_off", temperatureAbove37: null });
  assert.deepEqual(buildStaffAutoFillEntryData("hygiene", undefined), { status: "healthy", temperatureAbove37: false });
  assert.deepEqual(buildStaffAutoFillEntryData("health_check", "vacation"), {});
  assert.deepEqual(buildStaffAutoFillEntryData("health_check", "sick_leave"), {});
  assert.deepEqual(buildStaffAutoFillEntryData("health_check", undefined), { signed: true, measures: null });
});
