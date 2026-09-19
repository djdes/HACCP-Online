import assert from "node:assert/strict";
import test from "node:test";

import {
  fillAuditProtocolFromPlan,
  getDefaultAuditProtocolConfig,
  normalizeAuditProtocolConfig,
  type AuditProtocolPlanSource,
} from "@/lib/audit-protocol-document";

const plan: AuditProtocolPlanSource = {
  documentId: "plan-1",
  title: "План-программа аудитов 2026",
  sections: [
    { id: "general", title: "ОБЩИЕ ТРЕБОВАНИЯ" },
    { id: "special", title: "СПЕЦИАЛЬНЫЕ ТРЕБОВАНИЯ" },
  ],
  rows: [
    { id: "p1", sectionId: "general", text: "Наличие и управление документацией" },
    { id: "p2", sectionId: "special", text: "Требования к оборудованию" },
    { id: "p3", sectionId: "general", text: "   " },
  ],
};

test("заполнение из плана копирует требования и ставит ссылку", () => {
  const base = { ...getDefaultAuditProtocolConfig(), sections: [], rows: [] };
  const { config, addedRows, skippedRows } = fillAuditProtocolFromPlan(base, plan);

  assert.equal(addedRows, 2, "пустая строка плана не копируется");
  assert.equal(skippedRows, 0);
  assert.equal(config.sourcePlanDocumentId, "plan-1");
  assert.equal(config.sourcePlanTitle, plan.title);
  assert.equal(config.basisTitle, plan.title);
  assert.deepEqual(
    config.rows.map((row) => row.planRowId),
    ["p1", "p2"]
  );
  assert.equal(config.sections.length, 2);
  // Требование попадает в раздел с тем же названием, что и в плане.
  const generalId = config.sections.find((s) => s.title === "ОБЩИЕ ТРЕБОВАНИЯ")?.id;
  assert.equal(config.rows[0]!.sectionId, generalId);
});

test("повторное заполнение из того же плана не создаёт дублей", () => {
  const base = { ...getDefaultAuditProtocolConfig(), sections: [], rows: [] };
  const first = fillAuditProtocolFromPlan(base, plan);
  const second = fillAuditProtocolFromPlan(first.config, plan);

  assert.equal(second.addedRows, 0);
  assert.equal(second.skippedRows, 2);
  assert.equal(second.config.rows.length, 2);
  assert.equal(second.config.sections.length, 2);
});

test("правка плана задним числом протокол не меняет — это копия", () => {
  const base = { ...getDefaultAuditProtocolConfig(), sections: [], rows: [] };
  const { config } = fillAuditProtocolFromPlan(base, plan);
  const changedPlan: AuditProtocolPlanSource = {
    ...plan,
    rows: plan.rows.map((row) =>
      row.id === "p1" ? { ...row, text: "ПЕРЕПИСАННОЕ ТРЕБОВАНИЕ" } : row
    ),
  };

  const again = fillAuditProtocolFromPlan(config, changedPlan);
  assert.equal(again.config.rows[0]!.text, "Наличие и управление документацией");
  assert.equal(again.addedRows, 0);
});

test("своё основание проверки не перебивается названием плана", () => {
  const base = {
    ...getDefaultAuditProtocolConfig(),
    sections: [],
    rows: [],
    basisTitle: "Приказ №12 от 01.02.2026",
  };
  const { config } = fillAuditProtocolFromPlan(base, plan);
  assert.equal(config.basisTitle, "Приказ №12 от 01.02.2026");
});

test("planRowId и ссылка на план переживают нормализацию", () => {
  const base = { ...getDefaultAuditProtocolConfig(), sections: [], rows: [] };
  const { config } = fillAuditProtocolFromPlan(base, plan);
  const restored = normalizeAuditProtocolConfig(JSON.parse(JSON.stringify(config)));

  assert.equal(restored.sourcePlanDocumentId, "plan-1");
  assert.equal(restored.rows[0]!.planRowId, "p1");
});

test("старый протокол без ссылки нормализуется как раньше", () => {
  const restored = normalizeAuditProtocolConfig({ documentDate: "2026-02-01" });
  assert.equal(restored.sourcePlanDocumentId, null);
  assert.equal(restored.sourcePlanTitle, null);
});
