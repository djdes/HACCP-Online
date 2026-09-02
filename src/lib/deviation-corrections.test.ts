import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeColdEquipmentEntryData,
  normalizeColdEquipmentDocumentConfig,
  normalizeColdEquipmentEntryData,
  syncColdEquipmentEntryDataWithConfig,
} from "@/lib/cold-equipment-document";
import {
  mergeClimateEntryData,
  normalizeClimateDocumentConfig,
  normalizeClimateEntryData,
  syncClimateEntryDataWithConfig,
} from "@/lib/climate-document";

/**
 * Комментарий к отклонению живёт в той же записи, что и замеры. Раньше
 * normalize/sync/merge пересобирали запись без поля `corrections`, и
 * текст пропадал после перезагрузки страницы и ночного автозаполнения.
 */
describe("corrections survive normalize/sync/merge", () => {
  it("cold equipment", () => {
    const config = normalizeColdEquipmentDocumentConfig({
      equipment: [{ id: "f1", name: "Холодильник №1", min: 0, max: 4 }],
    });
    const raw = {
      responsibleTitle: "Иванова",
      temperatures: { f1: 8.5, stale: 2 },
      corrections: { f1: "Дверца была открыта", empty: "  ", junk: 5 },
    };
    const normalized = normalizeColdEquipmentEntryData(raw);
    assert.deepEqual(normalized.corrections, { f1: "Дверца была открыта" });

    const synced = syncColdEquipmentEntryDataWithConfig(normalized, config);
    assert.deepEqual(Object.keys(synced.temperatures), ["f1"]);
    assert.deepEqual(synced.corrections, { f1: "Дверца была открыта" });

    const merged = mergeColdEquipmentEntryData(synced, {
      responsibleTitle: null,
      temperatures: { f1: 3 },
    });
    assert.equal(merged.temperatures.f1, 8.5);
    assert.deepEqual(merged.corrections, { f1: "Дверца была открыта" });

    assert.equal(
      "corrections" in normalizeColdEquipmentEntryData({ temperatures: {} }),
      false
    );
  });

  it("climate", () => {
    const config = normalizeClimateDocumentConfig({
      rooms: [{ id: "r1", name: "Склад" }],
      controlTimes: ["10:00"],
    });
    const raw = {
      responsibleTitle: "Иванова",
      measurements: { r1: { "10:00": { temperature: 26, humidity: 50 } } },
      corrections: { "r1|10:00|temperature": "Включили вентиляцию" },
    };
    const normalized = normalizeClimateEntryData(raw);
    assert.deepEqual(normalized.corrections, raw.corrections);

    const synced = syncClimateEntryDataWithConfig(normalized, config);
    assert.deepEqual(synced.corrections, raw.corrections);

    const merged = mergeClimateEntryData(synced, {
      responsibleTitle: null,
      measurements: { r1: { "10:00": { temperature: 20, humidity: 45 } } },
    });
    assert.equal(merged.measurements.r1["10:00"].temperature, 26);
    assert.deepEqual(merged.corrections, raw.corrections);
  });
});
