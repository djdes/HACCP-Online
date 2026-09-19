import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEquipmentMaintenanceConfigFromEquipment,
  getDefaultEquipmentMaintenanceConfig,
  getMonthDayOptions,
  MONTH_KEYS,
  normalizeEquipmentMaintenanceConfig,
} from "@/lib/equipment-maintenance-document";

test("ППР: дефолтный конфиг не содержит выдуманного оборудования", () => {
  assert.deepEqual(getDefaultEquipmentMaintenanceConfig(2026).rows, []);
  assert.deepEqual(normalizeEquipmentMaintenanceConfig(null).rows, []);
  assert.deepEqual(normalizeEquipmentMaintenanceConfig({}).rows, []);
});

test("ППР: строки берутся из справочника, факт остаётся пустым", () => {
  const config = buildEquipmentMaintenanceConfigFromEquipment(
    [
      { id: "eq-1", name: "Холодильная камера", type: "refrigerator" },
      { id: "eq-2", name: "Плита", type: "stove" },
    ],
    2026
  );
  assert.deepEqual(
    config.rows.map((row) => [row.equipmentName, row.maintenanceType]),
    [
      ["Холодильная камера", "B"],
      ["Плита", "A"],
    ]
  );
  for (const row of config.rows) {
    for (const key of MONTH_KEYS) {
      assert.equal(row.plan[key], "-");
      assert.equal(row.fact[key], "");
    }
  }
});

test("ППР: дни месяца — по длине месяца и году документа", () => {
  assert.equal(getMonthDayOptions("feb", 2026).at(-1), "28");
  assert.equal(getMonthDayOptions("feb", 2024).at(-1), "29");
  assert.equal(getMonthDayOptions("jan", 2026).at(-1), "31");
  assert.equal(getMonthDayOptions("apr", 2026).at(-1), "30");
  assert.equal(getMonthDayOptions("jan", 2026)[0], "-");
});
