/**
 * Snapshot-тесты для `redactSensitiveDetails`.
 * Защищают audit-feed от случайного re-introduction утечки секретов
 * при будущих изменениях.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { redactSensitiveDetails } from "@/lib/audit-redact";

test("redactSensitiveDetails: passes through primitives unchanged", () => {
  assert.equal(redactSensitiveDetails("hello"), "hello");
  assert.equal(redactSensitiveDetails(42), 42);
  assert.equal(redactSensitiveDetails(true), true);
  assert.equal(redactSensitiveDetails(null), null);
  assert.equal(redactSensitiveDetails(undefined), undefined);
});

test("redactSensitiveDetails: redacts top-level password", () => {
  const out = redactSensitiveDetails({ user: "ivan", password: "secret123" });
  assert.deepEqual(out, { user: "ivan", password: "[REDACTED]" });
});

test("redactSensitiveDetails: redacts case-insensitive variants", () => {
  const out = redactSensitiveDetails({
    Password: "x",
    PasswordHash: "y",
    password_hash: "z",
    newHash: "n",
    oldhash: "o",
    Token: "t",
    Secret: "s",
    apiKey: "a",
    api_key: "ak",
    accessToken: "at",
    access_token: "at2",
    refreshToken: "rt",
    refresh_token: "rt2",
    webhookSecret: "ws",
    webhook_secret: "ws2",
    initData: "id",
    init_data: "id2",
  });
  for (const v of Object.values(out as Record<string, unknown>)) {
    assert.equal(v, "[REDACTED]");
  }
});

test("redactSensitiveDetails: keeps non-sensitive keys intact", () => {
  const out = redactSensitiveDetails({
    name: "Иван",
    role: "manager",
    organizationId: "org-1",
    timestamp: 1234567890,
  });
  assert.deepEqual(out, {
    name: "Иван",
    role: "manager",
    organizationId: "org-1",
    timestamp: 1234567890,
  });
});

test("redactSensitiveDetails: recursive — nested object", () => {
  const out = redactSensitiveDetails({
    actor: {
      name: "Иван",
      credentials: { password: "leaked", token: "leaked2" },
    },
    meta: { ip: "1.2.3.4" },
  });
  assert.deepEqual(out, {
    actor: {
      name: "Иван",
      credentials: { password: "[REDACTED]", token: "[REDACTED]" },
    },
    meta: { ip: "1.2.3.4" },
  });
});

test("redactSensitiveDetails: recursive — array of objects", () => {
  const out = redactSensitiveDetails([
    { id: 1, password: "x" },
    { id: 2, name: "ok" },
  ]);
  assert.deepEqual(out, [
    { id: 1, password: "[REDACTED]" },
    { id: 2, name: "ok" },
  ]);
});

test("redactSensitiveDetails: handles deeply nested structures", () => {
  const out = redactSensitiveDetails({
    a: { b: { c: { secret: "deep", visible: 1 } } },
  });
  assert.deepEqual(out, {
    a: { b: { c: { secret: "[REDACTED]", visible: 1 } } },
  });
});

test("redactSensitiveDetails: does not mutate input", () => {
  const input = { password: "x", name: "ok" };
  const inputCopy = { ...input };
  redactSensitiveDetails(input);
  assert.deepEqual(input, inputCopy);
});

test("redactSensitiveDetails: doesn't false-positive on similar-looking keys", () => {
  // 'description' содержит 'script' но не должен redact'иться.
  const out = redactSensitiveDetails({
    description: "user changed password yesterday",
    notes: "secret recipe — borscht",
  });
  // notes — содержит слово "secret" но имя ключа `notes`, не `secret`
  assert.deepEqual(out, {
    description: "user changed password yesterday",
    notes: "secret recipe — borscht",
  });
});
