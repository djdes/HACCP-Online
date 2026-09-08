import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterDayItems,
  nextUnfilledId,
} from "@/components/journals/day-first-logic";

const rows = [
  { id: "a", title: "Денис Волков", subtitle: "Управляющий" },
  { id: "b", title: "Денисова Лариса", subtitle: "Повар ХЦ", value: "Зд." },
  { id: "c", title: "Кулагина Лариса", subtitle: "Продавец" },
  {
    id: "d",
    title: "Куликова Светлана",
    subtitle: "Повар ГЦ",
    disabledReason: "день закрыт",
  },
  { id: "e", title: "Легостаев Михаил", subtitle: "Шеф повар" },
];

const ALL = { query: "", onlyPending: false };

describe("filterDayItems", () => {
  it("без фильтра показываем всех", () => {
    assert.equal(filterDayItems(rows, ALL).length, rows.length);
  });

  it("«только незаполненные» прячет и заполненных, и закрытых", () => {
    // Закрытую строку заполнить нельзя, поэтому в списке «осталось
    // сделать» ей не место — иначе счётчик никогда не дойдёт до нуля.
    const got = filterDayItems(rows, { ...ALL, onlyPending: true });
    assert.deepEqual(got.map((r) => r.id), ["a", "c", "e"]);
  });

  it("поиск по фамилии", () => {
    const got = filterDayItems(rows, { ...ALL, query: "кулаг" });
    assert.deepEqual(got.map((r) => r.id), ["c"]);
  });

  it("поиск по должности — людей помнят и так", () => {
    const got = filterDayItems(rows, { ...ALL, query: "повар" });
    assert.deepEqual(got.map((r) => r.id), ["b", "d", "e"]);
  });

  it("регистр и лишние пробелы не мешают", () => {
    assert.deepEqual(
      filterDayItems(rows, { ...ALL, query: "  ДЕНИС  " }).map((r) => r.id),
      ["a", "b"],
    );
  });

  it("поиск и фильтр складываются", () => {
    const got = filterDayItems(rows, { query: "денис", onlyPending: true });
    assert.deepEqual(got.map((r) => r.id), ["a"], "Денисова уже отмечена");
  });

  it("ничего не найдено — пустой список, а не все строки", () => {
    assert.equal(filterDayItems(rows, { ...ALL, query: "щщщ" }).length, 0);
  });
});

describe("nextUnfilledId", () => {
  it("ведёт к следующей незаполненной ниже", () => {
    assert.equal(nextUnfilledId(rows, "a"), "c");
  });

  it("перепрыгивает заполненные и закрытые", () => {
    // После «c» идут закрытая «d» и свободная «e».
    assert.equal(nextUnfilledId(rows, "c"), "e");
  });

  it("с последней заворачивает к первой незаполненной сверху", () => {
    // Иначе конвейер молча встал бы, оставив пропуски выше незамеченными.
    assert.equal(nextUnfilledId(rows, "e"), "a");
  });

  it("заполнять больше нечего — некуда и вести", () => {
    const done = rows.map((r) => ({ ...r, value: "Зд." }));
    assert.equal(nextUnfilledId(done, "a"), null);
  });

  it("единственная незаполненная строка не ведёт сама на себя", () => {
    const one = [{ id: "x", title: "Один" }];
    assert.equal(nextUnfilledId(one, "x"), null);
  });

  it("неизвестная строка — не падаем", () => {
    assert.equal(nextUnfilledId(rows, "нет-такой"), null);
  });
});
