/**
 * Разделение «наш воркер кабинета» и «исторические воркеры, которые
 * надо снести».
 *
 * Вынесено из `components/layout/sw-register.tsx` ради теста. Ошибка
 * здесь ломается невоспроизводимо: приложение перестаёт устанавливаться
 * у тех, кто заходил на дашборд, и продолжает работать у тех, кто
 * заходил только в кабинет. Ловить такое по жалобам — недели.
 */

/** Префикс имён кешей воркера кабинета. Должен совпадать с public/mini-sw.js. */
export const MINI_CACHE_PREFIX = "wesetup-mini-";

/** Путь, на который зарегистрирован воркер кабинета. */
export const MINI_SW_SCOPE_PATH = "/mini";

/**
 * Scope приходит абсолютным URL (`https://wesetup.ru/mini`). Сравниваем
 * именно pathname: сравнение по подстроке считало бы своим и чужой
 * воркер с домена вида `mini.example.com`.
 */
export function isMiniServiceWorkerScope(scope: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(scope).pathname;
  } catch {
    // Не URL — точно не наша регистрация, значит сносим.
    return false;
  }
  return (
    pathname === MINI_SW_SCOPE_PATH ||
    pathname === `${MINI_SW_SCOPE_PATH}/` ||
    pathname.startsWith(`${MINI_SW_SCOPE_PATH}/`)
  );
}

/** Кеш воркера кабинета — безусловной чистке не подлежит. */
export function isMiniCacheName(name: string): boolean {
  return name.startsWith(MINI_CACHE_PREFIX);
}
