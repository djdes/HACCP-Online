/**
 * Отбор строк и переход к следующей незаполненной.
 *
 * Отдельно от компонента, потому что тут легко ошибиться незаметно:
 * фильтр, который прячет строку, выглядит на телефоне ровно как
 * «сотрудника нет в журнале», а конвейер, промахнувшийся мимо
 * следующей строки, оставляет день незакрытым.
 */

export type DayFilter = {
  /** Поиск по имени и подписи. */
  query: string;
  /** Показывать только те, где значения ещё нет. */
  onlyPending: boolean;
};

type FilterableItem = {
  id: string;
  title: string;
  subtitle?: string;
  value?: unknown;
  disabledReason?: string | null;
};

/** Незаполненная и доступная для заполнения. */
function isPending(item: FilterableItem): boolean {
  return !item.value && !item.disabledReason;
}

export function filterDayItems<T extends FilterableItem>(
  items: T[],
  filter: DayFilter,
): T[] {
  const query = filter.query.trim().toLowerCase();

  return items.filter((item) => {
    if (filter.onlyPending && !isPending(item)) return false;
    if (!query) return true;

    // Ищем и по подписи тоже: людей чаще помнят по должности
    // («повар холодного цеха»), чем по фамилии.
    const haystack = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();
    return haystack.includes(query);
  });
}

/**
 * Следующая незаполненная строка ПОСЛЕ указанной, а если ниже таких
 * нет — первая незаполненная сверху.
 *
 * Заворот к началу нужен, когда человек шёл не по порядку: без него
 * конвейер молча останавливался бы на последней строке, оставляя
 * пропуски выше незамеченными.
 */
export function nextUnfilledId<T extends FilterableItem>(
  items: T[],
  afterId: string,
): string | null {
  const index = items.findIndex((item) => item.id === afterId);
  if (index === -1) return null;

  for (let i = index + 1; i < items.length; i++) {
    if (isPending(items[i])) return items[i].id;
  }
  for (let i = 0; i < index; i++) {
    if (isPending(items[i])) return items[i].id;
  }
  return null;
}
