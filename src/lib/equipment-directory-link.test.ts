import assert from "node:assert/strict";
import test from "node:test";

import {
  getMissingDirectoryEquipment,
  normalizeSourceEquipmentId,
  resolveEquipmentRowName,
} from "@/lib/equipment-directory-link";

const directory = [
  { id: "eq-1", name: "Печь конвекционная" },
  { id: "eq-2", name: "Весы платформенные" },
];

test("имя берётся из справочника, если строка связана", () => {
  assert.equal(
    resolveEquipmentRowName(
      { equipmentName: "Печь", sourceEquipmentId: "eq-1" },
      directory
    ),
    "Печь конвекционная"
  );
});

test("удалённая из справочника единица сохраняет имя документа", () => {
  assert.equal(
    resolveEquipmentRowName(
      { equipmentName: "Старая печь", sourceEquipmentId: "eq-404" },
      directory
    ),
    "Старая печь"
  );
});

test("строка без ссылки работает как раньше", () => {
  assert.equal(
    resolveEquipmentRowName({ equipmentName: "Миксер" }, directory),
    "Миксер"
  );
  assert.equal(
    resolveEquipmentRowName(
      { equipmentName: "Миксер", sourceEquipmentId: "  " },
      directory
    ),
    "Миксер"
  );
});

test("недостающее считается по id и по имени", () => {
  assert.deepEqual(
    getMissingDirectoryEquipment(directory, [
      { equipmentName: "Печь конвекционная", sourceEquipmentId: "eq-1" },
    ]),
    [{ id: "eq-2", name: "Весы платформенные" }]
  );
  // Старый документ без ссылки: совпадение по имени тоже не задваиваем.
  assert.deepEqual(
    getMissingDirectoryEquipment(directory, [
      { equipmentName: "  весы Платформенные " },
    ]),
    [{ id: "eq-1", name: "Печь конвекционная" }]
  );
  assert.deepEqual(getMissingDirectoryEquipment(directory, []), directory);
});

test("normalizeSourceEquipmentId отбрасывает пустое", () => {
  assert.equal(normalizeSourceEquipmentId("eq-1"), "eq-1");
  assert.equal(normalizeSourceEquipmentId(""), null);
  assert.equal(normalizeSourceEquipmentId(null), null);
  assert.equal(normalizeSourceEquipmentId(42), null);
});
