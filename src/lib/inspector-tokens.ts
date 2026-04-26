import crypto from "node:crypto";

/**
 * Inspector-share tokens — 32-byte base64url (43 chars). Same shape as
 * invite tokens but separate semantics: a SES inspector / Роспотребнадзор
 * gets a read-only TTL'd link to view journals during a planned audit.
 */
export function generateInspectorToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInspectorToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const INSPECTOR_TOKEN_DEFAULT_TTL_HOURS = 72;

export function inspectorTokenExpiresAt(hours = INSPECTOR_TOKEN_DEFAULT_TTL_HOURS): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function buildInspectorUrl(raw: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    "https://wesetup.ru";
  return `${base.replace(/\/+$/, "")}/inspector/${raw}`;
}
