import assert from "node:assert/strict";
import test from "node:test";

import {
  JOURNAL_COLUMN_LABEL_MAX,
  applyColumnsToConfig,
  columnsConfigFromResolved,
  legacyFlagsFromColumns,
  parseOrgColumnDefaults,
  resolveColumns,
  sanitizeColumnsConfig,
  syncColumnsWithLegacyFlags,
  visibleColumns,
  withOrgColumnDefault,
} from "@/lib/journal-columns";

const keys = (columns: Array<{ key: string }>) => columns.map((column) => column.key);

test("реестр: 11 колонок бракеража готовой продукции и 11 — скоропорта", () => {
  assert.equal(resolveColumns("finished_product", {}).length, 11);
  assert.equal(resolveColumns("perishable_rejection", {}).length, 11);
  assert.deepEqual(resolveColumns("hygiene", {}), []);
});

test("старый документ без columns выглядит как раньше (флаги showX, showNote по умолчанию true)", () => {
  assert.deepEqual(keys(visibleColumns("finished_product", {})), [
    "production",
    "rejection",
    "name",
    "organoleptic",
    "release",
    "responsible",
    "inspector",
  ]);
  assert.ok(keys(visibleColumns("finished_product", { showProductTemp: true, showCourierTime: true })).includes("temp"));
  assert.ok(keys(visibleColumns("perishable_rejection", {})).includes("note"));
  assert.ok(!keys(visibleColumns("perishable_rejection", { showNote: false })).includes("note"));
});

test("приоритет: columns документа → общий вариант организации → флаги → реестр", () => {
  const doc = { showProductTemp: true, columns: { hidden: ["temp"], labels: {} } };
  assert.ok(!keys(visibleColumns("finished_product", doc)).includes("temp"));
  const org = { hidden: ["responsible"], labels: { name: "Блюдо" } };
  const withOrg = resolveColumns("finished_product", { showProductTemp: false }, org);
  assert.equal(withOrg.find((column) => column.key === "responsible")?.hidden, true);
  assert.equal(withOrg.find((column) => column.key === "name")?.label, "Блюдо");
  // В наборе перечислены скрытые колонки: «T°C» в нём нет — значит видна,
  // хотя старый флаг документа её выключал.
  assert.equal(withOrg.find((column) => column.key === "temp")?.hidden, false, "общий вариант важнее старого флага");
  const ownWins = resolveColumns("finished_product", { columns: { hidden: [], labels: {} } }, org);
  assert.equal(ownWins.find((column) => column.key === "responsible")?.hidden, false);
});

test("обязательную колонку скрыть нельзя, неизвестные ключи отбрасываются", () => {
  const sanitized = sanitizeColumnsConfig("perishable_rejection", {
    hidden: ["product", "note", "nope", "note"],
    labels: { nope: "x", product: "  Продукт  ", note: "" },
  });
  assert.deepEqual(sanitized, { hidden: ["note"], labels: { product: "Продукт" } });
  assert.equal(sanitizeColumnsConfig("hygiene", { hidden: ["x"] }), null);
  assert.equal(sanitizeColumnsConfig("finished_product", "broken"), null);
});

test("подпись ограничена и не хранится, если совпадает со стандартной", () => {
  const long = "а".repeat(200);
  const sanitized = sanitizeColumnsConfig("finished_product", {
    hidden: [],
    labels: { organoleptic: long, release: "Разрешение к реализации (время)" },
  });
  assert.equal(sanitized?.labels.organoleptic.length, JOURNAL_COLUMN_LABEL_MAX);
  assert.equal("release" in (sanitized?.labels ?? {}), false);
});

test("подписи зависят от режима документа", () => {
  const semi = resolveColumns("finished_product", { fieldNameMode: "semi", inspectorMode: "commission_signatures" });
  assert.equal(semi.find((column) => column.key === "name")?.label, "Наименование полуфабриката");
  assert.equal(semi.find((column) => column.key === "inspector")?.label, "Подписи членов комиссии");
});

test("legacyFlagsFromColumns ↔ columnsConfigFromResolved", () => {
  assert.deepEqual(legacyFlagsFromColumns("finished_product", { hidden: ["temp", "oxygen"], labels: {} }), {
    showProductTemp: false,
    showCorrectiveAction: true,
    showOxygenLevel: false,
    showCourierTime: true,
  });
  assert.deepEqual(legacyFlagsFromColumns("perishable_rejection", { hidden: ["note"], labels: {} }), { showNote: false });

  const resolved = resolveColumns("finished_product", { columns: { hidden: ["courier"], labels: { name: "Блюдо" } } });
  assert.deepEqual(columnsConfigFromResolved(resolved), {
    hidden: ["temp", "corrective", "oxygen", "courier"].filter((key) => resolved.find((c) => c.key === key)?.hidden),
    labels: { name: "Блюдо" },
  });
});

test("общий набор организации: мусор и журналы без реестра отбрасываются", () => {
  const parsed = parseOrgColumnDefaults({
    finished_product: { hidden: ["temp", "name"], labels: { name: "Блюдо" } },
    hygiene: { hidden: ["x"] },
    perishable_rejection: "broken",
  });
  assert.deepEqual(parsed, { finished_product: { hidden: ["temp"], labels: { name: "Блюдо" } } });
  assert.deepEqual(parseOrgColumnDefaults(null), {});
});

test("набор в конфиг документа: флаги showX синхронизируются", () => {
  const config = applyColumnsToConfig("finished_product", { rows: [], showProductTemp: true }, {
    hidden: ["temp", "responsible"],
    labels: {},
  });
  assert.equal(config.showProductTemp, false);
  assert.deepEqual((config.columns as { hidden: string[] }).hidden, ["temp", "responsible"]);
  assert.deepEqual(config.rows, []);
});

test("новый документ получает общий набор; свой набор документа не трогается", () => {
  const defaults = { perishable_rejection: { hidden: ["note"], labels: { product: "Продукт" } } };
  const created = withOrgColumnDefault("perishable_rejection", { showNote: true }, defaults) as Record<string, unknown>;
  assert.equal(created.showNote, false, "без respectFlags общий набор важнее флага по умолчанию");
  assert.deepEqual(created.columns, { hidden: ["note"], labels: { product: "Продукт" } });
  const own = { columns: { hidden: [], labels: {} } };
  assert.equal(withOrgColumnDefault("perishable_rejection", own, defaults), own);
  assert.equal(withOrgColumnDefault("finished_product", { rows: [] }, defaults)?.columns, undefined);
});

test("флаги из диалога создания важнее общего набора для своих колонок", () => {
  const defaults = { perishable_rejection: { hidden: ["note", "document"], labels: {} } };
  const created = withOrgColumnDefault("perishable_rejection", { showNote: true }, defaults, {
    respectFlags: true,
  }) as Record<string, unknown>;
  assert.equal(created.showNote, true);
  assert.deepEqual((created.columns as { hidden: string[] }).hidden, ["document"]);
});

test("настройки из списка документов: переключатель флага меняет набор колонок", () => {
  const synced = syncColumnsWithLegacyFlags("finished_product", {
    columns: { hidden: ["temp"], labels: { name: "Блюдо" } },
    showProductTemp: true,
    showCourierTime: false,
  });
  assert.deepEqual(synced.columns, { hidden: ["courier"], labels: { name: "Блюдо" } });
  const noColumns = { showProductTemp: true };
  assert.equal(syncColumnsWithLegacyFlags("finished_product", noColumns), noColumns);
});
