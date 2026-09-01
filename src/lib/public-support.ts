import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Общая обвязка публичных (неавторизованных) обращений с лендинга.
 *
 * Форма открыта всему интернету, поэтому здесь три заслона сразу:
 *   1. Ловушка `company` — скрытое поле, которое человек не видит и не
 *      заполняет, а простой бот заполняет всегда. Заполнено — отвечаем
 *      200 и молча выбрасываем: бот не должен понять, что его отсекли,
 *      иначе следующий заход будет умнее.
 *   2. Лимит по IP — 6 обращений за 10 минут.
 *   3. Контакт обязателен хотя бы один: без него отвечать некуда, и
 *      обращение всё равно мёртвое.
 */

export const publicContactLimiter = createRateLimiter({
  tokensPerInterval: 6,
  intervalMs: 10 * 60_000,
});

/** Гость опознаётся случайным id из localStorage — аккаунта у него нет. */
export const GUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function guestThreadKey(guestId: string): string {
  return `guest:${guestId}`;
}

export function normalizeContact(input: {
  email?: string | null;
  phone?: string | null;
}): { email: string | null; phone: string | null } {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  return { email, phone };
}

/** Подпись гостя для админ-сообщения: что известно, то и показываем. */
export function guestSignature(contact: {
  email: string | null;
  phone: string | null;
}): string {
  const parts = [contact.email, contact.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "контакты не оставлены";
}
