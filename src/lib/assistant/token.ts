import crypto from "node:crypto";

/**
 * Одноразовый токен хода ассистента.
 *
 * Исполнитель приходит к нам снаружи и должен как-то доказать, что он
 * отвечает именно на этот ход. Сессии у него нет — есть только токен,
 * который мы сами положили в задание.
 *
 * Поэтому: токен случайный и длинный, в базе лежит только его sha256,
 * сравнение — постоянного времени, срок жизни 15 минут. Утёкшая база не
 * даёт возможности ответить за ассистента, а подсмотренный в очереди
 * токен протухает раньше, чем им успеют воспользоваться повторно.
 */

/** Токен живёт ровно столько, сколько разумно ждать ответа. */
export const ASSISTANT_TOKEN_TTL_MS = 15 * 60 * 1000;

export function createAssistantToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAssistantToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Сравнение без утечки по времени: наивное `===` на строках выходит из
 * цикла на первом несовпавшем символе, и по задержке ответа токен
 * подбирается посимвольно.
 */
export function assistantTokenMatches(
  token: string,
  storedHash: string | null | undefined
): boolean {
  if (!storedHash) return false;
  const actual = Buffer.from(hashAssistantToken(token), "hex");
  const expected = Buffer.from(storedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
