import assert from "node:assert/strict";
import test from "node:test";

import { normalizeComplaintConfig } from "@/lib/complaint-document";
import { CONTROL_PERIODICITY_CONFIG_KEY } from "@/lib/control-periodicity";
import {
  DOCUMENT_HEADER_CONFIG_KEYS,
  carryDocumentHeaderFields,
  withoutDocumentHeaderFields,
} from "@/lib/journal-header-carry";
import {
  HEADER_TITLE_CONFIG_KEY,
  HEADER_TITLE_MAX,
  readHeaderTitleOverride,
  sanitizeHeaderTitle,
} from "@/lib/journal-header-title";
import { ORG_HEADER_NAME_CONFIG_KEY } from "@/lib/org-journal-name";

/**
 * Поля шапки документа переживают любую перезапись конфига: сохранение
 * строк, отметку из TasksFlow, каскад ответственных.
 */

test("ключи шапки совпадают с константами модулей-владельцев", () => {
  assert.deepEqual(
    [...DOCUMENT_HEADER_CONFIG_KEYS].sort(),
    [CONTROL_PERIODICITY_CONFIG_KEY, ORG_HEADER_NAME_CONFIG_KEY, HEADER_TITLE_CONFIG_KEY].sort()
  );
});

test("сохранение строк без полей шапки не стирает их", () => {
  const previous = { rows: [], headerOrgName: "Кафе у дома", headerTitle: "Журнал цеха 2", controlPeriodicity: "" };
  const next = { rows: [{ id: "r1" }] };
  assert.deepEqual(carryDocumentHeaderFields(previous, next), {
    rows: [{ id: "r1" }],
    headerOrgName: "Кафе у дома",
    headerTitle: "Журнал цеха 2",
    controlPeriodicity: "",
  });
});

test("нормализатор журнала выкидывает поля шапки — перенос возвращает их", () => {
  const previous = { rows: [], headerOrgName: "Кафе у дома" };
  const rewritten = { ...normalizeComplaintConfig(previous), rows: [{ id: "new" }] };
  assert.equal((rewritten as Record<string, unknown>).headerOrgName, undefined);
  const carried = carryDocumentHeaderFields(previous, rewritten) as Record<string, unknown>;
  assert.equal(carried.headerOrgName, "Кафе у дома");
});

test("присланное значение уважается, в том числе пустое", () => {
  const previous = { headerOrgName: "Старое", controlPeriodicity: "Ежедневно" };
  const next = { headerOrgName: "", controlPeriodicity: "Раз в смену" };
  assert.equal(carryDocumentHeaderFields(previous, next), next);
});

test("не объект — ничего не переносим", () => {
  const next = { rows: [] };
  assert.equal(carryDocumentHeaderFields(null, next), next);
  assert.equal(carryDocumentHeaderFields([], next), next);
  assert.equal(carryDocumentHeaderFields({ headerTitle: "X" }, null), null);
  assert.deepEqual(carryDocumentHeaderFields({ headerTitle: "X" }, [1]), [1]);
});

test("устаревшая копия клиента не попадает в запись", () => {
  const stale = { rows: [], headerOrgName: "Старое", headerTitle: "Старое", controlPeriodicity: "Старое", keep: 1 };
  assert.deepEqual(withoutDocumentHeaderFields(stale), { rows: [], keep: 1 });
  const clean = { rows: [] };
  assert.equal(withoutDocumentHeaderFields(clean), clean);
  assert.equal(withoutDocumentHeaderFields(null), null);
});

test("название документа из шапки: sanitize и чтение", () => {
  assert.equal(sanitizeHeaderTitle("  Журнал   цеха\n2 "), "Журнал цеха 2");
  assert.equal(sanitizeHeaderTitle(7), "");
  assert.equal(sanitizeHeaderTitle("я".repeat(500)).length, HEADER_TITLE_MAX);
  assert.equal(readHeaderTitleOverride({ [HEADER_TITLE_CONFIG_KEY]: "  " }), null);
  assert.equal(readHeaderTitleOverride({ [HEADER_TITLE_CONFIG_KEY]: "Журнал цеха 2" }), "Журнал цеха 2");
  assert.equal(readHeaderTitleOverride("x"), null);
});
