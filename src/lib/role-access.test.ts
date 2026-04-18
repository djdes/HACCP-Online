import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessMiniPath,
  canAccessWebPath,
  getBotMiniAppLabel,
  getWebHomeHref,
  hasFullWorkspaceAccess,
} from "@/lib/role-access";

test("hasFullWorkspaceAccess treats management and root as full-access users", () => {
  assert.equal(hasFullWorkspaceAccess({ role: "manager", isRoot: false }), true);
  assert.equal(
    hasFullWorkspaceAccess({ role: "head_chef", isRoot: false }),
    true
  );
  assert.equal(hasFullWorkspaceAccess({ role: "cook", isRoot: false }), false);
  assert.equal(hasFullWorkspaceAccess({ role: "waiter", isRoot: false }), false);
  assert.equal(hasFullWorkspaceAccess({ role: "cook", isRoot: true }), true);
});

test("staff web access is limited to journals", () => {
  const staff = { role: "cook", isRoot: false };

  assert.equal(canAccessWebPath(staff, "/journals"), true);
  assert.equal(canAccessWebPath(staff, "/journals/hygiene"), true);
  assert.equal(canAccessWebPath(staff, "/settings"), false);
  assert.equal(canAccessWebPath(staff, "/settings/users"), false);
  assert.equal(canAccessWebPath(staff, "/dashboard"), false);
  assert.equal(canAccessWebPath(staff, "/reports"), false);
  assert.equal(getWebHomeHref(staff), "/journals");
});

test("staff mini app access is limited to journals and journal CTA copy", () => {
  const staff = { role: "waiter", isRoot: false };
  const manager = { role: "manager", isRoot: false };

  assert.equal(canAccessMiniPath(staff, "/mini"), true);
  assert.equal(canAccessMiniPath(staff, "/mini/journals/hygiene"), true);
  assert.equal(canAccessMiniPath(staff, "/mini/me"), false);
  assert.equal(canAccessMiniPath(staff, "/mini/shift"), false);
  assert.equal(getBotMiniAppLabel(staff), "Открыть журналы");

  assert.equal(canAccessMiniPath(manager, "/mini/me"), true);
  assert.equal(getBotMiniAppLabel(manager), "Открыть кабинет");
  assert.equal(getWebHomeHref(manager), "/dashboard");
});
