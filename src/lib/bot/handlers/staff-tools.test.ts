/**
 * Unit-тесты для pure helpers staff-tools (label formatting + button
 * decision logic). Защищают от regression при будущих изменениях в
 * shift-status mapping или action-button policy.
 *
 * Сама команда `/shift` через grammy не testable без mock'а Telegram
 * Bot API; здесь — только pure decision functions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SHIFT_STATUS_LABEL,
  formatShiftStatusLabel,
  shiftStatusActions,
} from "@/lib/bot/handlers/staff-tools";

test("formatShiftStatusLabel: все 8 documented статусов", () => {
  assert.equal(
    formatShiftStatusLabel("none"),
    "🆕 Смена ещё не открыта"
  );
  assert.equal(
    formatShiftStatusLabel("scheduled"),
    "🕒 По графику, но ещё не на смене"
  );
  assert.equal(formatShiftStatusLabel("working"), "🟢 На смене сейчас");
  assert.equal(formatShiftStatusLabel("ended"), "✅ Смена сегодня закрыта");
  assert.equal(formatShiftStatusLabel("absent"), "🔴 Помечена как пропуск");
  assert.equal(formatShiftStatusLabel("off"), "🌴 Выходной");
  assert.equal(formatShiftStatusLabel("vacation"), "✈️ Отпуск");
  assert.equal(formatShiftStatusLabel("sick"), "🤒 Больничный");
});

test("formatShiftStatusLabel: unknown status возвращается как-есть (forward-compat)", () => {
  assert.equal(formatShiftStatusLabel("vacation_paid"), "vacation_paid");
  assert.equal(formatShiftStatusLabel(""), "");
  assert.equal(formatShiftStatusLabel("UNEXPECTED"), "UNEXPECTED");
});

test("SHIFT_STATUS_LABEL: ровно 8 ключей — синхронизация с WorkShift.status",
  () => {
    const keys = Object.keys(SHIFT_STATUS_LABEL).sort();
    assert.deepEqual(keys, [
      "absent",
      "ended",
      "none",
      "off",
      "scheduled",
      "sick",
      "vacation",
      "working",
    ]);
  });

test("shiftStatusActions: working → только «end» (закрыть смену)", () => {
  assert.deepEqual(shiftStatusActions("working"), ["end"]);
});

test("shiftStatusActions: none/scheduled → «start» (открыть смену)", () => {
  assert.deepEqual(shiftStatusActions("none"), ["start"]);
  assert.deepEqual(shiftStatusActions("scheduled"), ["start"]);
});

test("shiftStatusActions: ended/absent/off/vacation/sick → нет действий (защита HR-учёта)", () => {
  for (const status of ["ended", "absent", "off", "vacation", "sick"]) {
    assert.deepEqual(
      shiftStatusActions(status),
      [],
      `expected no actions for ${status}`
    );
  }
});

test("shiftStatusActions: unknown status → fallback «start»", () => {
  // Forward-compat: если в БД появился новый status, лучше дать
  // сотруднику возможность начать смену чем заблокировать UI.
  assert.deepEqual(shiftStatusActions("custom_status"), ["start"]);
  assert.deepEqual(shiftStatusActions(""), ["start"]);
});
