/**
 * Защита от SSRF: валидация URL'ов которые сервер дёргает по сети.
 *
 * Используется в:
 *   - /api/integrations/tasksflow (POST baseUrl)
 *   - /api/settings/webhooks (PUT urls[])
 *   - и любой другой форме где менеджер вводит URL который мы потом
 *     вызовем через fetch.
 *
 * Без этой проверки менеджер мог бы:
 *   - Прочитать AWS-metadata через 169.254.169.254
 *   - Поломать локальные сервисы (Redis localhost:6379, и т.п.)
 *   - Получить ответ с локального admin-эндпоинта
 *
 * В dev можно отключить через LOCAL_INTEGRATIONS_ALLOWED=1.
 */

function isPrivateHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (hostname === "169.254.169.254") return true;
  if (/^169\.254\./.test(hostname)) return true;
  // Single-label hostname (без точки) — обычно internal-only.
  if (!hostname.includes(".") && hostname !== "localhost") return true;
  return false;
}

export function isPublicHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (process.env.LOCAL_INTEGRATIONS_ALLOWED !== "1") {
      if (isPrivateHostname(u.hostname)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
