import assert from "node:assert/strict";
import test from "node:test";

import { isTransientTelegramError, retryDelayMs } from "@/lib/telegram";

/**
 * Повтор отправки в Telegram.
 *
 * На проде каждое третье админ-уведомление терялось: grammy отдавал
 * «Network request for 'sendMessage' failed!», а повтор делался только
 * при 429 — цикл обрывался с первой попытки. Так пропадали сообщения из
 * онлайн-чата, о которых человек уже думал, что их доставили.
 */

test("network failure is transient and gets retried", () => {
  const error = new Error("Network request for 'sendMessage' failed!");

  assert.equal(isTransientTelegramError(error), true);
  assert.equal(retryDelayMs(error, 1), 1000);
  assert.equal(retryDelayMs(error, 2), 2000);
  assert.equal(retryDelayMs(error, 3), 4000);
});

test("telegram 5xx is transient too", () => {
  assert.equal(isTransientTelegramError({ error_code: 502 }), true);
  assert.equal(isTransientTelegramError({ error_code: 500 }), true);
});

test("429 honours retry_after instead of the backoff", () => {
  const error = { error_code: 429, parameters: { retry_after: 7 } };

  assert.equal(retryDelayMs(error, 1), 7000);
});

test("retry_after is capped so a send cannot hang for minutes", () => {
  const error = { error_code: 429, parameters: { retry_after: 3600 } };

  assert.equal(retryDelayMs(error, 1), 30_000);
});

test("client errors are not retried", () => {
  // 400 «chat not found» или «bad request» повтором не лечится — только
  // сожжёт попытки и задержит остальную очередь.
  assert.equal(isTransientTelegramError({ error_code: 400 }), false);
  assert.equal(retryDelayMs({ error_code: 400 }, 1), null);
  assert.equal(retryDelayMs({ error_code: 403 }, 1), null);
  assert.equal(retryDelayMs(new Error("chat not found"), 1), null);
});

test("backoff never exceeds the hard cap", () => {
  const error = new Error("fetch failed");

  assert.equal(retryDelayMs(error, 10), 30_000);
});
