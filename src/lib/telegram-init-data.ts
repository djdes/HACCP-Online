import crypto from "node:crypto";

/**
 * Verify a Telegram Mini App `initData` payload.
 *
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * The client side calls `window.Telegram.WebApp.initData`, which is the raw
 * URL-encoded query string the TG client signed with the bot token. We:
 *   1. parse it,
 *   2. pull out `hash`,
 *   3. build the data-check-string (sorted key=value joined by \n),
 *   4. secret_key = HMAC-SHA256(BOT_TOKEN, "WebAppData"),
 *   5. signature  = HMAC-SHA256(data-check-string, secret_key),
 *   6. compare to `hash` in constant time.
 *
 * We also enforce a 24h freshness window on `auth_date` to defeat replay of
 * leaked initData (e.g. from browser history / screen sharing).
 */

const AUTH_DATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
};

export type VerifiedInitData = {
  user: TelegramWebAppUser;
  authDate: Date;
  queryId?: string;
};

export type InitDataVerifyError =
  | "missing-token"
  | "malformed"
  | "missing-hash"
  | "bad-signature"
  | "stale"
  | "missing-user";

export type InitDataVerifyResult =
  | { ok: true; data: VerifiedInitData }
  | { ok: false; error: InitDataVerifyError };

function constantTimeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string | undefined = process.env.TELEGRAM_BOT_TOKEN
): InitDataVerifyResult {
  if (!botToken) return { ok: false, error: "missing-token" };
  if (typeof initData !== "string" || initData.length === 0) {
    return { ok: false, error: "malformed" };
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, error: "malformed" };
  }

  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "missing-hash" };

  // Build data-check-string from every key except `hash`, sorted alphabetically.
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!constantTimeEqHex(signature, hash)) {
    return { ok: false, error: "bad-signature" };
  }

  const authDateSec = Number(params.get("auth_date"));
  if (!Number.isFinite(authDateSec) || authDateSec <= 0) {
    return { ok: false, error: "malformed" };
  }
  const authDateMs = authDateSec * 1000;
  if (Date.now() - authDateMs > AUTH_DATE_MAX_AGE_MS) {
    return { ok: false, error: "stale" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "missing-user" };

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (typeof user.id !== "number") {
    return { ok: false, error: "missing-user" };
  }

  return {
    ok: true,
    data: {
      user,
      authDate: new Date(authDateMs),
      queryId: params.get("query_id") ?? undefined,
    },
  };
}
