import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateWebhookSecret, isValidWebhookUrl, nextAttemptAt, signWebhookBody, verifyWebhookSignature } from "@/lib/webhooks/sign";

describe("webhook signing", () => {
  it("подпись детерминирована и проверяется", () => {
    const secret = generateWebhookSecret();
    assert.ok(secret.startsWith("whsec_"));
    const sig = signWebhookBody(secret, '{"a":1}');
    assert.match(sig, /^sha256=[0-9a-f]{64}$/);
    assert.equal(verifyWebhookSignature(secret, '{"a":1}', sig), true);
    assert.equal(verifyWebhookSignature(secret, '{"a":2}', sig), false);
    assert.equal(verifyWebhookSignature(secret, '{"a":1}', "sha256=короткая"), false);
  });
  it("повторы через 1, 5, 30 минут, потом отказ", () => {
    const now = new Date("2026-09-10T10:00:00Z");
    assert.equal(nextAttemptAt(1, now)?.toISOString(), "2026-09-10T10:01:00.000Z");
    assert.equal(nextAttemptAt(2, now)?.toISOString(), "2026-09-10T10:05:00.000Z");
    assert.equal(nextAttemptAt(3, now)?.toISOString(), "2026-09-10T10:30:00.000Z");
    assert.equal(nextAttemptAt(4, now), null);
  });
  it("адреса: только http(s) и не внутренняя сеть", () => {
    assert.equal(isValidWebhookUrl("https://example.com/hook"), true);
    assert.equal(isValidWebhookUrl("http://localhost:3000/x"), false);
    assert.equal(isValidWebhookUrl("https://192.168.1.5/x"), false);
    assert.equal(isValidWebhookUrl("ftp://example.com"), false);
    assert.equal(isValidWebhookUrl("nope"), false);
  });
});
