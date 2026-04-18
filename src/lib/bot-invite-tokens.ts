import crypto from "node:crypto";

/**
 * Bot invite tokens for the Telegram-first onboarding flow.
 *
 * Semantically separate from the site `InviteToken` ("set a password on the
 * site"): these tokens bind an employee's Telegram identity instead. The raw
 * token is never persisted — we store only SHA-256 hashes so a DB read can't
 * produce working deep-links. Tokens are prefixed with `inv_` so a future
 * bot handler can distinguish them from any other `/start` payloads at a
 * glance without DB lookup.
 */

const RAW_BYTES = 24;
export const BOT_INVITE_TTL_DAYS = 7;
const BOT_INVITE_PREFIX = "inv_";

export function generateBotInviteRaw(): string {
  return BOT_INVITE_PREFIX + crypto.randomBytes(RAW_BYTES).toString("base64url");
}

/** Returns null if the payload doesn't look like our invite shape. */
export function stripBotInvitePrefix(payload: string): string | null {
  if (!payload.startsWith(BOT_INVITE_PREFIX)) return null;
  const rest = payload.slice(BOT_INVITE_PREFIX.length);
  return rest.length >= 10 ? rest : null;
}

export function hashBotInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function botInviteExpiresAt(): Date {
  return new Date(Date.now() + BOT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function buildBotInviteUrl(raw: string): string {
  const username = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!username) {
    throw new Error("TELEGRAM_BOT_USERNAME is not configured");
  }
  return `https://t.me/${username}?start=${encodeURIComponent(raw)}`;
}
