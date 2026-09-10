import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Исходящие вебхуки — чистая часть: события, подпись, расписание повторов.
 * Подпись: `X-WeSetup-Signature: sha256=<hex HMAC-SHA256(secret, body)>`.
 */
export { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL, isWebhookEvent, type WebhookEvent } from "./events";
import type { WebhookEvent } from "./events";

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function signWebhookBody(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, body: string, signature: string): boolean {
  const expected = signWebhookBody(secret, body);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Повторы: через 1, 5 и 30 минут после неудачи, потом — отказ. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export function nextAttemptAt(attemptsDone: number, now: Date): Date | null {
  const delay = RETRY_DELAYS_MS[attemptsDone - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay);
}

export function isValidWebhookUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "0.0.0.0" || host === "[::1]") return false;
    return true;
  } catch {
    return false;
  }
}
