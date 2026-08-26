/**
 * IP клиента за реверс-прокси.
 *
 * Прод стоит за nginx, поэтому `request.url` и сокет всегда показывают
 * 127.0.0.1 — настоящий адрес приходит в заголовках. Берём первый
 * элемент `X-Forwarded-For`: это адрес самого клиента, дальше по списку
 * идут промежуточные прокси.
 *
 * Заголовки подделываются кем угодно, кто ходит мимо nginx, поэтому
 * значение годится для аналитики и поддержки, но НЕ для контроля
 * доступа.
 */

function firstForwarded(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

/** Для App Router: обычный `Request`/`NextRequest`. */
export function clientIp(request?: Request): string | null {
  if (!request) return null;
  return (
    firstForwarded(request.headers.get("x-forwarded-for")) ??
    firstForwarded(request.headers.get("x-real-ip"))
  );
}

/**
 * Для NextAuth: `authorize(credentials, req)` отдаёт не `Request`, а
 * простой объект с заголовками в нижнем регистре.
 */
export function clientIpFromHeaderBag(
  headers?: Record<string, string | undefined> | null,
): string | null {
  if (!headers) return null;
  return (
    firstForwarded(headers["x-forwarded-for"]) ??
    firstForwarded(headers["x-real-ip"])
  );
}
