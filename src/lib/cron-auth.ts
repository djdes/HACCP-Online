import crypto from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Проверка cron-secret'а с timing-safe сравнением.
 *
 * Раньше каждый /api/cron/* использовал прямой `===` через
 * `searchParams.get("secret") !== process.env.CRON_SECRET`. Это
 * timing-attack-уязвимо: атакующий замеряет ответы по символам и
 * восстанавливает secret. На локальной сети — реалистично.
 *
 * Дополнительно:
 * - Если CRON_SECRET не задан или пуст — отвергаем все запросы
 *   (раньше пустая строка матчилась с `?secret=` от атакующего).
 * - Принимаем secret из query (?secret=...) ИЛИ из заголовка
 *   `Authorization: Bearer <secret>` (рекомендованный путь).
 *
 * Вернёт `null` если auth прошёл, иначе готовый 401-Response.
 */
export function checkCronSecret(request: Request): NextResponse | null {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (!expected) {
    // Misconfigured deploy — лучше отказать чем пропустить.
    return NextResponse.json(
      { error: "Cron auth not configured" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret") ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const fromHeader = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const presented = fromQuery || fromHeader;

  if (!presented) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // timingSafeEqual требует одинаковую длину буферов — сравниваем
  // SHA-256 hashes для постоянной длины и без leakage по длине.
  const presentedHash = crypto.createHash("sha256").update(presented).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(presentedHash, expectedHash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
