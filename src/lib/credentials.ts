import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

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

/**
 * Узкий срез Prisma вместо всего клиента — чтобы разбор коллизий можно
 * было проверить тестом без БД. Тот же приём, что у `fetchCleaningRooms`
 * в `journal-auto-create.ts`.
 */
export type UserFinder = {
  user: { findMany: (args: unknown) => Promise<VerifiedUser[]> };
};

/**
 * Проверка пары «телефон + пароль» — вход сотрудника вне Telegram.
 *
 * Зачем отдельная функция, а не переиспользование email-версии: у
 * сотрудников email СИНТЕТИЧЕСКИЙ. `/api/join/[token]` собирает его из
 * номера (`79851234567@<orgId>.staff.local`), потому что у уборщицы или
 * повара своей почты может не быть вовсе. Просить такой адрес на экране
 * входа бессмысленно — его никто не помнит и не наберёт.
 *
 * Телефон НЕ уникален глобально: `/join` следит за уникальностью только
 * внутри организации, и на проде на 2026-09-08 три номера действительно
 * повторяются у разных людей с паролями. Поэтому кандидатов может быть
 * несколько, и разбирается это так:
 *
 *   • сверяем пароль со ВСЕМИ кандидатами (их единицы);
 *   • ровно один подошёл — пускаем именно его;
 *   • подошло несколько (один номер И один пароль у двух людей) —
 *     отказываем и пишем в лог: угадывать, кто из них вошёл, нельзя,
 *     потому что записи в журнале подписываются именем.
 *
 * Защита от перебора та же, что у email-входа: bcrypt.compare
 * выполняется всегда, в том числе когда кандидатов нет.
 */
export async function verifyPhonePassword(
  rawPhone: string,
  password: string,
  client: UserFinder = db as unknown as UserFinder,
): Promise<VerifiedUser | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    // Всё равно жжём время, чтобы «нет такого номера» не отвечало
    // мгновенно и не выдавало существующие номера.
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    return null;
  }

  const candidates = await client.user.findMany({
    where: {
      phone,
      isActive: true,
      archivedAt: null,
      // Пустой хеш означает «вход невозможен» — так заводят сотрудников
      // импортом и через Mini App (см. src/lib/staff-create.ts).
      passwordHash: { not: "" },
    },
    include: { organization: true },
    // Ограничение на случай мусорных данных: перебирать сотню хешей на
    // каждую попытку входа — готовый способ положить сервер.
    take: 5,
  });

  if (candidates.length === 0) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    return null;
  }

  const matches: VerifiedUser[] = [];
  for (const candidate of candidates) {
    if (await bcrypt.compare(password, candidate.passwordHash)) {
      matches.push(candidate);
    }
  }

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.warn(
      `[login] телефон ${phone}: пароль подошёл ${matches.length} пользователям — вход отклонён`,
    );
  }
  return null;
}
