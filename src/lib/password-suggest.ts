/**
 * Короткий пароль для анкеты после регистрации: 6 знаков — заглавная,
 * строчные, цифры и ровно один простой спецсимвол. Без похожих символов
 * (0/O, 1/l/I): пароль диктуют по телефону и набирают на телефоне.
 *
 * Работает и в браузере, и в node (`globalThis.crypto`); `random`
 * подменяется в тестах.
 */
const UPPER = "ACDEFHJKLMNPRTUVWXY";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
export const PASSWORD_SPECIALS = "!?#*+=@";
export const SUGGESTED_PASSWORD_LENGTH = 6;

export type RandomInt = (maxExclusive: number) => number;

function secureRandomInt(maxExclusive: number): number {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    // Отбрасываем хвост диапазона, чтобы не перекашивать распределение.
    const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    let x: number;
    do {
      c.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function pick(alphabet: string, random: RandomInt): string {
  return alphabet[random(alphabet.length)];
}

export function suggestPassword(random: RandomInt = secureRandomInt): string {
  const chars = [
    pick(UPPER, random),
    pick(LOWER, random),
    pick(LOWER, random),
    pick(DIGITS, random),
    pick(DIGITS, random),
    pick(PASSWORD_SPECIALS, random),
  ];
  // Фишер–Йейтс: заглавная и спецсимвол не всегда на одних и тех же местах.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
