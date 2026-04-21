/**
 * Парсер «голос → число» для русской речи.
 *
 * Web Speech API отдаёт распознанный текст строкой, например:
 *   «два и восемь градусов»
 *   «минус три»
 *   «минус 0.5»
 *   «2 и 4»
 *   «двадцать два»
 *   «пять целых восемь»
 *
 * Нам достаточно парой простых правил — распознаём:
 *   1. Прямые числа «2.8», «2,8», «22».
 *   2. Знак «минус» в начале.
 *   3. Разделитель «и», «точка», «запятая», «целых» между целой и
 *      дробной частью.
 *   4. Слова-числа до 99 (для обычных температур кухни достаточно).
 *
 * Возвращает `null`, если из текста ничего не вытащить — вызывающая
 * сторона оставит поле как есть.
 */

const UNITS: Record<string, number> = {
  "ноль": 0,
  "нуль": 0,
  "один": 1,
  "одна": 1,
  "два": 2,
  "две": 2,
  "три": 3,
  "четыре": 4,
  "пять": 5,
  "шесть": 6,
  "семь": 7,
  "восемь": 8,
  "девять": 9,
};

const TEENS: Record<string, number> = {
  "десять": 10,
  "одиннадцать": 11,
  "двенадцать": 12,
  "тринадцать": 13,
  "четырнадцать": 14,
  "пятнадцать": 15,
  "шестнадцать": 16,
  "семнадцать": 17,
  "восемнадцать": 18,
  "девятнадцать": 19,
};

const TENS: Record<string, number> = {
  "двадцать": 20,
  "тридцать": 30,
  "сорок": 40,
  "пятьдесят": 50,
  "шестьдесят": 60,
  "семьдесят": 70,
  "восемьдесят": 80,
  "девяносто": 90,
  "сто": 100,
};

const NEGATIVE_WORDS = new Set(["минус", "ниже нуля"]);
const DECIMAL_WORDS = new Set(["и", "точка", "запятая", "целых", "целая", "целое"]);
const DEGREE_WORDS = new Set([
  "градус",
  "градуса",
  "градусов",
  "°c",
  "c",
  "цельсия",
]);

function wordToNumber(tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  // Если это просто цифры — прямой путь.
  const joined = tokens.join("").replace(/,/g, ".");
  if (/^-?\d+(\.\d+)?$/.test(joined)) {
    const v = parseFloat(joined);
    return Number.isFinite(v) ? v : null;
  }
  let total = 0;
  let matched = false;
  for (const tok of tokens) {
    if (tok in UNITS) {
      total += UNITS[tok];
      matched = true;
    } else if (tok in TEENS) {
      total += TEENS[tok];
      matched = true;
    } else if (tok in TENS) {
      total += TENS[tok];
      matched = true;
    } else if (/^\d+$/.test(tok)) {
      total += parseInt(tok, 10);
      matched = true;
    } else {
      // Unknown token — ignore.
    }
  }
  return matched ? total : null;
}

export function parseRussianNumber(input: string): number | null {
  if (!input) return null;
  const cleaned = input
    .toLowerCase()
    .replace(/°/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  // Split into words but keep bare numbers like "2.8" together.
  const tokens = cleaned.split(/\s+/).filter((tok) => !DEGREE_WORDS.has(tok));
  if (tokens.length === 0) return null;

  let isNegative = false;
  let idx = 0;
  if (NEGATIVE_WORDS.has(tokens[idx]) || tokens[idx] === "−" || tokens[idx] === "-") {
    isNegative = true;
    idx += 1;
  }

  // Split integer / fractional by decimal marker.
  const integerTokens: string[] = [];
  const fractionTokens: string[] = [];
  let inFraction = false;
  for (; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (DECIMAL_WORDS.has(tok)) {
      if (inFraction) continue;
      inFraction = true;
      continue;
    }
    // Embedded dot / comma inside a token like "2,8"
    if (/^-?\d+[.,]\d+$/.test(tok)) {
      const normalized = tok.replace(",", ".");
      const value = parseFloat(normalized);
      if (Number.isFinite(value)) {
        return isNegative ? -value : value;
      }
    }
    if (inFraction) fractionTokens.push(tok);
    else integerTokens.push(tok);
  }

  const integerPart = wordToNumber(integerTokens);
  if (integerPart === null) return null;
  let result = integerPart;
  if (fractionTokens.length > 0) {
    const fractionValue = wordToNumber(fractionTokens);
    if (fractionValue !== null) {
      const digits = String(Math.abs(Math.round(fractionValue))).length;
      result = integerPart + fractionValue / Math.pow(10, digits);
    }
  }
  return isNegative ? -result : result;
}
