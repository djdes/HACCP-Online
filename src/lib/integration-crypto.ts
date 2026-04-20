/**
 * AES-256-GCM helper for storing third-party integration secrets at rest.
 *
 * Format on disk: `iv.tag.ciphertext`, each part base64url-encoded.
 *
 * Key derivation: SHA-256 of `INTEGRATION_KEY_SECRET`. The env value can be
 * any length; we hash it so plain-text secrets remain valid AES keys.
 *
 * **Operational note:** If `INTEGRATION_KEY_SECRET` rotates, every stored
 * blob becomes unreadable. Either keep the secret stable for the life of
 * the deployment, or migrate stored ciphertexts when rotating.
 */
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_KEY_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      "INTEGRATION_KEY_SECRET is missing or shorter than 16 chars. " +
        "Set it to a long random string in .env (rotation invalidates " +
        "previously stored integration keys)."
    );
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

export function decryptSecret(blob: string): string {
  const parts = blob.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret (expected iv.tag.ciphertext)");
  }
  const [ivB64, tagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const enc = Buffer.from(encB64, "base64url");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

/**
 * Random secret for inbound webhook HMAC verification. 32 bytes base64url.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}
