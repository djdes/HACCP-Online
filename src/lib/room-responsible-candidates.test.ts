import assert from "node:assert/strict";
import test from "node:test";

import {
  groupRoomResponsibleCandidates,
  pluralRooms,
  roleTier,
} from "./room-responsible-candidates";

const users = [
  { id: "a", name: "Яна Админ", role: "owner", isRoot: false },
  { id: "m", name: "Мария Менеджер", role: "manager" },
  { id: "c", name: "Олег Шеф", role: "head_chef" },
  { id: "u", name: "Анна Уборщица", role: "cook", jobPosition: { name: "Уборщик" } },
  { id: "k", name: "Пётр Повар", role: "cook", positionTitle: "Повар" },
];

test("roleTier", () => {
  assert.equal(roleTier({ role: "cook", isRoot: true }), 3);
  assert.equal(roleTier({ role: "owner" }), 3);
  assert.equal(roleTier({ role: "manager" }), 2);
  assert.equal(roleTier({ role: "technologist" }), 1);
  assert.equal(roleTier({ role: "waiter" }), 0);
});

test("уборщики: должность по ключу → Рекомендуем, сотрудник → Можно, руководитель → Не рекомендуем", () => {
  const g = groupRoomResponsibleCandidates(users, "cleaner");
  assert.deepEqual(g.recommended.map((c) => c.user.id), ["u"]);
  assert.deepEqual(g.ok.map((c) => c.user.id), ["k"]);
  assert.deepEqual(
    g.notRecommended.map((c) => c.user.id).sort(),
    ["a", "c", "m"],
  );
});

test("проверяющие: tier ≥ 2 → Рекомендуем, tier 1 → Можно, остальные → Не рекомендуем", () => {
  const g = groupRoomResponsibleCandidates(users, "verifier");
  assert.deepEqual(g.recommended.map((c) => c.user.id).sort(), ["a", "m"]);
  assert.deepEqual(g.ok.map((c) => c.user.id), ["c"]);
  assert.deepEqual(g.notRecommended.map((c) => c.user.id).sort(), ["k", "u"]);
});

test("подсказка нагрузки и сортировка по имени", () => {
  const g = groupRoomResponsibleCandidates(users, "cleaner", new Map([["u", 3]]));
  assert.match(g.recommended[0].reason, /убирает 3 помещения/);
  const names = g.notRecommended.map((c) => c.user.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "ru")));
});

test("pluralRooms", () => {
  assert.equal(pluralRooms(1), "помещение");
  assert.equal(pluralRooms(2), "помещения");
  assert.equal(pluralRooms(5), "помещений");
  assert.equal(pluralRooms(11), "помещений");
  assert.equal(pluralRooms(21), "помещение");
});
