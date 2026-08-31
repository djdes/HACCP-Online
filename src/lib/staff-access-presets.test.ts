import assert from "node:assert/strict";
import test from "node:test";

import {
  JOURNAL_RESPONSIBILITY_META,
  STAFF_ACCESS_PRESETS,
  presetJournalCodes,
} from "@/lib/journal-responsible-presets";

const ALL_CODES = JOURNAL_RESPONSIBILITY_META.map((meta) => meta.code);

test("manager preset selects the whole active set", () => {
  const manager = STAFF_ACCESS_PRESETS.find((p) => p.id === "manager")!;

  assert.deepEqual(presetJournalCodes(manager, ALL_CODES), ALL_CODES);
});

test("presets never leave the organisation's active set", () => {
  // Выключенный журнал организация не ведёт — предлагать доступ к нему
  // значит спрашивать про то, чего в кабинете нет.
  const active = ALL_CODES.slice(0, 3);

  for (const preset of STAFF_ACCESS_PRESETS) {
    for (const code of presetJournalCodes(preset, active)) {
      assert.ok(active.includes(code), `${preset.id} вышел за набор: ${code}`);
    }
  }
});

test("cleaner preset picks cleaning journals and not the whole catalogue", () => {
  const cleaner = STAFF_ACCESS_PRESETS.find((p) => p.id === "cleaner")!;
  const codes = presetJournalCodes(cleaner, ALL_CODES);

  assert.ok(codes.length > 0, "уборщице должен достаться хотя бы один журнал");
  assert.ok(
    codes.length < ALL_CODES.length,
    "пресет уборщицы не должен совпадать со всем каталогом"
  );
});

test("presetJournalCodes returns nothing when the active set is empty", () => {
  for (const preset of STAFF_ACCESS_PRESETS) {
    assert.deepEqual(presetJournalCodes(preset, []), []);
  }
});
