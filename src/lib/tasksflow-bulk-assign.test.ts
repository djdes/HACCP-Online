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
  const result = selectRowsForBulkAssign({
    journalCode: "fryer_oil",
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
    journalCode: "fryer_oil",
    rows: [row("u1-row", "u1"), row("u2-row", "u2")],
    takenRowKeys: new Set(["u2-row"]),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1", "u2"]),
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.alreadyLinked, 1);
  assert.equal(result.skipReason, undefined);
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

test("per-employee journals skip atomically when a scheduled employee is not linked", () => {
  const result = selectRowsForBulkAssign({
    journalCode: "health_check",
    rows: [row("u1-row", "u1"), row("u2-row", "u2")],
    takenRowKeys: new Set(),
    onDutyUserIds: new Set(["u1", "u2"]),
    linkedUserIds: new Set(["u1"]),
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.alreadyLinked, 0);
  assert.match(result.skipReason ?? "", /TasksFlow/);
});

test("bulk row selection reports an empty candidate scope as a hierarchy issue", () => {
  const result = selectRowsForBulkAssign({
    journalCode: "fryer_oil",
    rows: [row("u1-row", "u1")],
    takenRowKeys: new Set(),
    onDutyUserIds: new Set(),
    linkedUserIds: new Set(["u1"]),
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.alreadyLinked, 0);
  assert.match(result.skipReason ?? "", /иерарх/);
});
