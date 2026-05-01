/**
 * Super-user gate — hard-coded list of email-адресов с доступом к
 * dev-tools (очистка журналов, force-bulk-assign без фильтра по времени).
 *
 * Это НЕ роль (как owner/manager/admin/isRoot) и НЕ permission preset.
 * Именно email-allowlist, проверяется и в UI (показ кнопок), и в API
 * (403 для всех остальных). Сделано так специально — чтобы фичу
 * нельзя было «случайно дать» через role/permission UI; для добавления
 * нового super-юзера нужен явный code-change.
 *
 * Кейс: разработчик / владелец продукта тестирует bulk-assign в свой
 * тестовой орге, ему нужно «очистить и отправить заново» без ожидания
 * до завтра. Любому другому юзеру показывать опасные destructive
 * операции — нельзя.
 */

const SUPER_USER_EMAILS = new Set([
  "admin@gavan-copy.test",
]);

type SessionLike = {
  user?: { email?: string | null } | null;
} | null | undefined;

export function isSuperUser(session: SessionLike): boolean {
  const email = session?.user?.email;
  if (!email) return false;
  return SUPER_USER_EMAILS.has(email.toLowerCase());
}
