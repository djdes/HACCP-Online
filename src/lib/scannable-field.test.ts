import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isScannableField } from "@/lib/scannable-field";

describe("isScannableField", () => {
  it("номер партии — да", () => {
    assert.equal(isScannableField({ key: "batchNumber", label: "Номер партии" }), true);
    assert.equal(isScannableField({ key: "lot", label: null }), true);
  });

  it("штрихкод и маркировка — да", () => {
    assert.equal(isScannableField({ label: "Штрих-код" }), true);
    assert.equal(isScannableField({ label: "Код маркировки «Честный знак»" }), true);
  });

  it("накладная и УПД — да", () => {
    assert.equal(isScannableField({ label: "Номер накладной" }), true);
    assert.equal(isScannableField({ key: "ttn" }), true);
  });

  it("примечание и фамилия — нет", () => {
    // Сканер рядом с ними — шум в форме, которую заполняют
    // пятнадцать раз в смену.
    assert.equal(isScannableField({ key: "comment", label: "Комментарий" }), false);
    assert.equal(isScannableField({ label: "Фамилия и инициалы" }), false);
  });

  it("телефон и ИНН — нет, хотя это тоже цифры", () => {
    assert.equal(isScannableField({ label: "Телефон поставщика" }), false);
    assert.equal(isScannableField({ key: "inn", label: "ИНН" }), false);
  });

  it("служебные ключи не ловятся случайно", () => {
    // Латинское «upd» живёт внутри `updatedAt` — поэтому его
    // в списке нет, а кириллическое «УПД» есть.
    assert.equal(isScannableField({ key: "updatedAt" }), false);
    assert.equal(isScannableField({ label: "Номер УПД" }), true);
  });

  it("пустое поле — нет", () => {
    assert.equal(isScannableField({}), false);
    assert.equal(isScannableField({ key: "  ", label: null }), false);
  });

  it("«номер документа» сам по себе слишком общий", () => {
    assert.equal(isScannableField({ key: "documentNumber", label: "Номер документа" }), false);
  });
});
