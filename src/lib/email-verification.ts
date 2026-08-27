/**
 * Единая проверка «почта подтверждена».
 *
 * Раньше карточка на `/settings` и пункт Быстрого старта читали
 * `emailVerifiedAt` каждый по-своему, и достаточно было одному из них
 * забыть про новое условие, чтобы владелец видел «Подтвердите почту»
 * после того, как уже всё подтвердил. Теперь оба спрашивают здесь.
 */
export function isEmailVerified(
  user: { emailVerifiedAt?: Date | null } | null | undefined,
): boolean {
  return Boolean(user?.emailVerifiedAt);
}
