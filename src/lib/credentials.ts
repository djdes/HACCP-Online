import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/**
 * Проверка пары «email + пароль» — общая для входа на сайт и для входа
 * из программы «Онлайн принтер».
 *
 * Вынесено в общий модуль намеренно: защита от перебора и от
 * user-enumeration должна быть ОДНА. Когда таких проверок две, одна из
 * них рано или поздно отстаёт, и злоумышленник идёт через ту, где
 * защиты нет.
 */

/**
 * Заранее посчитанный bcrypt-хеш для несуществующих адресов.
 *
 * Без него ответ «пользователь не найден» приходит за ~5 мс, а «неверный
 * пароль» — за ~100 мс. По этой разнице перебираются существующие
 * адреса. Фейковое сравнение выравнивает время.
 */
const DUMMY_BCRYPT_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.lllkbczy3.0qVxgApY/I5p9mElqS";

/** Пользователь вместе с организацией — обоим вызывающим нужна и она. */
export type VerifiedUser = Prisma.UserGetPayload<{
  include: { organization: true };
}>;

/**
 * Возвращает пользователя, если пара верна и он активен, иначе null.
 *
 * Отличать «нет такого пользователя» от «не тот пароль» вызывающий код
 * не должен: наружу оба случая обязаны выглядеть одинаково.
 */
export async function verifyEmailPassword(
  email: string,
  password: string,
): Promise<VerifiedUser | null> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { organization: true },
  });

  // Сравнение делаем ВСЕГДА, даже когда пользователя нет: ранний выход
  // здесь и есть та самая разница во времени.
  const hashToCheck = user?.passwordHash ?? DUMMY_BCRYPT_HASH;
  const passwordOk = await bcrypt.compare(password, hashToCheck);

  if (!user || !user.isActive || !passwordOk) return null;
  return user;
}
