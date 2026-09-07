/**
 * Regression-тест: журнал уборки не создаётся заполненным НАПЕРЁД.
 *
 * До 2026-09-07 `preplanCleaningConfig` раскладывал план Т/Г на весь
 * период документа, поэтому свежесозданный (в т.ч. демо-) журнал за
 * 1–15 сентября уже 7-го числа показывал «Т» до 15-го включительно.
 * Для проверяющего это заполнение вперёд, а не график.
 *
 * Договорённость: план кладётся ТОЛЬКО по сегодня включительно, а
 * будущие дни доезжают ночным автозаполнителем.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { preplanCleaningConfig } from "@/lib/journal-auto-create";
import {
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  defaultCleaningDocumentConfig,
  normalizeCleaningDocumentConfig,
} from "@/lib/cleaning-document";

function preplan(now: Date) {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-A"],
    rooms: [],
    matrix: {},
  };
  return normalizeCleaningDocumentConfig(
    preplanCleaningConfig(
      CLEANING_DOCUMENT_TEMPLATE_CODE,
      config,
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-09-15T00:00:00Z"),
      now,
    ),
  );
}

test("план не заходит за сегодня", () => {
  const result = preplan(new Date("2026-09-07T12:00:00Z"));
  const row = result.matrix["room-A"] ?? {};

  assert.equal(row["2026-09-07"], "T", "сегодня размечено по плану");
  for (const key of ["2026-09-08", "2026-09-09", "2026-09-15"]) {
    assert.equal(row[key], undefined, `${key} — будущее, ячейка пустая`);
  }
});

test("прошедшие дни периода остаются размеченными", () => {
  const result = preplan(new Date("2026-09-07T12:00:00Z"));
  const row = result.matrix["room-A"] ?? {};

  assert.equal(row["2026-09-01"], "T");
  assert.equal(row["2026-09-06"], "T");
});

test("документ на будущий период создаётся пустым", () => {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-A"],
    rooms: [],
    matrix: {},
  };
  const result = normalizeCleaningDocumentConfig(
    preplanCleaningConfig(
      CLEANING_DOCUMENT_TEMPLATE_CODE,
      config,
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-10-15T00:00:00Z"),
      new Date("2026-09-07T12:00:00Z"),
    ),
  );

  assert.deepEqual(result.matrix["room-A"] ?? {}, {});
});
