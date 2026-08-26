import { db } from "@/lib/db";

/**
 * Отметка о входе: IP и время последнего успешного логина.
 *
 * Вызывается из всех точек входа (свой /api/auth/login, NextAuth
 * credentials, Telegram, мгновенная регистрация). Ошибка записи
 * НИКОГДА не должна ронять сам вход — упавший апдейт стоит одной
 * неточной строки в метриках, а брошенное исключение стоит человеку
 * доступа к кабинету.
 */
export async function recordLogin(
  userId: string,
  ip: string | null,
  at: Date = new Date(),
): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { lastLoginIp: ip, lastLoginAt: at },
    });
  } catch (error) {
    console.error("recordLogin failed", error);
  }
}
