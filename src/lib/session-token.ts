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

export function sessionCookieName(): string {
  const isHttps =
    process.env.NEXTAUTH_URL?.startsWith("https://") ||
    process.env.VERCEL === "1";
  // Имя задано в src/lib/auth.ts. Дефолтное next-auth.session-token здесь
  // не подходит: с ним impersonate когда-то падал на «Cookie не найден».
  return isHttps
    ? "__Secure-haccp-online.session-token"
    : "haccp-online.session-token";
}

export type RewriteResult = { ok: true } | { ok: false; reason: string };

export async function rewriteSessionClaims(
  patch: Record<string, unknown>,
  /** Проверка перед записью: получает расшифрованный токен. */
  guard?: (token: Record<string, unknown>) => string | null,
): Promise<RewriteResult> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return { ok: false, reason: "NEXTAUTH_SECRET не задан" };

  const cookieName = sessionCookieName();
  const cookieStore = await cookies();
  const current = cookieStore.get(cookieName)?.value;
  if (!current) return { ok: false, reason: "Cookie сессии не найден" };

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
    secure:
      process.env.NEXTAUTH_URL?.startsWith("https://") === true ||
      process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });

  return { ok: true };
}
