import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFieldLabels,
  fieldLabel,
  formatFieldValue,
  prettifyKey,
} from "@/lib/field-labels";

describe("prettifyKey", () => {
  it("разбирает camelCase", () => {
    assert.equal(prettifyKey("productName"), "Product name");
    assert.equal(prettifyKey("batchNumber"), "Batch number");
  });

  it("разбирает snake_case", () => {
    assert.equal(prettifyKey("expiry_date"), "Expiry date");
  });

  it("отделяет заглавную после цифры", () => {
    // «temp2Value» без этого читалось бы как «Temp2Value».
    assert.equal(prettifyKey("temp2Value"), "Temp2 value");
  });

  it("сокращение не разжалует в слово", () => {
    // «Supplier inn» читается хуже сырого ключа.
    assert.equal(prettifyKey("supplierINN"), "Supplier INN");
    assert.equal(prettifyKey("orderID"), "Order ID");
  });

  it("не ломается на пустом и странном ключе", () => {
    assert.equal(prettifyKey(""), "");
    assert.equal(prettifyKey("_"), "_");
  });
});

describe("fieldLabel", () => {
  it("подпись из схемы важнее разбора ключа", () => {
    // Из `temperature` больше «Температура» не выжать, а в схеме
    // написано с единицами измерения.
    const schema = new Map([["temperature", "Температура, °C"]]);
    assert.equal(fieldLabel("temperature", schema), "Температура, °C");
  });

  it("принимает и обычный объект, не только Map", () => {
    assert.equal(fieldLabel("temperature", { temperature: "Температура" }), "Температура");
  });

  it("падает на разбор ключа, когда в схеме поля нет", () => {
    assert.equal(fieldLabel("productName", new Map()), "Product name");
    assert.equal(fieldLabel("productName"), "Product name");
  });

  it("пустая подпись в схеме не считается подписью", () => {
    assert.equal(fieldLabel("productName", new Map([["productName", "   "]])), "Product name");
  });
});

describe("formatFieldValue", () => {
  it("булево показывает словами", () => {
    // «true» в журнале проверяющему ничего не говорит.
    assert.equal(formatFieldValue(true), "да");
    assert.equal(formatFieldValue(false), "нет");
  });

  it("пустое показывает прочерком", () => {
    for (const empty of [null, undefined, ""]) {
      assert.equal(formatFieldValue(empty), "—");
    }
  });

  it("списки соединяет запятой", () => {
    assert.equal(formatFieldValue(["а", "б"]), "а, б");
    assert.equal(formatFieldValue([]), "—");
  });

  it("числа и строки отдаёт как есть", () => {
    assert.equal(formatFieldValue(4), "4");
    assert.equal(formatFieldValue(0), "0");
    assert.equal(formatFieldValue("Молоко"), "Молоко");
  });
});

describe("buildFieldLabels", () => {
  it("первая группа важнее остальных", () => {
    // В организации переименовали поле — дефолт не должен вернуть старое имя.
    const labels = buildFieldLabels(
      [{ key: "temperature", label: "Температура в камере" }],
      [{ key: "temperature", label: "Температура" }]
    );
    assert.equal(labels.temperature, "Температура в камере");
  });

  it("системные подписи добавляются, но не перетирают", () => {
    const labels = buildFieldLabels([{ key: "comment", label: "Что случилось" }]);
    assert.equal(labels.comment, "Что случилось");
    assert.equal(labels.supplier, "Поставщик");
  });

  it("мусор в `fields` не роняет разбор", () => {
    // `fields` — JSON из БД, там может лежать вообще что угодно.
    const labels = buildFieldLabels(null, "не массив", [
      null,
      { key: 42 },
      { key: "ok" },
      { key: "ok2", label: "   " },
      { key: "ok3", label: "Подпись" },
    ]);
    assert.equal(labels.ok, undefined);
    assert.equal(labels.ok2, undefined);
    assert.equal(labels.ok3, "Подпись");
  });
});
