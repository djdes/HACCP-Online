import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRussianPhone } from "@/lib/tasksflow-client";

test("normalizeRussianPhone keeps common Russian phone forms stable", () => {
  assert.equal(normalizeRussianPhone("+7 999 000-11-22"), "+79990001122");
  assert.equal(normalizeRussianPhone("8 (999) 000-11-22"), "+79990001122");
  assert.equal(normalizeRussianPhone("9990001122"), "+79990001122");
});

test("normalizeRussianPhone supports legacy TasksFlow +7 plus 9 digits format", () => {
  assert.equal(normalizeRussianPhone("+7 999 000-11-2"), "+7999000112");
  assert.equal(normalizeRussianPhone("7999000112"), "+7999000112");
  assert.equal(normalizeRussianPhone("999000112"), "+7999000112");
});

test("normalizeRussianPhone rejects unusable values", () => {
  assert.equal(normalizeRussianPhone(null), null);
  assert.equal(normalizeRussianPhone(""), null);
  assert.equal(normalizeRussianPhone("12345"), null);
});
