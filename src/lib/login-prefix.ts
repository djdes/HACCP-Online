import { z } from "zod";

/**
 * Логин сотрудника: префикс организации + суффикс.
 *
 * Линейный персонал часто без почты — логин придумывает управляющая, и он
 * обязан быть уникальным на всю платформу (хранится в `User.email`, а тот
 * `@unique`). Префикс от номера организации разводит одинаковые «маша» и
 * «повар1» между заведениями структурно, а не проверками.
 *
 * Почему автоинкремент, а не ИНН, срез cuid или транслит названия: номер
 * стабилен при переименовании и смене реквизитов, короток настолько, что
 * логин можно продиктовать по телефону, и уникален по построению.
 */

export function orgLoginPrefix(orgNo: number): string {
  return `u${orgNo}_`;
}

/**
 * Суффикс — то, что человек вписывает сам.
 *
 * Только латиница нижним регистром, цифры и `.-_`: кириллица и пробелы в
 * логине превращаются в «не могу войти» — набирая его на телефоне, человек
 * не видит, где раскладка.
 */
export const loginSuffixSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Логин слишком короткий")
  .max(60, "Логин слишком длинный")
  .regex(/^[a-z0-9._-]+$/, "Логин: латиница, цифры, точка, дефис");

export function buildStaffLogin(orgNo: number, suffix: string): string {
  return `${orgLoginPrefix(orgNo)}${suffix.trim().toLowerCase()}`;
}

/** Алфавит без символов, которые путают при диктовке: 0/O, 1/l/I. */
const PASSWORD_ALPHABET =
  "23456789abcdefghkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Пароль для сотрудника.
 *
 * Генерируем из `crypto.getRandomValues`, а не `Math.random`: пароль даёт
 * доступ к журналам, которые показывают проверяющим.
 */
export function generateStaffPassword(length = 10): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const value of bytes) {
    out += PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length];
  }
  return out;
}
