import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffLogin,
  generateStaffPassword,
  loginSuffixSchema,
  orgLoginPrefix,
} from "@/lib/login-prefix";

test("orgLoginPrefix builds a short dictatable prefix", () => {
  assert.equal(orgLoginPrefix(12), "u12_");
  assert.equal(orgLoginPrefix(5827), "u5827_");
});

test("buildStaffLogin lowercases and glues the suffix", () => {
  assert.equal(buildStaffLogin(12, "Maria"), "u12_maria");
  assert.equal(buildStaffLogin(12, "  povar1 "), "u12_povar1");
});

test("buildStaffLogin keeps different orgs apart", () => {
  // Ровно ради этого и нужен префикс: «povar1» заводят в каждом втором
  // заведении, а User.email уникален на всю платформу.
  assert.notEqual(buildStaffLogin(1, "povar1"), buildStaffLogin(2, "povar1"));
});

test("loginSuffixSchema rejects what breaks logging in", () => {
  assert.equal(loginSuffixSchema.parse("Maria.K"), "maria.k");
  // Кириллицу и пробелы человек не наберёт на телефоне, не заметив раскладку.
  assert.equal(loginSuffixSchema.safeParse("мария").success, false);
  assert.equal(loginSuffixSchema.safeParse("two words").success, false);
  assert.equal(loginSuffixSchema.safeParse("a").success, false);
  assert.equal(loginSuffixSchema.safeParse("x".repeat(61)).success, false);
});

test("generateStaffPassword avoids look-alike characters", () => {
  // Пароль диктуют по телефону: 0/O и 1/l/I в нём быть не должно.
  for (let i = 0; i < 50; i += 1) {
    const password = generateStaffPassword();
    assert.equal(password.length, 10);
    assert.doesNotMatch(password, /[0O1lI]/);
  }
});

test("generateStaffPassword does not repeat itself", () => {
  const seen = new Set(Array.from({ length: 50 }, () => generateStaffPassword()));
  assert.equal(seen.size, 50);
});
