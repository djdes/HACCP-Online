import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeSuggestions,
  normalizeSuggestionValue,
  promoteSuggestions,
} from "./name-suggestions";

describe("mergeSuggestions", () => {
  it("недавние сверху, справочник ниже, без повторов", () => {
    const result = mergeSuggestions(["Борщ", "Плов"], ["плов", "Салат", "Борщ ", ""]);
    assert.deepEqual(result, ["Борщ", "Плов", "Салат"]);
  });
  it("схлопывает пробелы и обрезает", () => {
    assert.deepEqual(mergeSuggestions([" Суп  дня "]), ["Суп дня"]);
  });
});

describe("promoteSuggestions", () => {
  it("поднимает сохранённые наверх", () => {
    assert.deepEqual(promoteSuggestions(["Борщ", "Плов", "Салат"], ["Салат"]), ["Салат", "Борщ", "Плов"]);
  });
  it("новое значение встаёт первым", () => {
    assert.deepEqual(promoteSuggestions(["Борщ"], ["Компот"]), ["Компот", "Борщ"]);
  });
});

describe("normalizeSuggestionValue", () => {
  it("отбрасывает пустое, не-строки и слишком длинное", () => {
    assert.equal(normalizeSuggestionValue("   "), null);
    assert.equal(normalizeSuggestionValue(5), null);
    assert.equal(normalizeSuggestionValue("x".repeat(201)), null);
    assert.equal(normalizeSuggestionValue("Борщ"), "Борщ");
  });
});
