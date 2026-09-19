import assert from "node:assert/strict";
import test from "node:test";

import {
  dropSdcMarksForMissingItems,
  mergeSdcEntries,
  normalizeSdcConfig,
  resolveSdcSignerId,
  resolveSdcSignerName,
} from "./sanitary-day-checklist-document";

test("отметки двух заполнявших сливаются в одну картину", () => {
  const merged = mergeSdcEntries([
    { data: { marks: { a: "10:00" }, done: { a: true } } },
    { data: { marks: { b: "11:30" }, done: { b: true } } },
  ]);
  assert.deepEqual(merged.marks, { a: "10:00", b: "11:30" });
  assert.deepEqual(merged.done, { a: true, b: true });
});

test("пустая отметка не затирает заполненную", () => {
  const merged = mergeSdcEntries([
    { data: { marks: { a: "10:00" }, done: {} } },
    { data: { marks: { a: "" }, done: {} } },
  ]);
  assert.equal(merged.marks.a, "10:00");
});

test("отметки удалённых пунктов вычищаются", () => {
  const cleaned = dropSdcMarksForMissingItems(
    { marks: { a: "10:00", gone: "12:00" }, done: { a: true, gone: true } },
    ["a"]
  );
  assert.deepEqual(cleaned.marks, { a: "10:00" });
  assert.deepEqual(cleaned.done, { a: true });
});

const users = [{ id: "u1", name: "Иванова И.И." }];

test("подписант читается по id даже после переименования", () => {
  const config = normalizeSdcConfig({
    responsibleUserId: "u1",
    responsibleName: "Петрова П.П.",
  });
  assert.equal(
    resolveSdcSignerName(config.responsibleUserId, config.responsibleName, users),
    "Иванова И.И."
  );
  assert.equal(
    resolveSdcSignerId(config.responsibleUserId, config.responsibleName, users),
    "u1"
  );
});

test("старый документ без id читается по имени", () => {
  const config = normalizeSdcConfig({ responsibleName: "Иванова И.И." });
  assert.equal(config.responsibleUserId, "");
  assert.equal(
    resolveSdcSignerName(config.responsibleUserId, config.responsibleName, users),
    "Иванова И.И."
  );
  assert.equal(
    resolveSdcSignerId(config.responsibleUserId, config.responsibleName, users),
    "u1"
  );
});
