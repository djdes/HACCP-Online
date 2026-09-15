import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultConfigForJournal } from "@/lib/journal-default-configs";
import { normalizeColdEquipmentDocumentConfig } from "@/lib/cold-equipment-document";
import { normalizeDisinfectantConfig } from "@/lib/disinfectant-document";
import { normalizePerishableRejectionConfig } from "@/lib/perishable-rejection-document";
import { normalizeTraceabilityDocumentConfig } from "@/lib/traceability-document";
import { normalizeUvRuntimeDocumentConfig } from "@/lib/uv-lamp-runtime-document";

/**
 * Реальная организация не получает фикстур в новых документах; демо —
 * получает прежние образцы.
 */

const FIXTURE_MARKERS =
  /Ромашка|Бубнов|Пельмени|2023-12-01|2025-02-13|Ph средство|cold-equipment-default-|Мука/;

const CODES = [
  "perishable_rejection",
  "disinfectant_usage",
  "cold_equipment_control",
  "finished_product",
  "uv_lamp_runtime",
  "traceability_test",
  "incoming_control",
  "accident_journal",
] as const;

const users = [
  { id: "u-anna", name: "Анна Заведующая", role: "manager" },
  { id: "u-boris", name: "Борис Повар", role: "cook" },
];

const realOrg = {
  users,
  products: [{ id: "p1", name: "Сметана 20 %" }],
  suppliers: ["ООО «Молочный двор»"],
  equipment: [{ id: "e1", name: "Термогигрометр", type: "sensor" }],
  isDemo: false,
};

for (const code of CODES) {
  test(`${code}: у реальной организации нет фикстур`, () => {
    const config = getDefaultConfigForJournal(code, realOrg);
    assert.doesNotMatch(JSON.stringify(config), FIXTURE_MARKERS);
  });
}

test("finished_product: имена сотрудников не вписываются в строку", () => {
  const config = getDefaultConfigForJournal("finished_product", realOrg) as {
    rows: Array<{ responsiblePerson: string; inspectorName: string }>;
  };
  assert.equal(config.rows.length, 1);
  assert.equal(config.rows[0]?.responsiblePerson, "");
  assert.equal(config.rows[0]?.inspectorName, "");
});

test("perishable_rejection: списки из справочников организации", () => {
  const config = getDefaultConfigForJournal("perishable_rejection", realOrg) as {
    productLists: Array<{ items: string[] }>;
    suppliers: string[];
    manufacturers: string[];
  };
  assert.deepEqual(config.productLists[0]?.items, ["Сметана 20 %"]);
  assert.deepEqual(config.suppliers, ["ООО «Молочный двор»"]);
  assert.deepEqual(config.manufacturers, []);
});

test("uv_lamp_runtime: форма совпадает с нормализатором, ответственного не угадываем", () => {
  const config = getDefaultConfigForJournal("uv_lamp_runtime", realOrg);
  assert.equal("defaultResponsibleUserId" in config, false);
  assert.deepEqual(normalizeUvRuntimeDocumentConfig(config), config);
});

test("cold_equipment_control: без холодильников — пустая таблица, и она не заполняется стоком", () => {
  const config = getDefaultConfigForJournal("cold_equipment_control", realOrg) as {
    equipment: unknown[];
  };
  assert.deepEqual(config.equipment, []);
  assert.deepEqual(normalizeColdEquipmentDocumentConfig(config).equipment, []);
});

test("cold_equipment_control: старый документ без ключа equipment сохраняет стоковые id", () => {
  const legacy = normalizeColdEquipmentDocumentConfig({ skipWeekends: false });
  assert.ok(legacy.equipment.length > 0);
  assert.equal(legacy.equipment[0]?.id, "cold-equipment-default-0");
});

test("демо-организация получает прежние образцы", () => {
  const demo = { ...realOrg, equipment: [], isDemo: true };
  assert.match(
    JSON.stringify(getDefaultConfigForJournal("perishable_rejection", demo)),
    /Пельмени/
  );
  assert.match(
    JSON.stringify(getDefaultConfigForJournal("disinfectant_usage", demo)),
    /Ph средство/
  );
  assert.match(
    JSON.stringify(getDefaultConfigForJournal("cold_equipment_control", demo)),
    /cold-equipment-default-0/
  );
  assert.match(
    JSON.stringify(getDefaultConfigForJournal("finished_product", demo)),
    /Анна Заведующая/
  );
});

test("нормализаторы не возвращают фикстуры в пустой конфиг", () => {
  assert.doesNotMatch(
    JSON.stringify(normalizePerishableRejectionConfig({})),
    FIXTURE_MARKERS
  );
  assert.doesNotMatch(JSON.stringify(normalizeDisinfectantConfig(null)), FIXTURE_MARKERS);
  const traceability = normalizeTraceabilityDocumentConfig({
    rawMaterialList: [],
    productList: [],
  });
  assert.deepEqual(traceability.rawMaterialList, []);
  assert.deepEqual(traceability.productList, []);
});
