import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterAndRank,
  matchesTokens,
  normalizeSearch,
  rankMatch,
  searchTokens,
} from "@/app/mini/_lib/list-search";

type Item = { id: string; name: string; note?: string | null };

const ITEMS: Item[] = [
  { id: "eq-1", name: "Холодильник, горячий цех", note: "Bosch" },
  { id: "eq-2", name: "Ёлочный декор", note: null },
  { id: "eq-3", name: "Печь конвекционная", note: "холодильник рядом" },
  { id: "eq-4", name: "Морозильный ларь", note: null },
];

const hay = (i: Item) => [i.name, i.note, i.id];

describe("normalizeSearch", () => {
  it("«ё» и «е» — одна буква", () => {
    // Иначе набранное «елочный» не находит «Ёлочный» и список пуст.
    assert.equal(normalizeSearch("Ёлочный"), "елочный");
  });

  it("схлопывает пробелы и регистр", () => {
    assert.equal(normalizeSearch("  ХОЛОД   Цех "), "холод цех");
  });
});

describe("searchTokens", () => {
  it("пустой запрос не даёт слова-пустышки", () => {
    // [""] совпал бы со всем подряд и «поиск» перестал бы фильтровать.
    assert.deepEqual(searchTokens("   "), []);
  });
});

describe("matchesTokens", () => {
  it("порядок слов не важен", () => {
    assert.equal(matchesTokens(["Холодильник, горячий цех"], ["цех", "холод"]), true);
  });

  it("нужны все слова, а не любое", () => {
    assert.equal(matchesTokens(["Холодильник, горячий цех"], ["холод", "печь"]), false);
  });

  it("пустой запрос пропускает всё", () => {
    assert.equal(matchesTokens(["что угодно"], []), true);
  });

  it("нечего искать — не совпадение", () => {
    assert.equal(matchesTokens([null, "", undefined], ["холод"]), false);
  });
});

describe("rankMatch", () => {
  it("начало названия выше середины", () => {
    const fromStart = rankMatch(["Холодильник"], "холод");
    const fromMiddle = rankMatch(["Шкаф холодильный"], "холод");
    assert.ok(fromStart < fromMiddle);
  });

  it("совпадение в названии выше совпадения в примечании", () => {
    const inName = rankMatch(["Холодильник", "Bosch"], "холод");
    const inNote = rankMatch(["Печь", "холодильник рядом"], "холод");
    assert.ok(inName < inNote);
  });
});

describe("filterAndRank", () => {
  it("название вперёд примечания", () => {
    const found = filterAndRank(ITEMS, "холодильник", hay).map((i) => i.id);
    assert.deepEqual(found, ["eq-1", "eq-3"]);
  });

  it("находит по идентификатору из QR", () => {
    // Наклейка несёт id, а не название: без этого сканирование
    // приводит в пустой список.
    const found = filterAndRank(ITEMS, "eq-4", hay).map((i) => i.name);
    assert.deepEqual(found, ["Морозильный ларь"]);
  });

  it("буква «е» находит «ё»", () => {
    const found = filterAndRank(ITEMS, "елочный", hay).map((i) => i.id);
    assert.deepEqual(found, ["eq-2"]);
  });

  it("пустой запрос возвращает исходный порядок", () => {
    const found = filterAndRank(ITEMS, "  ", hay).map((i) => i.id);
    assert.deepEqual(found, ITEMS.map((i) => i.id));
  });

  it("не мешает исходный порядок при равном весе", () => {
    const found = filterAndRank(ITEMS, "ый", hay).map((i) => i.id);
    assert.deepEqual(found, ["eq-2", "eq-4"]);
  });
});
