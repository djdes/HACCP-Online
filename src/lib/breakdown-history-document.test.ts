import assert from "node:assert/strict";
import test from "node:test";

import {
  createBreakdownRow,
  formatBreakdownEnd,
  getBreakdownRowDateError,
} from "@/lib/breakdown-history-document";

test("поломки: окончание по умолчанию пустое", () => {
  const row = createBreakdownRow();
  assert.equal(row.endDate, "");
  assert.equal(row.endHour, "");
  assert.equal(row.endMinute, "");
  assert.notEqual(row.startDate, "");
});

test("поломки: окончание не может быть раньше начала", () => {
  const base = createBreakdownRow({
    startDate: "2026-09-10",
    startHour: "14",
    startMinute: "30",
  });
  assert.equal(getBreakdownRowDateError(base), null);
  assert.equal(
    getBreakdownRowDateError({ ...base, endDate: "2026-09-10", endHour: "14", endMinute: "30" }),
    null
  );
  assert.equal(
    getBreakdownRowDateError({ ...base, endDate: "2026-09-11", endHour: "09", endMinute: "00" }),
    null
  );
  assert.match(
    getBreakdownRowDateError({ ...base, endDate: "2026-09-10", endHour: "09", endMinute: "00" }) ?? "",
    /раньше/
  );
  assert.match(
    getBreakdownRowDateError({ ...base, endDate: "2026-09-09", endHour: "23", endMinute: "59" }) ?? "",
    /раньше/
  );
});

test("поломки: незакрытый ремонт печатается пустым", () => {
  const row = createBreakdownRow({ startDate: "2026-09-10" });
  assert.equal(formatBreakdownEnd(row), "");
  assert.equal(
    formatBreakdownEnd({ ...row, endDate: "2026-09-11", endHour: "08", endMinute: "05" }),
    "11-09-2026 08:05"
  );
});
