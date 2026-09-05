import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_SPECIALS,
  SUGGESTED_PASSWORD_LENGTH,
  suggestPassword,
} from "./password-suggest";

const specials = new Set(PASSWORD_SPECIALS.split(""));

test("suggestPassword: 6 знаков, регистр, цифры и ровно один спецсимвол", () => {
  for (let i = 0; i < 200; i++) {
    const pw = suggestPassword();
    assert.equal(pw.length, SUGGESTED_PASSWORD_LENGTH, pw);
    assert.match(pw, /[A-Z]/, pw);
    assert.match(pw, /[a-z]/, pw);
    assert.match(pw, /\d/, pw);
    assert.equal(pw.split("").filter((ch) => specials.has(ch)).length, 1, pw);
    assert.doesNotMatch(pw, /[0O1lI]/, pw);
    assert.doesNotMatch(pw, /\s/, pw);
  }
});

test("suggestPassword: разные вызовы дают разные пароли", () => {
  const set = new Set(Array.from({ length: 30 }, () => suggestPassword()));
  assert.ok(set.size > 25, `too few distinct: ${set.size}`);
});

test("suggestPassword: детерминирован при подменённом random", () => {
  const zero = () => 0;
  assert.equal(suggestPassword(zero), suggestPassword(zero));
  assert.equal(suggestPassword(zero).length, SUGGESTED_PASSWORD_LENGTH);
});
