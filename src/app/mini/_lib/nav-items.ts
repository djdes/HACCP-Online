/**
 * Какие вкладки нижней навигации показывать.
 *
 * Вынесено чистой функцией и под тест намеренно. Здесь две ошибки
 * стоят дорого и обе тихие:
 *
 *   • показать вкладку без прав — человек ткнёт и упрётся в отказ,
 *     решив, что приложение сломано;
 *   • вернуть пустой список, пока права не приехали — именно так и
 *     было: навигация не рендерилась до ответа сервера, и каждая
 *     загрузка начиналась с прыжка содержимого.
 *
 * Права здесь ничего не разрешают — доступ проверяет сервер на самом
 * маршруте (`role-access.ts`). Это исключительно про то, что видно.
 */

export type NavPermissionSet = ReadonlySet<string>;

export type NavItemLike = {
  href: string;
  /** Пусто — вкладка доступна всем, её можно рисовать до ответа сервера. */
  requires?: string[];
};

export function isNavItemVisible(
  item: NavItemLike,
  perms: NavPermissionSet | null,
  mode: string | null
): boolean {
  if (!item.requires || item.requires.length === 0) return true;
  // Права ещё не приехали: показываем только безусловные вкладки.
  if (!perms) return false;
  if (mode === "manager") return true;
  return item.requires.some((r) => perms.has(r));
}

export function visibleNavItems<T extends NavItemLike>(
  items: readonly T[],
  perms: NavPermissionSet | null,
  mode: string | null
): T[] {
  return items.filter((item) => isNavItemVisible(item, perms, mode));
}
