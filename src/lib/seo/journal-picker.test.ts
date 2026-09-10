import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickJournals } from "@/lib/seo/journal-picker";

describe("pickJournals", () => {
  it("кафе: базовый набор, бракераж, холод, входной контроль", () => {
    const codes = pickJournals("cafe", []);
    for (const c of ["hygiene", "health_check", "finished_product", "cold_equipment_control", "incoming_control", "disinfectant_usage"]) assert.ok(codes.includes(c), c);
    assert.ok(!codes.includes("fryer_oil"));
  });
  it("опции добавляют профильные журналы, без дублей", () => {
    const codes = pickJournals("cafe", ["fryer", "uv", "flour"]);
    assert.ok(codes.includes("fryer_oil") && codes.includes("uv_lamp_runtime") && codes.includes("metal_impurity"));
    assert.equal(new Set(codes).size, codes.length);
  });
  it("производство — аудит, прослеживаемость, стекло", () => {
    const codes = pickJournals("production", []);
    for (const c of ["audit_plan", "traceability_test", "glass_control", "incoming_raw_materials_control"]) assert.ok(codes.includes(c), c);
  });
});
