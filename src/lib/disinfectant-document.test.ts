import assert from "node:assert/strict";
import test from "node:test";

import {
  computeNeedPerMonth,
  computeNeedPerTreatment,
  createEmptySubdivision,
  resolveSolutionPerTreatment,
  sumDisinfectantQuantities,
  type SubdivisionRow,
} from "./disinfectant-document";

function subdivision(patch: Partial<SubdivisionRow>): SubdivisionRow {
  return { ...createEmptySubdivision(), ...patch };
}

test("раствор на обработку считается по площади, когда поле пустое", () => {
  const row = subdivision({
    area: 50,
    solutionConsumptionPerSqm: 0.7,
    solutionPerTreatment: 0,
    concentration: 0.5,
    frequencyPerMonth: 31,
  });
  assert.equal(resolveSolutionPerTreatment(row), 35);
  assert.equal(computeNeedPerTreatment(row), 35 * 0.005);
  assert.equal(computeNeedPerMonth(row), 35 * 0.005 * 31);
});

test("ручное значение главнее расчёта по площади", () => {
  const row = subdivision({
    area: 50,
    solutionConsumptionPerSqm: 0.7,
    solutionPerTreatment: 5,
  });
  assert.equal(resolveSolutionPerTreatment(row), 5);
});

test("для объекта «на ёмкость» площадь не участвует", () => {
  const row = subdivision({
    byCapacity: true,
    area: null,
    solutionConsumptionPerSqm: 0.7,
    solutionPerTreatment: 0,
  });
  assert.equal(resolveSolutionPerTreatment(row), 0);
});

test("итог по приходу складывается по единицам, ноль не печатается", () => {
  assert.equal(
    sumDisinfectantQuantities([
      { quantity: 30, unit: "l" },
      { quantity: 12, unit: "l" },
      { quantity: 2, unit: "kg" },
    ]),
    "42 л. · 2 кг."
  );
  assert.equal(sumDisinfectantQuantities([{ quantity: 0, unit: "kg" }]), "—");
  assert.equal(sumDisinfectantQuantities([]), "—");
});
