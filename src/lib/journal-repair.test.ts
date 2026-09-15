import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyUserRef,
  detectConfigFixtures,
  stripBadConfigUserRefs,
  type RepairUser,
} from "@/lib/journal-repair";
import {
  getColdEquipmentSampleConfig,
} from "@/lib/cold-equipment-document";
import { getDisinfectantSampleConfig } from "@/lib/disinfectant-document";
import { getPerishableRejectionSampleConfig } from "@/lib/perishable-rejection-document";
import { buildFinishedProductSampleConfig } from "@/lib/finished-product-document";
import { getTraceabilitySampleConfig } from "@/lib/traceability-document";

const ORG = "org-a";
const user = (overrides: Partial<RepairUser> & { id: string }): RepairUser => ({
  name: "Сотрудник",
  email: `${overrides.id}@example.com`,
  organizationId: ORG,
  isActive: true,
  archivedAt: null,
  isRoot: false,
  ...overrides,
});
const users = new Map(
  [
    user({ id: "cook", name: "Борис Повар" }),
    user({ id: "owner", name: "owner@example.com" }),
    user({ id: "gone", name: "Уволенный", isActive: false }),
    user({ id: "root", name: "Админ", isRoot: true, organizationId: "platform" }),
    user({ id: "stranger", name: "Чужой", organizationId: "org-b" }),
  ].map((item) => [item.id, item])
);

test("classifyUserRef: чужой, ROOT, уволенный, удалённый, заглушка", () => {
  assert.equal(classifyUserRef("cook", ORG, users, true), null);
  assert.equal(classifyUserRef("stranger", ORG, users, true), "foreign");
  assert.equal(classifyUserRef("root", ORG, users, true), "root");
  assert.equal(classifyUserRef("gone", ORG, users, true), "archived");
  assert.equal(classifyUserRef("deleted", ORG, users, true), "missing");
  assert.equal(classifyUserRef("owner", ORG, users, true), "placeholder");
  assert.equal(classifyUserRef("owner", ORG, users, false), null);
  assert.equal(classifyUserRef(null, ORG, users, true), null);
});

test("stripBadConfigUserRefs обнуляет только плохие ссылки, включая комиссию", () => {
  const result = stripBadConfigUserRefs(
    {
      defaultResponsibleUserId: "stranger",
      approveEmployeeId: "cook",
      commission: { chefUserId: "root", member1UserId: "cook" },
    },
    (id) => id === "stranger" || id === "root"
  );
  assert.deepEqual(result.removed.sort(), ["commission.chefUserId", "defaultResponsibleUserId"]);
  assert.equal(result.config?.defaultResponsibleUserId, null);
  assert.equal(result.config?.approveEmployeeId, "cook");
  assert.deepEqual(result.config?.commission, { chefUserId: null, member1UserId: "cook" });
  assert.equal(stripBadConfigUserRefs({ approveEmployeeId: "cook" }, () => false).config, null);
});

test("бракераж скоропорта: «Ромашка», «Бубнов», «Пельмени» убираются, если не использованы", () => {
  const sample = getPerishableRejectionSampleConfig();
  const fix = detectConfigFixtures("perishable_rejection", sample);
  assert.ok(fix.config);
  assert.deepEqual(fix.config?.manufacturers, []);
  assert.deepEqual(fix.config?.suppliers, []);
  assert.deepEqual((fix.config?.productLists as Array<{ items: string[] }>)[0].items, []);

  const used = detectConfigFixtures("perishable_rejection", sample, {
    usedValues: new Set(["Пельмени"]),
  });
  assert.deepEqual((used.config?.productLists as Array<{ items: string[] }>)[0].items, ["Пельмени"]);
});

test("дезсредства: строки образца удаляются, свои остаются", () => {
  const sample = getDisinfectantSampleConfig();
  const own = { ...sample.receipts[0], id: "own-1", disinfectantName: "Свое средство" };
  const fix = detectConfigFixtures("disinfectant_usage", { ...sample, receipts: [...sample.receipts, own] });
  assert.deepEqual(fix.config?.subdivisions, []);
  assert.deepEqual(fix.config?.consumptions, []);
  assert.deepEqual((fix.config?.receipts as Array<{ id: string }>).map((row) => row.id), ["own-1"]);
});

test("холодильники: стоковые заменяются справочником, если по ним нет показаний", () => {
  const sample = getColdEquipmentSampleConfig();
  const fix = detectConfigFixtures("cold_equipment_control", sample, {
    orgColdEquipment: [{ sourceEquipmentId: "eq-1", name: "Камера 1", min: 2, max: 4 }],
  });
  const equipment = fix.config?.equipment as Array<{ sourceEquipmentId: string; name: string }>;
  assert.equal(equipment.length, 1);
  assert.equal(equipment[0].sourceEquipmentId, "eq-1");

  const kept = detectConfigFixtures("cold_equipment_control", sample, {
    equipmentIdsWithReadings: new Set(["cold-equipment-default-0"]),
  });
  assert.equal(kept.config, null);
  assert.equal(kept.findings.length, 1);
});

test("прослеживаемость и бракераж готовой продукции", () => {
  const traceability = detectConfigFixtures("traceability_test", getTraceabilitySampleConfig());
  assert.deepEqual(traceability.config?.rawMaterialList, []);
  assert.deepEqual(traceability.config?.productList, []);

  const finished = detectConfigFixtures(
    "finished_product",
    buildFinishedProductSampleConfig([{ name: "Анна" }, { name: "Борис" }])
  );
  const rows = finished.config?.rows as Array<{ responsiblePerson: string; inspectorName: string }>;
  assert.equal(rows[0].responsiblePerson, "");
  assert.equal(rows[0].inspectorName, "");

  const filled = detectConfigFixtures("finished_product", {
    rows: [{ productName: "Борщ", responsiblePerson: "Анна", inspectorName: "Борис" }],
  });
  assert.equal(filled.config, null);
});
