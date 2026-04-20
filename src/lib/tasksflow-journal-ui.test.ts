import assert from "node:assert/strict";
import test from "node:test";

import { buildTasksflowJournalUi } from "@/lib/tasksflow-journal-ui";

test("cleaning journals expose cleaning-specific wording", () => {
  const ui = buildTasksflowJournalUi({
    code: "cleaning",
    label: "Журнал уборки",
    hasAdapter: true,
  });

  assert.equal(ui.subjectLabel, "Зона уборки");
  assert.match(ui.submitLabel, /уборк/i);
  assert.match(ui.rowSearchPlaceholder, /зонам/i);
});

test("health journals expose employee-specific wording", () => {
  const ui = buildTasksflowJournalUi({
    code: "health_check",
    label: "Журнал здоровья",
    hasAdapter: false,
  });

  assert.equal(ui.subjectLabel, "Сотрудник");
  assert.match(ui.titlePlaceholder, /осмотр/i);
  assert.match(ui.submitLabel, /здоров/i);
});

test("unknown journals fall back to generic wording with journal label", () => {
  const ui = buildTasksflowJournalUi({
    code: "custom_unknown",
    label: "Журнал контроля",
    hasAdapter: false,
  });

  assert.equal(ui.subjectLabel, "Строка журнала");
  assert.match(ui.submitLabel, /Журнал контроля/i);
  assert.match(ui.titlePlaceholder, /Журнал контроля/i);
});
