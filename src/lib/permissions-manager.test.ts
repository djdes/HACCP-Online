/**
 * Кто считается руководителем в Mini App и в ответе бота.
 *
 * Тест закрепляет конкретную поломку: признак руководителя стоял на
 * `dashboard.view`, а это право входит в дефолтный набор ЛИНЕЙНОГО
 * персонала. Из-за этого повар, открывший приложение, видел сводку по
 * всему заведению вместо своих задач — проверено на проде, 25 из 25
 * сотрудников попадали в режим руководителя.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MANAGEMENT_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  MANAGER_PERMISSIONS,
  isManagerLikePermissions,
  resolveActorPermissions,
  type Permission,
} from "@/lib/permissions";

test("повар с дефолтными правами — не руководитель", () => {
  const perms = resolveActorPermissions({
    userPermissionsJson: null,
    positionPermissionsJson: null,
    positionCategoryKey: "staff",
  });
  assert.equal(isManagerLikePermissions(perms), false);
});

test("управляющая с дефолтными правами — руководитель", () => {
  const perms = resolveActorPermissions({
    userPermissionsJson: null,
    positionPermissionsJson: null,
    positionCategoryKey: "management",
  });
  assert.equal(isManagerLikePermissions(perms), true);
});

test("заведующая: приёмка задач и сотрудники — руководитель", () => {
  const perms = new Set<Permission>(["staff.view", "journals.fill"]);
  assert.equal(isManagerLikePermissions(perms), true);
});

test("`dashboard.view` сам по себе больше не делает руководителем", () => {
  const perms = new Set<Permission>(["dashboard.view", "journals.fill"]);
  assert.equal(isManagerLikePermissions(perms), false);
});

test("ни одно право руководителя не входит в дефолтный набор сотрудника", () => {
  const staff = new Set<string>(DEFAULT_STAFF_PERMISSIONS);
  const leaked = MANAGER_PERMISSIONS.filter((permission) => staff.has(permission));
  assert.deepEqual(leaked, [], `в наборе сотрудника оказались права руководителя: ${leaked.join(", ")}`);
});

test("у руководства хотя бы одно из этих прав есть", () => {
  const management = new Set<string>(DEFAULT_MANAGEMENT_PERMISSIONS);
  assert.ok(MANAGER_PERMISSIONS.some((permission) => management.has(permission)));
});

test("пустой набор прав — не руководитель", () => {
  assert.equal(isManagerLikePermissions(new Set<Permission>()), false);
});

test("управленческая роль при должности из категории «персонал» — руководитель", () => {
  // Реальный случай с прода: шеф-повар с ролью head_chef, но должностью
  // в категории «персонал». По одним правам он выглядел бы линейным.
  const perms = resolveActorPermissions({
    userPermissionsJson: null,
    positionPermissionsJson: null,
    positionCategoryKey: "staff",
  });
  assert.equal(isManagerLikePermissions(perms, "head_chef"), true);
  assert.equal(isManagerLikePermissions(perms, "manager"), true);
});

test("роль линейного сотрудника режим руководителя не даёт", () => {
  const perms = resolveActorPermissions({
    userPermissionsJson: null,
    positionPermissionsJson: null,
    positionCategoryKey: "staff",
  });
  for (const role of ["cook", "waiter", "cleaner", "operator", "", null]) {
    assert.equal(isManagerLikePermissions(perms, role), false, `роль ${role}`);
  }
});
