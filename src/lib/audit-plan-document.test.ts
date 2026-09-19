import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAuditPlanConfig } from "@/lib/audit-plan-document";

/**
 * Регрессия: `normalizeAuditPlanConfig` возвращала демо-набор строк,
 * когда сохранённый массив оказывался пустым. Удаление всех строк
 * воскрешало 23 строки с выдуманными датами 2021-2023, и сервер писал
 * их обратно в документ.
 */
test("пустой сохранённый массив строк остаётся пустым", () => {
  const defaults = normalizeAuditPlanConfig(null);
  assert.ok(defaults.rows.length > 0, "у нового документа строки по умолчанию есть");

  const emptied = normalizeAuditPlanConfig({
    ...defaults,
    rows: [],
  });
  assert.deepEqual(emptied.rows, []);
});

test("пустые разделы и колонки тоже остаются пустыми", () => {
  const defaults = normalizeAuditPlanConfig(null);

  const emptied = normalizeAuditPlanConfig({
    ...defaults,
    sections: [],
    columns: [],
    rows: [],
  });
  assert.deepEqual(emptied.sections, []);
  assert.deepEqual(emptied.columns, []);
  assert.deepEqual(emptied.rows, []);
});

test("отсутствующий ключ — по-прежнему дефолты нового документа", () => {
  const defaults = normalizeAuditPlanConfig(null);
  const restored = normalizeAuditPlanConfig({ year: defaults.year });

  assert.equal(restored.rows.length, defaults.rows.length);
  assert.equal(restored.sections.length, defaults.sections.length);
  assert.equal(restored.columns.length, defaults.columns.length);
});

test("строки без валидного раздела отбрасываются, остальное сохраняется", () => {
  const defaults = normalizeAuditPlanConfig(null);
  const sectionId = defaults.sections[0]!.id;

  const config = normalizeAuditPlanConfig({
    ...defaults,
    rows: [
      { id: "r1", sectionId, text: "Проверить журналы", checked: true, values: {} },
      { id: "r2", sectionId: "нет-такого", text: "Мусор", checked: false, values: {} },
    ],
  });

  assert.equal(config.rows.length, 1);
  assert.equal(config.rows[0]!.text, "Проверить журналы");
});
