import assert from "node:assert/strict";
import test from "node:test";

import { formatBulkAssignToastMessage } from "@/lib/tasksflow-bulk-assign-toast";

test("bulk assign toast says tasks were sent when new tasks were created", () => {
  const message = formatBulkAssignToastMessage({
    created: 3,
    alreadyLinked: 2,
    skipped: 1,
    errors: 0,
    documentsCreated: 1,
  });

  assert.equal(
    message,
    "Задачи отправлены · создано: 3 · уже назначено: 2 · пропущено: 1 · заведено документов: 1"
  );
});

test("bulk assign toast does not claim sending when everything was already assigned", () => {
  const message = formatBulkAssignToastMessage({
    created: 0,
    alreadyLinked: 189,
    skipped: 0,
    errors: 0,
  });

  assert.equal(message, "Новых задач нет · уже назначено: 189");
  assert.ok(!message.includes("отправлены"));
});

test("bulk assign toast reports a no-send outcome for skipped rows", () => {
  const message = formatBulkAssignToastMessage({
    created: 0,
    alreadyLinked: 0,
    skipped: 4,
    errors: 0,
  });

  assert.equal(message, "Задачи не отправлены · пропущено: 4");
});
