import assert from "node:assert/strict";
import test from "node:test";

import {
  createAcceptanceRow,
  getIncomingControlRowValues,
  normalizeAcceptanceDocumentConfig,
} from "@/lib/acceptance-document";

/**
 * Журнал `incoming_control` перестроен на таблицу эталона (11 колонок).
 * Старые записи писались по таблице контроля СЫРЬЯ — они обязаны читаться
 * в новой сетке без миграций. Эти тесты фиксируют маппинг.
 */

test("legacy acceptance row maps into the 11-column incoming_control grid", () => {
  const row = createAcceptanceRow({
    deliveryDate: "2026-04-11",
    productName: "Гастрономия",
    manufacturer: 'ООО "Агро-Юг"',
    supplier: 'ООО "Метро"',
    transportCondition: "satisfactory",
    packagingCompliance: "non_compliant",
    organolepticResult: "satisfactory",
    expiryDate: "2026-04-18",
    note: "Возврат по акту №12",
  });

  // «Годен до» подхватывает предельный срок реализации.
  assert.equal(row.shelfLifeDate, "2026-04-18");
  // Производитель и поставщик схлопываются в одну колонку.
  assert.equal(row.manufacturerSupplier, 'ООО "Агро-Юг" / ООО "Метро"');
  // Органолептика / транспортировка / упаковка уходят в «Соответствие
  // товара сопроводительной документации».
  assert.match(row.documentCompliance, /Упаковка, маркировка, документы: Не соотв\./);
  assert.match(row.documentCompliance, /Транспортировка: Удовл\./);
  assert.match(row.documentCompliance, /Органолептика: Удовл\./);
  // Примечание становится корректирующим действием.
  assert.equal(row.correctiveActions, "Возврат по акту №12");
  // Несоответствие упаковки ⇒ «О» (Отклонить).
  assert.equal(row.acceptanceDecision, "reject");
  assert.equal(getIncomingControlRowValues(row).acceptanceDecision, "О");
});

test("legacy row without defects is read as accepted", () => {
  const row = createAcceptanceRow({
    productName: "Молочная продукция",
    transportCondition: "satisfactory",
    packagingCompliance: "compliant",
    organolepticResult: "satisfactory",
  });
  assert.equal(row.acceptanceDecision, "accept");
  assert.equal(getIncomingControlRowValues(row).acceptanceDecision, "П");
});

test("v2 row keeps its own values and never re-derives from legacy defaults", () => {
  const stored = createAcceptanceRow({
    deliveryDate: "2026-08-10",
    productName: "Мука в/с",
    shelfLifeDate: "2026-12-01",
    manufacturerSupplier: 'ООО "Мельком"',
    accompanyingDocs: "ТТН №1245",
    batchInfo: "20 кг, партия 45-А",
    productTemperature: "+2 °C",
    documentCompliance: "",
    acceptanceDecision: "accept",
    correctiveActions: "",
  });

  // Пустые v2-поля остаются пустыми — свод legacy-оценок не подставляется.
  assert.equal(stored.documentCompliance, "");
  assert.equal(stored.correctiveActions, "");
  // Round-trip через JSON (как в БД) ничего не ломает.
  const roundTripped = createAcceptanceRow(JSON.parse(JSON.stringify(stored)));
  assert.equal(roundTripped.documentCompliance, "");
  assert.equal(roundTripped.acceptanceDecision, "accept");
  assert.equal(roundTripped.shelfLifeDate, "2026-12-01");
  // Зеркало в legacy-поле — чтобы cron сроков годности видел дату.
  assert.equal(roundTripped.expiryDate, "2026-12-01");
  assert.equal(roundTripped.manufacturerSupplier, 'ООО "Мельком"');
});

test("normalizeAcceptanceDocumentConfig migrates rows stored in the old schema", () => {
  const config = normalizeAcceptanceDocumentConfig({
    rows: [
      {
        id: "row-1",
        dateSupply: "2026-03-01",
        productName: "Сыр",
        manufacturer: "Молзавод",
        supplier: "",
        decision: "reject",
        correctiveAction: "Отклонено, возврат",
        expiryDate: "2026-03-10",
      },
    ],
  });

  assert.equal(config.rows.length, 1);
  const values = getIncomingControlRowValues(config.rows[0]);
  assert.equal(values.deliveryDate, "01-03-2026");
  assert.equal(values.shelfLifeDate, "10-03-2026");
  assert.equal(values.manufacturerSupplier, "Молзавод");
  assert.equal(values.acceptanceDecision, "О");
  assert.equal(values.correctiveActions, "Отклонено, возврат");
});
