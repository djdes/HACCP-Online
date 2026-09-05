/**
 * ИНН: 10 цифр — юрлицо, 12 — ИП или физлицо. Проверка по контрольной
 * сумме отсекает опечатки до похода в DaData (и не тратит квоту).
 */
const W10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const W12_1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const W12_2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

function controlDigit(digits: number[], weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i] * digits[i];
  return (sum % 11) % 10;
}

/** Только цифры из того, что ввёл человек. */
export function innDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function isValidInn(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  const d = inn.split("").map(Number);
  if (d.length === 10) return controlDigit(d, W10) === d[9];
  return controlDigit(d, W12_1) === d[10] && controlDigit(d, W12_2) === d[11];
}
