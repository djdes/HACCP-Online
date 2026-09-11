import { NextResponse } from "next/server";

/**
 * Редирект с относительным `Location`.
 *
 * Зачем не `NextResponse.redirect(new URL(path, request.url))`. За nginx
 * route handler видит себя как `localhost:3002`: прокси не сохраняет
 * исходный Host, и абсолютный адрес, собранный из `request.url`, уводит
 * человека на `https://localhost:3002/...`. Проверено на проде
 * 2026-09-11: так ломались вход по ссылке из письма, партнёрская и
 * реферальная регистрация.
 *
 * Относительный `Location` разрешён RFC 7231 и разворачивается браузером
 * от текущего адреса, поэтому работает и за прокси, и локально, и не
 * зависит от переменных окружения.
 *
 * Middleware (`src/proxy.ts`) этой проблемы не имеет — там `NextURL`
 * собирается из заголовков запроса, и его редиректы уже относительные.
 */
export function relativeRedirect(path: string, status: 307 | 308 = 307): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { Location: safeInternalPath(path) },
  });
}

/**
 * Пропускает только путь внутри сайта.
 *
 * `//evil.com` — протокол-относительный адрес: браузер уведёт на чужой
 * домен, хотя строка начинается со слэша. Так же опасны `\\evil.com` и
 * `https://evil.com`. Всё, что не одиночный слэш в начале, заменяем на
 * корень: молча увести человека на чужой сайт хуже, чем на главную.
 */
export function safeInternalPath(path: string): string {
  const value = (path ?? "").trim();
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
