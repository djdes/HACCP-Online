import assert from "node:assert/strict";
import test from "node:test";

import {
  getEquipmentCleaningCreatePeriodBounds,
  getEquipmentCleaningEntryDateBounds,
  getEquipmentCleaningResultLabel,
  isEquipmentCleaningDateAllowed,
} from "./equipment-cleaning-document";

test("период нового документа — годовой, а не один день", () => {
  const bounds = getEquipmentCleaningCreatePeriodBounds();
  assert.notEqual(bounds.dateFrom, bounds.dateTo);
  assert.equal(bounds.dateTo, `${bounds.dateFrom.slice(0, 4)}-12-31`);
});

test("мойку можно внести задним числом, но не в будущее", () => {
  // Старый документ с вырожденным периодом (dateFrom = дата создания).
  const documentDateFrom = "2026-09-19";
  const today = "2026-09-19";

  assert.equal(
    isEquipmentCleaningDateAllowed("2026-09-19", documentDateFrom, today),
    true
  );
  assert.equal(
    isEquipmentCleaningDateAllowed("2026-09-18", documentDateFrom, today),
    true,
    "вчерашняя мойка должна сохраняться"
  );
  assert.equal(
    isEquipmentCleaningDateAllowed("2026-09-20", documentDateFrom, today),
    false
  );
  assert.equal(
    isEquipmentCleaningDateAllowed("2025-12-31", documentDateFrom, today),
    false,
    "прошлый год — вне журнала"
  );
});

test("нижняя граница — начало года документа", () => {
  const bounds = getEquipmentCleaningEntryDateBounds("2026-09-19", "2026-09-19");
  assert.equal(bounds.min, "2026-01-01");
  assert.equal(bounds.max, "2026-09-19");
});

test("незаполненная смываемость — пусто, а не «Соответствует»", () => {
  assert.equal(getEquipmentCleaningResultLabel(null), "");
  assert.equal(getEquipmentCleaningResultLabel("compliant"), "Соответствует");
  assert.equal(
    getEquipmentCleaningResultLabel("non_compliant"),
    "Не соответствует"
  );
});
