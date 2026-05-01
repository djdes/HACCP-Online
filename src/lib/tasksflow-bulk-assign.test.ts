import assert from "node:assert/strict";
import test from "node:test";

import {
  selectBulkJournalTemplates,
  selectRowsForBulkAssign,
} from "@/lib/tasksflow-bulk-assign";
import type { AdapterRow } from "@/lib/tasksflow-adapters/types";

function row(rowKey: string, responsibleUserId: string | null): AdapterRow {
  return {
    rowKey,
    label: rowKey,
    responsibleUserId,
  };
}

test("selectBulkJournalTemplates uses every enabled unfilled template", () => {
  const result = selectBulkJournalTemplates({
    templates: [
      { id: "tpl-hygiene", code: "hygiene", name: "Hygiene" },
      { id: "tpl-fryer", code: "fryer_oil", name: "Fryer oil" },
      { id: "tpl-med", code: "med_books", name: "Med books" },
      { id: "tpl-uv", code: "uv_lamp_runtime", name: "UV" },
    ],
    disabledCodes: new Set(["uv_lamp_runtime"]),
    filledTemplateIds: new Set(["tpl-med"]),
    scope: null,
  });

  assert.deepEqual(
    result.targets.map((template) => template.code),
    ["hygiene", "fryer_oil"]
  );
  assert.deepEqual(result.skipped, []);
});

test("selectBulkJournalTemplates skips journals not allowed by hierarchy", () => {
  const result = selectBulkJournalTemplates({
    templates: [
      { id: "tpl-cleaning", code: "cleaning", name: "Cleaning" },
      { id: "tpl-climate", code: "climate_control", name: "Climate" },
    ],
    disabledCodes: new Set(),
    filledTemplateIds: new Set(),
    scope: { assignableJournalCodes: ["cleaning"] },
  });

  assert.deepEqual(
    result.targets.map((template) => template.code),
    ["cleaning"]
  );
  assert.deepEqual(result.skipped[0]?.template.code, "climate_control");
});

test("single-per-day journals create only one available row", () => {
  // med_books — НЕ team-fan-out (один ответственный ведёт за всех):
  // подходит для проверки «берём первого подходящего».
  const result = selectRowsForBulkAssign({
    journalCode: "med_books",
    rows: [row("u1-row", "u1"), row("u2-row", "u2")],
    takenRowKeys: new Set(),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1", "u2"]),
  });

  assert.deepEqual(
    result.rows.map((item) => item.rowKey),
    ["u1-row"]
  );
  assert.equal(result.alreadyLinked, 0);
  assert.equal(result.skipReason, undefined);
});

test("single-per-day journals do not duplicate an existing journal task", () => {
  const result = selectRowsForBulkAssign({
    journalCode: "med_books",
    rows: [row("u1-row", "u1"), row("u2-row", "u2")],
    takenRowKeys: new Set(["u2-row"]),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1", "u2"]),
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.alreadyLinked, 1);
  assert.equal(result.skipReason, undefined);
});

test("team fan-out journals create one row per linked employee", () => {
  // cleaning переехал в TEAM_FAN_OUT_CODES (2026-04-30): любой из
  // смены может закрыть запись, поэтому задача рассылается всем.
  const result = selectRowsForBulkAssign({
    journalCode: "cleaning",
    rows: [row("u1-row", "u1"), row("u2-row", "u2")],
    takenRowKeys: new Set(),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1", "u2"]),
  });

  assert.deepEqual(
    result.rows.map((item) => item.rowKey).sort(),
    ["u1-row", "u2-row"]
  );
  assert.equal(result.alreadyLinked, 0);
  assert.equal(result.skipReason, undefined);
});

test("team fan-out fallback: responsibles не подходят, но в смене есть linked", () => {
  // Адаптер вернул row с responsibleUserId=u-old (уволенный, не в
  // onDuty). Раньше journal skip'ался с notification. Теперь fallback
  // плодит synthetic rows на каждого linked candidate в скоупе.
  // RowKey в новом формате: `fanout:<journalCode>:<uid>` (per-user dedup).
  const result = selectRowsForBulkAssign({
    journalCode: "cleaning",
    rows: [row("orig-row", "u-old")],
    takenRowKeys: new Set(),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1", "u2"]),
  });

  assert.equal(result.skipReason, undefined);
  assert.equal(result.rows.length, 2);
  const rowKeys = result.rows.map((r) => r.rowKey).sort();
  assert.deepEqual(rowKeys, [
    "fanout:cleaning:u1",
    "fanout:cleaning:u2",
  ]);
  for (const r of result.rows) {
    assert.ok(r.responsibleUserId === "u1" || r.responsibleUserId === "u2");
  }
});

test("per-employee journals create one row for each linked scheduled employee", () => {
  const result = selectRowsForBulkAssign({
    journalCode: "hygiene",
    rows: [row("u1-row", "u1"), row("u2-row", "u2"), row("u3-row", "u3")],
    takenRowKeys: new Set(["u2-row"]),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1", "u2", "u3"]),
  });

  assert.deepEqual(
    result.rows.map((item) => item.rowKey),
    ["u1-row"]
  );
  assert.equal(result.alreadyLinked, 1);
  assert.equal(result.skipReason, undefined);
});

test("per-employee journals send to linked employees, skip unlinked silently", () => {
  // Раньше: атомарный skip всего журнала если хотя бы один сотрудник
  // не привязан к TasksFlow («Не все дежурные ответственные привязаны»).
  // Это плохо: менеджер видит «journal не отправлен», хотя на самом деле
  // 9 из 10 сотрудников привязаны и могли получить задачу.
  // Новое поведение: задача уходит ВСЕМ кто linked. Unlinked — silently
  // пропускаются (отдельная нотификация может попросить менеджера их
  // привязать).
  const result = selectRowsForBulkAssign({
    journalCode: "health_check",
    rows: [row("u1-row", "u1"), row("u2-row", "u2")],
    takenRowKeys: new Set(),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1"]),
  });

  assert.deepEqual(
    result.rows.map((r) => r.rowKey),
    ["u1-row"],
  );
  assert.equal(result.alreadyLinked, 0);
  assert.equal(result.skipReason, undefined);
});

test("bulk row selection reports an empty candidate scope as a hierarchy issue", () => {
  const result = selectRowsForBulkAssign({
    journalCode: "cleaning",
    rows: [row("u1-row", "u1")],
    takenRowKeys: new Set(),
    onDutyUserIds: new Set(),
    linkedUserIds: new Set(["u1"]),
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.alreadyLinked, 0);
  // respectShifts по умолчанию false → текст про «нет активных в зоне»,
  // не про график. Проверяем оба warning'а старого и нового стиля.
  assert.match(result.skipReason ?? "", /зон|иерарх|смен/i);
});
