import assert from "node:assert/strict";
import test from "node:test";

import {
  filterRoster,
  isPlaceholderStaffUser,
  rankRosterForSlot,
  resolveResponsibleChoice,
  type RosterUser,
} from "@/lib/journal-roster";

const owner: RosterUser = { id: "owner", name: "boss@mail.ru", email: "boss@mail.ru", role: "owner" };
const root: RosterUser = { id: "root", name: "Администратор", role: "manager", isRoot: true };
const manager: RosterUser = { id: "mgr", name: "Анна Заведующая", role: "manager", jobPositionName: "Заведующая производством", jobPositionCategory: "management" };
const cook: RosterUser = { id: "cook", name: "Борис Повар", role: "cook", jobPositionName: "Повар", jobPositionCategory: "staff" };
const cleaner: RosterUser = { id: "cleaner", name: "Вера Уборщица", role: "cook", positionTitle: "Уборщица" };

test("заглушки: имя = почта, пустое имя, «Иванов И.И.»", () => {
  assert.equal(isPlaceholderStaffUser(owner), true);
  assert.equal(isPlaceholderStaffUser({ name: "  " }), true);
  assert.equal(isPlaceholderStaffUser({ name: "Иванов И.И." }), true);
  assert.equal(isPlaceholderStaffUser({ name: "x@y.ru" }), true);
  assert.equal(isPlaceholderStaffUser(cook), false);
});

test("filterRoster убирает ROOT всегда, заглушки — если есть другие", () => {
  assert.deepEqual(filterRoster([owner, root, cook]).map((u) => u.id), ["cook"]);
  assert.deepEqual(filterRoster([owner, root]).map((u) => u.id), ["owner"]);
  assert.deepEqual(filterRoster([root]), []);
});

test("исполнитель: должность → линейный персонал → руководство, не владелец и не ROOT", () => {
  const users = [owner, root, manager, cook, cleaner];
  assert.equal(rankRosterForSlot(users, { kind: "filler", positionKeywords: ["уборщ"] })?.id, "cleaner");
  assert.equal(rankRosterForSlot(users, { kind: "filler" })?.id, "cook");
  assert.equal(rankRosterForSlot([owner, root, manager], { kind: "filler" })?.id, "mgr");
  assert.equal(rankRosterForSlot(users, { kind: "filler" }, new Set(["cook", "cleaner"]))?.id, "mgr");
});

test("проверяющий: руководство раньше персонала, повтор разрешён", () => {
  const users = [owner, root, cook, manager];
  assert.equal(rankRosterForSlot(users, { kind: "verifier" })?.id, "mgr");
  assert.equal(rankRosterForSlot(users, { kind: "verifier" }, new Set(["mgr", "cook"]))?.id, "mgr");
});

test("пустой ростер или только ROOT → null", () => {
  assert.equal(rankRosterForSlot([], { kind: "filler" }), null);
  assert.equal(rankRosterForSlot([root], { kind: "verifier" }), null);
  assert.equal(rankRosterForSlot([cook], { kind: "filler" }, new Set(["cook"])), null);
});

test("resolveResponsibleChoice: источник × валидность", () => {
  const org = new Set(["cook", "mgr"]);
  assert.deepEqual(resolveResponsibleChoice({ bodyUserId: "cook", slotUserId: "mgr", orgUserIds: org }), { userId: "cook", source: "body" });
  assert.deepEqual(resolveResponsibleChoice({ bodyUserId: "", slotUserId: "mgr", orgUserIds: org }), { userId: "mgr", source: "slots" });
  assert.deepEqual(resolveResponsibleChoice({ bodyUserId: null, slotUserId: "foreign", orgUserIds: org }), { userId: null, source: "none" });
  assert.deepEqual(resolveResponsibleChoice({ bodyUserId: undefined, orgUserIds: org }), { userId: null, source: "none" });
  const bad = resolveResponsibleChoice({ bodyUserId: "foreign", slotUserId: "mgr", orgUserIds: org });
  assert.ok("error" in bad);
  assert.equal(bad.error.code, "responsible-not-in-org");
});
