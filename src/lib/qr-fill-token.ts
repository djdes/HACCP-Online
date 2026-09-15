import crypto from "node:crypto";

/**
 * Долгоживущий HMAC-токен QR-кода, по которому сотрудник без входа вносит
 * показание: наклейка на холодильнике или A4-плакат на складе.
 *
 * Форматы:
 *   • оборудование — `<equipmentId>.<issuedAtMs>.<sig>` (как у старых
 *     наклеек: уже расклеенные продолжают работать);
 *   • помещение — `room:<roomId>.<issuedAtMs>.<sig>`.
 *
 * Вид объекта зашит в подписанную часть, поэтому токен помещения не
 * принимается маршрутом оборудования и наоборот.
 *
 * Сроки: наклейка оборудования — 60 дней (как было), плакат помещения —
 * год: его печатают на A4 и вешают надолго. На странице плакатов под
 * каждым кодом написано, до какого числа он действует.
 */

export type QrFillKind = "equipment" | "room";

export const QR_FILL_TTL_MS: Record<QrFillKind, number> = {
  equipment: 60 * 24 * 60 * 60 * 1000,
  room: 365 * 24 * 60 * 60 * 1000,
};

const ROOM_PREFIX = "room:";

function getSecret(): string {
  const raw =
    process.env.EQUIPMENT_QR_TOKEN_SECRET ||
    process.env.TELEGRAM_LINK_TOKEN_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error("EQUIPMENT_QR_TOKEN_SECRET не настроен (или слишком короткий).");
  }
  return raw;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function subjectFor(kind: QrFillKind, id: string): string {
  return kind === "room" ? `${ROOM_PREFIX}${id}` : id;
}

export function mintQrFillToken(kind: QrFillKind, id: string, now: number = Date.now()): string {
  if (!id || id.includes(".") || (kind === "equipment" && id.startsWith(ROOM_PREFIX))) {
    throw new Error("Некорректный id объекта для QR-токена");
  }
  const payload = `${subjectFor(kind, id)}.${now}`;
  return `${payload}.${sign(payload)}`;
}

export type QrFillTokenVerification =
  | { ok: true; kind: QrFillKind; id: string; issuedAt: number; expiresAt: number }
  | { ok: false; reason: "bad-format" | "bad-sig" | "expired" };

export function verifyQrFillToken(
  token: string,
  now: number = Date.now()
): QrFillTokenVerification {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) return { ok: false, reason: "bad-format" };
  const [subject, issuedRaw, sig] = parts;
  if (!subject || !issuedRaw || !sig) return { ok: false, reason: "bad-format" };
  const issued = Number(issuedRaw);
  if (!Number.isFinite(issued)) return { ok: false, reason: "bad-format" };

  const kind: QrFillKind = subject.startsWith(ROOM_PREFIX) ? "room" : "equipment";
  const id = kind === "room" ? subject.slice(ROOM_PREFIX.length) : subject;
  if (!id) return { ok: false, reason: "bad-format" };

  const expectedBuf = Buffer.from(sign(`${subject}.${issuedRaw}`), "base64url");
  const sigBuf = Buffer.from(sig, "base64url");
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    return { ok: false, reason: "bad-sig" };
  }

  const expiresAt = issued + QR_FILL_TTL_MS[kind];
  if (now > expiresAt) return { ok: false, reason: "expired" };
  return { ok: true, kind, id, issuedAt: issued, expiresAt };
}

/** Проверка токена конкретного объекта конкретного вида. */
export function verifyQrFillTokenFor(
  token: string,
  kind: QrFillKind,
  id: string,
  now: number = Date.now()
): QrFillTokenVerification {
  const result = verifyQrFillToken(token, now);
  if (!result.ok) return result;
  if (result.kind !== kind || result.id !== id) return { ok: false, reason: "bad-sig" };
  return result;
}
