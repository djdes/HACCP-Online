import assert from "node:assert/strict";
import test from "node:test";

import { checkEntryScope, hasFullDocumentAccess } from "@/lib/journal-entry-write";

/**
 * Кто какие строки журнала заполняет.
 *
 * Правило владельца: сотрудник видит и заполняет только то, что нужно
 * ему и только за сегодня; ответственный за журнал и руководство правят
 * всё, включая прошлые дни.
 */

const TODAY = "2026-09-01";
const YESTERDAY = "2026-08-31";

const cook = { id: "cook_1", role: "cook", isRoot: false };
const manager = { id: "mgr_1", role: "manager", isRoot: false };
const root = { id: "root_1", role: "cook", isRoot: true };

test("employee fills their own row for today", () => {
  const decision = checkEntryScope({
    actor: cook,
    employeeId: cook.id,
    entryDayKey: TODAY,
    todayKey: TODAY,
  });

  assert.deepEqual(decision, { allowed: true });
});

test("employee cannot fill a colleague's row", () => {
  // Иначе подпись коллеги в журнале гигиены подделывается прямым fetch'ем.
  const decision = checkEntryScope({
    actor: cook,
    employeeId: "cook_2",
    entryDayKey: TODAY,
    todayKey: TODAY,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.code, "foreign_row");
});

test("employee cannot backfill yesterday", () => {
  // Журнал подтверждает, что контроль был проведён В ТОТ день; запись
  // задним числом такого подтверждения не даёт.
  const decision = checkEntryScope({
    actor: cook,
    employeeId: cook.id,
    entryDayKey: YESTERDAY,
    todayKey: TODAY,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.code, "not_today");
});

test("management fills any row for any day", () => {
  for (const day of [TODAY, YESTERDAY]) {
    assert.deepEqual(
      checkEntryScope({
        actor: manager,
        employeeId: "cook_2",
        entryDayKey: day,
        todayKey: TODAY,
      }),
      { allowed: true }
    );
  }
});

test("the journal's responsible person gets the same reach as management", () => {
  // Ответственный исправляет чужие ошибки, в том числе вчерашние, — даже
  // если его роль рядовая.
  assert.deepEqual(
    checkEntryScope({
      actor: cook,
      responsibleUserId: cook.id,
      employeeId: "cook_2",
      entryDayKey: YESTERDAY,
      todayKey: TODAY,
    }),
    { allowed: true }
  );
});

test("being responsible for another document grants nothing here", () => {
  const decision = checkEntryScope({
    actor: cook,
    responsibleUserId: "someone_else",
    employeeId: "cook_2",
    entryDayKey: TODAY,
    todayKey: TODAY,
  });

  assert.equal(decision.allowed, false);
});

test("hasFullDocumentAccess covers root, management and the responsible", () => {
  assert.equal(hasFullDocumentAccess({ actor: root }), true);
  assert.equal(hasFullDocumentAccess({ actor: manager }), true);
  assert.equal(
    hasFullDocumentAccess({ actor: cook, responsibleUserId: cook.id }),
    true
  );
  assert.equal(hasFullDocumentAccess({ actor: cook }), false);
  assert.equal(
    hasFullDocumentAccess({ actor: cook, responsibleUserId: null }),
    false
  );
});
