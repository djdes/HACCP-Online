import assert from "node:assert/strict";
import test from "node:test";

import {
  ENTRY_MOVE_CONFLICT_ERROR,
  ENTRY_MOVE_NOT_FOUND_ERROR,
  decideEntryMove,
} from "@/lib/tracked-document";

test("перенос строки на свободную пару (сотрудник, дата) обновляет её по id", () => {
  assert.deepEqual(
    decideEntryMove({
      documentId: "doc-1",
      current: { id: "entry-1", documentId: "doc-1" },
      occupant: null,
    }),
    { action: "update", entryId: "entry-1" }
  );
});

test("сохранение строки на её же месте не считается конфликтом", () => {
  assert.deepEqual(
    decideEntryMove({
      documentId: "doc-1",
      current: { id: "entry-1", documentId: "doc-1" },
      occupant: { id: "entry-1" },
    }),
    { action: "update", entryId: "entry-1" }
  );
});

test("занятая пара (сотрудник, дата) — конфликт, чужая запись не затирается", () => {
  assert.deepEqual(
    decideEntryMove({
      documentId: "doc-1",
      current: { id: "entry-1", documentId: "doc-1" },
      occupant: { id: "entry-2" },
    }),
    { action: "conflict", error: ENTRY_MOVE_CONFLICT_ERROR }
  );
});

test("строка из чужого документа или несуществующая — не найдена", () => {
  assert.deepEqual(
    decideEntryMove({
      documentId: "doc-1",
      current: { id: "entry-1", documentId: "doc-2" },
      occupant: null,
    }),
    { action: "not_found", error: ENTRY_MOVE_NOT_FOUND_ERROR }
  );
  assert.deepEqual(
    decideEntryMove({ documentId: "doc-1", current: null, occupant: null }),
    { action: "not_found", error: ENTRY_MOVE_NOT_FOUND_ERROR }
  );
});
