import { cookies } from "next/headers";
import { decode, encode } from "next-auth/jwt";

/**
 * Правка claim'ов в уже выданном session-cookie.
 *
 * Через `update()` из NextAuth v4 на Next.js 16 это не работает надёжно:
 * вызов возвращает успех, но cookie не всегда попадает в ответ, и
 * следующий `getServerSession()` видит старый JWT. Поэтому пишем cookie
 * сами — тем же секретом и тем же именем, что и NextAuth.
 *
 * Общий код для двух сценариев смены организации: ROOT-impersonation
 * (`actingAsOrganizationId`) и переключения между своими организациями
 * (`activeOrganizationId`). Проверку прав делает вызывающий — здесь
 * только механика cookie.
 */

const MAX_AGE_SEC = 30 * 24 * 60 * 60;

/**
 * Оба имени, под которыми может лежать наш session-cookie.
 *
 * `src/lib/auth.ts` выбирает имя по `NODE_ENV`, а здесь раньше выбиралось
 * по `NEXTAUTH_URL`. Условия разные, и стоило им разойтись — production
 * build за http, dev с https в NEXTAUTH_URL, — как перезапись claim'ов
 * падала на «Cookie сессии не найден», то есть «Войти как» переставало
 * работать без единой ошибки в логах. Поэтому имя не вычисляем, а ищем
 * то, что реально пришло в запросе.
 */
const SESSION_COOKIE_NAMES = [
  "__Secure-haccp-online.session-token",
  "haccp-online.session-token",
] as const;

/** Имя, которым записываем cookie обратно. Должно совпадать с auth.ts. */
export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? SESSION_COOKIE_NAMES[0]
    : SESSION_COOKIE_NAMES[1];
}

/**
 * Имя cookie, которое реально есть в запросе.
 *
 * Возвращаем именно найденное, а не вычисленное: переписать нужно тот
 * cookie, которым браузер пользуется, иначе рядом ляжет второй и старый
 * перебьёт новый.
 */
export function findSessionCookieName(
  has: (name: string) => boolean
): string | null {
  return SESSION_COOKIE_NAMES.find((name) => has(name)) ?? null;
}

export type RewriteResult = { ok: true } | { ok: false; reason: string };

export async function rewriteSessionClaims(
  patch: Record<string, unknown>,
  /** Проверка перед записью: получает расшифрованный токен. */
  guard?: (token: Record<string, unknown>) => string | null,
): Promise<RewriteResult> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return { ok: false, reason: "NEXTAUTH_SECRET не задан" };

  const cookieStore = await cookies();
  const cookieName = findSessionCookieName((name) =>
    Boolean(cookieStore.get(name)?.value)
  );
  if (!cookieName) return { ok: false, reason: "Cookie сессии не найден" };
  const current = cookieStore.get(cookieName)?.value as string;

  let decoded: Record<string, unknown> | null = null;
  try {
    decoded = (await decode({ token: current, secret })) as Record<
      string,
      unknown
    > | null;
  } catch {
    return { ok: false, reason: "Не удалось декодировать JWT" };
  }
  if (!decoded) return { ok: false, reason: "JWT пустой" };

  const denied = guard?.(decoded);
  if (denied) return { ok: false, reason: denied };

  Object.assign(decoded, patch);

  const fresh = await encode({
    token: decoded as Parameters<typeof encode>[0]["token"],
    secret,
    maxAge: MAX_AGE_SEC,
  });

  cookieStore.set(cookieName, fresh, {
    httpOnly: true,
    // Имя с префиксом `__Secure-` браузер принимает только с secure:true,
    // поэтому флаг выводим из самого имени, а не из окружения.
    secure: cookieName.startsWith("__Secure-"),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });

  return { ok: true };
}
