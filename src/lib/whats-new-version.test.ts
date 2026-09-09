import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WHATS_NEW_NOTES, whatsNewVersion } from "@/lib/whats-new-notes";

describe("whatsNewVersion", () => {
  it("один и тот же текст даёт один и тот же отпечаток", () => {
    // Именно это и чинит старую беду: окно было отключено потому, что
    // показывалось заново при каждом поднятии SHA сборки, даже когда
    // текст не менялся.
    assert.equal(whatsNewVersion(WHATS_NEW_NOTES), whatsNewVersion(WHATS_NEW_NOTES));
  });

  it("изменение текста меняет отпечаток", () => {
    const changed = ["Что-то новое", ...WHATS_NEW_NOTES];
    assert.notEqual(whatsNewVersion(WHATS_NEW_NOTES), whatsNewVersion(changed));
  });

  it("перестановка пунктов тоже считается изменением", () => {
    // Порядок задаёт, что человек прочитает первым, — это часть текста.
    const reordered = [...WHATS_NEW_NOTES].reverse();
    assert.notEqual(whatsNewVersion(WHATS_NEW_NOTES), whatsNewVersion(reordered));
  });

  it("отпечаток короткий и пригоден для localStorage", () => {
    const v = whatsNewVersion(WHATS_NEW_NOTES);
    assert.ok(v.length > 0 && v.length <= 12, v);
    assert.match(v, /^[a-z0-9]+$/);
  });

  it("пустой список не роняет", () => {
    assert.ok(whatsNewVersion([]).length > 0);
  });
});
