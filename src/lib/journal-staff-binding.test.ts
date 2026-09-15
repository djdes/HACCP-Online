import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeJournalDocumentStaffState,
  normalizeJournalStaffBoundConfig,
  pickFallbackResponsibleUser,
  reconcileNamedStaffSelection,
  type StaffBindingUser,
} from "@/lib/journal-staff-binding";

/**
 * Ответственный документа больше не подставляется «кем-нибудь»:
 * сохранение ячейки не должно делать владельца ответственным журнала.
 */

const owner: StaffBindingUser = { id: "owner", name: "boss@mail.ru", role: "owner" };
const manager: StaffBindingUser = { id: "mgr", name: "Анна Заведующая", role: "manager" };
const cook: StaffBindingUser = { id: "cook", name: "Борис Повар", role: "cook" };
const roster = [owner, manager, cook];

test("без выбора и без запрета — исполнитель из ростера, не владелец-почта", () => {
  assert.equal(pickFallbackResponsibleUser(roster)?.id, "cook");
  assert.equal(pickFallbackResponsibleUser([owner])?.id, "owner");
  assert.equal(pickFallbackResponsibleUser([]), null);
});

test("allowFallbackUser: false — никто не назначается молча", () => {
  const state = normalizeJournalDocumentStaffState(
    "hygiene",
    { config: {}, responsibleUserId: null },
    roster,
    { allowFallbackUser: false }
  );
  assert.equal(state.responsibleUserId, null);
});

test("явный id сотрудника организации сохраняется", () => {
  const state = normalizeJournalDocumentStaffState(
    "hygiene",
    { config: {}, responsibleUserId: "mgr" },
    roster,
    { allowFallbackUser: false }
  );
  assert.equal(state.responsibleUserId, "mgr");
});

test("чужой id (не из ростера) не превращается во владельца", () => {
  const state = normalizeJournalDocumentStaffState(
    "hygiene",
    { config: {}, responsibleUserId: "foreign-user" },
    roster,
    { allowFallbackUser: false }
  );
  assert.equal(state.responsibleUserId, null);
});

test("ответственный из конфига (defaultResponsibleUserId) подхватывается без подстановок", () => {
  const state = normalizeJournalDocumentStaffState(
    "complaint_register",
    { config: { defaultResponsibleUserId: "cook" }, responsibleUserId: null },
    roster,
    { allowFallbackUser: false }
  );
  assert.equal(state.responsibleUserId, "cook");
});

test("пустое имя в поле бланка остаётся пустым, заглушка заменяется", () => {
  const empty = reconcileNamedStaffSelection(roster, {
    userName: "",
    allowFallbackUser: "placeholder-only",
  });
  assert.equal(empty.userId, null);

  const placeholder = reconcileNamedStaffSelection(roster, {
    userName: "Иванов И.И.",
    allowFallbackUser: "placeholder-only",
  });
  assert.equal(placeholder.userId, "cook");

  const approver = reconcileNamedStaffSelection(roster, {
    userName: "Иванов И.И.",
    allowFallbackUser: "placeholder-only",
    fallbackKind: "verifier",
  });
  assert.equal(approver.userId, "mgr");
});

test("сохранение конфига дезсредств не вписывает ответственного в пустые строки", () => {
  const config = normalizeJournalStaffBoundConfig(
    "disinfectant_usage",
    {
      responsibleEmployee: "",
      receipts: [{ id: "r1", date: "2026-09-01", responsibleEmployee: "" }],
    },
    roster
  ) as {
    responsibleEmployeeId: string | null;
    receipts: Array<{ responsibleEmployeeId: string | null }>;
  };
  assert.equal(config.responsibleEmployeeId, null);
  assert.equal(config.receipts[0]?.responsibleEmployeeId, null);
});
