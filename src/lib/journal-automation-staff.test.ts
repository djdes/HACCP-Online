/**
 * Чистая часть резолвера списка сотрудников-строк
 * (`journal-automation-staff.ts`): пересечение с «живыми» и объединение
 * унаследованных с новичками. Запуск: npm test
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  keepAliveIds,
  mergeInheritedWithNewcomers,
} from "@/lib/journal-automation-staff";

test("keepAliveIds оставляет только живых, без дублей, в порядке выбора", () => {
  assert.deepEqual(
    keepAliveIds(["u3", "u1", "u3", "", "u9", "u2"], ["u1", "u2", "u3"]),
    ["u3", "u1", "u2"]
  );
  assert.deepEqual(keepAliveIds(["u1"], []), []);
  assert.deepEqual(keepAliveIds([], ["u1"]), []);
});

test("mergeInheritedWithNewcomers: унаследованные первыми, новички после, без дублей", () => {
  assert.deepEqual(
    mergeInheritedWithNewcomers(["u2", "u1"], ["u1", "u5", "", "u5"]),
    ["u2", "u1", "u5"]
  );
  // Пустое наследование не мешает новичкам: резолвер сам решит, что
  // пустой итог — это легаси-фолбэк.
  assert.deepEqual(mergeInheritedWithNewcomers([], ["u7"]), ["u7"]);
});
