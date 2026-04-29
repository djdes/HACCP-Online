import crypto from "node:crypto";

/**
 * Constant-time сравнение двух строк-секретов.
 *
 * Используется для:
 *   - Telegram webhook secret token
 *   - INTERNAL_TRIGGER_SECRET
 *   - TUYA_CRON_SECRET
 *   - и любых других user-supplied vs env-stored секретов.
 *
 * Прямой `===` сравнивает посимвольно с early-exit — атакующий
 * замеряет ms-разницу и восстанавливает secret по байту. Тут мы
 * хешируем оба значения через SHA-256 (одинаковая длина буферов
 * независимо от длины secret'а) и сравниваем через timingSafeEqual.
 *
 * Возвращает false если любая сторона пустая/нулевая — защита от
 * misconfig (env secret не задан → не должны принимать "" от
 * атакующего как валидный).
 */
export function timingSafeEqualStrings(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}
