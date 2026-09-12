import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isNavItemVisible, visibleNavItems } from "@/app/mini/_lib/nav-items";

const ITEMS = [
  { href: "/mini" },
  { href: "/mini/staff", requires: ["staff.view"] },
  { href: "/mini/equipment", requires: ["equipment.view"] },
  { href: "/mini/me" },
];

describe("visibleNavItems", () => {
  it("до ответа сервера показывает безусловные вкладки, а не пустоту", () => {
    // Именно из-за пустоты навигация прыгала на каждой загрузке.
    const shown = visibleNavItems(ITEMS, null, null).map((i) => i.href);
    assert.deepEqual(shown, ["/mini", "/mini/me"]);
  });

  it("сотруднику показывает только то, на что есть право", () => {
    const shown = visibleNavItems(ITEMS, new Set(["staff.view"]), "staff").map(
      (i) => i.href
    );
    assert.deepEqual(shown, ["/mini", "/mini/staff", "/mini/me"]);
  });

  it("управляющему показывает всё", () => {
    const shown = visibleNavItems(ITEMS, new Set(), "manager").map((i) => i.href);
    assert.equal(shown.length, ITEMS.length);
  });

  it("без прав и без роли менеджера условные вкладки скрыты", () => {
    const shown = visibleNavItems(ITEMS, new Set(), "readonly").map((i) => i.href);
    assert.deepEqual(shown, ["/mini", "/mini/me"]);
  });
});

describe("isNavItemVisible", () => {
  it("пустой список требований равнозначен отсутствию", () => {
    assert.equal(isNavItemVisible({ href: "/x", requires: [] }, null, null), true);
  });

  it("достаточно одного права из списка", () => {
    const item = { href: "/x", requires: ["a.view", "b.view"] };
    assert.equal(isNavItemVisible(item, new Set(["b.view"]), "staff"), true);
    assert.equal(isNavItemVisible(item, new Set(["c.view"]), "staff"), false);
  });
});
