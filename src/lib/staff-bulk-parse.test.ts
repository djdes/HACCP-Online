import assert from "node:assert/strict";
import test from "node:test";

import {
  formatWeeklyDaysOff,
  parseStaffRows,
  parseWeeklyDaysOff,
  parseYesNo,
} from "@/lib/staff-bulk-parse";

test("вставка из Excel: табуляция, заголовок отбрасывается", () => {
  const { rows, errors } = parseStaffRows(
    [
      "ФИО\tДолжность\tТелефон",
      "Иванова Мария Петровна\tПовар\t+7 999 123-45-67",
      "Сидоров Пётр\tУборщица\t",
    ].join("\n")
  );

  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].fullName, "Иванова Мария Петровна");
  assert.equal(rows[0].positionName, "Повар");
  assert.equal(rows[1].phone, "");
});

test("телефон необязателен — иначе массовое добавление строже одиночного", () => {
  const { rows, errors } = parseStaffRows("Петров Иван;Повар");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].phone, "");
});

test("строка без должности не проходит и объясняет, кто именно", () => {
  const { rows, errors } = parseStaffRows("Петров Иван");
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Петров Иван/);
});

test("русская точка с запятой понимается как разделитель", () => {
  const { rows } = parseStaffRows("Иванов И;Повар;+79991234567");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].phone, "+79991234567");
});

test("выходные читаются в любом виде, в котором их пишет человек", () => {
  assert.deepEqual(parseWeeklyDaysOff("Сб, Вс"), [5, 6]);
  assert.deepEqual(parseWeeklyDaysOff("сб вс"), [5, 6]);
  assert.deepEqual(parseWeeklyDaysOff("суббота, воскресенье"), [5, 6]);
  assert.deepEqual(parseWeeklyDaysOff("5;6"), [5, 6]);
  assert.deepEqual(parseWeeklyDaysOff("нет"), []);
  assert.deepEqual(parseWeeklyDaysOff(""), []);
  // Мусор не должен ронять всю строку — просто игнорируется.
  assert.deepEqual(parseWeeklyDaysOff("Сб, ???"), [5]);
});

test("выходные печатаются обратно тем же форматом, что читаются", () => {
  const printed = formatWeeklyDaysOff([6, 5]);
  assert.equal(printed, "Сб, Вс");
  assert.deepEqual(parseWeeklyDaysOff(printed), [5, 6]);
});

test("да/нет распознаётся во всех привычных написаниях", () => {
  for (const value of ["да", "Да", "yes", "1", "+", "✓"]) {
    assert.equal(parseYesNo(value), true, value);
  }
  for (const value of ["нет", "", "no", "0", "—"]) {
    assert.equal(parseYesNo(value), false, value);
  }
});

test("полная строка со всеми колонками", () => {
  const { rows } = parseStaffRows(
    "Иванова Мария\tПовар\t+79991234567\tmasha@mail.ru\tСб, Вс\tда"
  );
  assert.deepEqual(rows[0], {
    fullName: "Иванова Мария",
    positionName: "Повар",
    phone: "+79991234567",
    contactEmail: "masha@mail.ru",
    weeklyDaysOff: [5, 6],
    telegramInvite: true,
  });
});
