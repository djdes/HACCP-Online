/**
 * «Печатает…» в чате поддержки — чистая часть.
 *
 * Эфемерно: в базу ничего не пишется, только событие по потоку
 * (`support/typing`) тому, кто на другой стороне. Клиент пингует не
 * чаще раза в TYPING_PING_MS, пока набирает текст; получатель гасит
 * индикатор через TYPING_TTL_MS после последнего пинга. TTL больше
 * интервала пинга, чтобы индикатор не мигал между пингами.
 */
export const TYPING_PING_MS = 2500;
export const TYPING_TTL_MS = 4000;

export function isTypingFresh(
  lastAt: number | null | undefined,
  now: number,
  ttlMs = TYPING_TTL_MS
): boolean {
  return lastAt != null && now - lastAt < ttlMs;
}

/**
 * Обёртка над отправкой пинга: вызывается на каждое нажатие, а шлёт не
 * чаще раза в intervalMs. Сервер и поток не должны видеть каждую букву.
 */
export function createTypingPinger(
  send: () => void,
  intervalMs = TYPING_PING_MS,
  clock: () => number = () => Date.now()
): () => void {
  let last = 0;
  return () => {
    const now = clock();
    if (now - last < intervalMs) return;
    last = now;
    send();
  };
}

/**
 * Серверная сторона того же ограничения: принимать пинг от одного
 * отправителя не чаще раза в intervalMs. Чуть мягче клиентского
 * интервала, чтобы дрожание таймеров не отбрасывало честные пинги.
 * Карта чистится от старых ключей, когда разрастается.
 */
export function acceptTypingPing(
  seen: Map<string, number>,
  key: string,
  now: number,
  intervalMs = TYPING_PING_MS - 500
): boolean {
  const last = seen.get(key);
  if (last != null && now - last < intervalMs) return false;
  seen.set(key, now);
  if (seen.size > 5000) {
    for (const [k, at] of seen) if (now - at > 60_000) seen.delete(k);
  }
  return true;
}
