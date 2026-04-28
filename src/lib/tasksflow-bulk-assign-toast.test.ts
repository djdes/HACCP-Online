import assert from "node:assert/strict";
import test from "node:test";

import { formatBulkAssignToastMessage } from "@/lib/tasksflow-bulk-assign-toast";

test("bulk assign toast — header shows новые при created > 0", () => {
  const message = formatBulkAssignToastMessage({
    created: 3,
    alreadyLinked: 2,
    skipped: 1,
    errors: 0,
    documentsCreated: 1,
  });

  assert.ok(
    message.startsWith("Отправлено новых задач: 3"),
    `unexpected: ${message}`
  );
  assert.ok(message.includes("уже назначено: 2"));
  assert.ok(message.includes("пропущено: 1"));
  assert.ok(message.includes("заведено документов: 1"));
});

test("bulk assign toast — «уже назначены ранее», когда нечего создавать", () => {
  const message = formatBulkAssignToastMessage({
    created: 0,
    alreadyLinked: 189,
    skipped: 0,
    errors: 0,
  });

  assert.equal(message, "Все задачи уже назначены ранее (189)");
  assert.ok(!message.includes("отправлены"));
});

test("bulk assign toast — отчётливо говорим о НЕ-отправке при skipped/errors", () => {
  const skippedOnly = formatBulkAssignToastMessage({
    created: 0,
    alreadyLinked: 0,
    skipped: 4,
    errors: 0,
  });
  assert.equal(skippedOnly, "Задачи не отправлены · пропущено: 4");

  const withErrors = formatBulkAssignToastMessage({
    created: 0,
    alreadyLinked: 0,
    skipped: 0,
    errors: 2,
  });
  assert.equal(withErrors, "Задачи не отправлены · ошибок: 2");
});

test("bulk assign toast — пусто, когда вообще нечего делать", () => {
  const message = formatBulkAssignToastMessage({
    created: 0,
    alreadyLinked: 0,
    skipped: 0,
    errors: 0,
  });
  assert.equal(message, "Нечего отправлять — задач для назначения нет");
});
