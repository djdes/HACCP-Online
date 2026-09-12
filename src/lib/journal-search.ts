/**
 * Поиск по журналам — один матчер на все места, где он есть: список
 * «Журналы», набор в настройках и дашборд.
 *
 * Отдельный модуль, потому что иначе у каждого экрана заводится своя
 * нормализация, и один и тот же запрос находит разное. Сравнение идёт по
 * названию, описанию и коду: код нужен, когда журнал ищут по ссылке или
 * по упоминанию в переписке с поддержкой.
 *
 * Только чистые функции — модуль импортируют клиентские компоненты.
 */

export function normalizeJournalSearch(value: string): string {
  return value.toLocaleLowerCase("ru-RU").trim();
}

/**
 * Совпадает ли журнал с уже нормализованным запросом. Пустой запрос
 * совпадает со всем — вызывающему не нужно про это помнить.
 */
export function journalMatchesQuery(
  fields: Array<string | null | undefined>,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  const haystack = normalizeJournalSearch(fields.filter(Boolean).join(" "));
  return haystack.includes(normalizedQuery);
}
