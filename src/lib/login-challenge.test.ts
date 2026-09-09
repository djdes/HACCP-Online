import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHALLENGE_MAX_ATTEMPTS,
  CHALLENGE_TTL_MS,
  evaluateChallenge,
  generateLoginCode,
  hashLoginCode,
} from "@/lib/login-challenge";

const now = new Date("2026-09-10T10:00:00.000Z");
const id = "chal_1";
const code = "482913";
const base = {
  id,
  codeHash: hashLoginCode(code, id),
  expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
  attempts: 0,
  consumedAt: null,
};

describe("generateLoginCode", () => {
  it("шесть цифр, с ведущими нулями", () => {
    for (let i = 0; i < 50; i += 1) assert.match(generateLoginCode(), /^\d{6}$/);
  });
});

describe("hashLoginCode", () => {
  it("солится id челленджа — один код в разных челленджах даёт разные хеши", () => {
    assert.notEqual(hashLoginCode(code, "a"), hashLoginCode(code, "b"));
    assert.equal(hashLoginCode(" 482913 ", id), hashLoginCode(code, id));
  });
});

describe("evaluateChallenge", () => {
  it("верный код проходит, в том числе с пробелами", () => {
    assert.equal(evaluateChallenge(base, { code, now }), "ok");
    assert.equal(evaluateChallenge(base, { code: "482 913", now }), "ok");
  });
  it("неверный, устаревший, использованный, исчерпанный", () => {
    assert.equal(evaluateChallenge(base, { code: "000000", now }), "mismatch");
    assert.equal(evaluateChallenge(base, { code: "12345", now }), "mismatch");
    assert.equal(evaluateChallenge(base, { code, now: new Date(base.expiresAt.getTime() + 1) }), "expired");
    assert.equal(evaluateChallenge({ ...base, consumedAt: now }, { code, now }), "consumed");
    assert.equal(evaluateChallenge({ ...base, attempts: CHALLENGE_MAX_ATTEMPTS }, { code, now }), "too-many");
  });
});
