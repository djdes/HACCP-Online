/**
 * Поиск по спискам Mini App.
 *
 * Списки в приложении длинные и плоские: 35 журналов, 40 единиц
 * оборудования, весь штат. На телефоне это означает «крути и высматривай»,
 * а у повара в этот момент заняты руки.
 *
 * Вынесено чистой функцией, потому что почти все ошибки поиска —
 * молчаливые. Список просто не находит то, что человек видит своими
 * глазами, и винит он приложение, а не раскладку:
 *
 *   • «ёлочная» проблема: набрал «елочн», а в названии «ёлочный»;
 *   • разный регистр и лишние пробелы из автозамены;
 *   • слова в другом порядке («холодильник цех» против «цех холодильник»);
 *   • QR приносит сюда идентификатор, а не название, — по нему тоже
 *     обязано находиться, иначе сканирование ведёт в пустой список.
 */

/** Приводим к виду, в котором «Ёлочный» и « елочный » — одно и то же. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/** Слова запроса. Пустой запрос — пустой список слов, а не [""]. */
export function searchTokens(query: string): string[] {
  const normalized = normalizeSearch(query);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Совпадение по всем словам запроса — каждое хотя бы в одном из полей.
 *
 * Слова проверяются независимо, поэтому порядок ввода не важен: «цех
 * холодильник» находит «Холодильник, горячий цех».
 */
export function matchesTokens(
  haystacks: ReadonlyArray<string | null | undefined>,
  tokens: readonly string[]
): boolean {
  if (tokens.length === 0) return true;
  const fields = haystacks
    .filter((h): h is string => typeof h === "string" && h.length > 0)
    .map(normalizeSearch);
  if (fields.length === 0) return false;
  return tokens.every((token) => fields.some((field) => field.includes(token)));
}

/**
 * Насколько хорошо совпало: меньше — выше в списке.
 *
 * Порядок важен ровно для одного сценария: человек набрал начало
 * названия и ждёт его первым, а не десятым — потому что где-то в
 * середине чужой строки те же буквы.
 *
 * 0 — поле начинается с запроса, 1 — с запроса начинается слово внутри
 * поля, 2 — просто встретилось. Вес берётся по первому полю, в котором
 * нашлось: название важнее примечания.
 */
export function rankMatch(
  haystacks: ReadonlyArray<string | null | undefined>,
  query: string
): number {
  const normalized = normalizeSearch(query);
  if (!normalized) return 0;
  let best = Number.POSITIVE_INFINITY;
  haystacks.forEach((raw, fieldIndex) => {
    if (typeof raw !== "string" || !raw) return;
    const field = normalizeSearch(raw);
    const at = field.indexOf(normalized);
    if (at < 0) return;
    const kind = at === 0 ? 0 : field[at - 1] === " " ? 1 : 2;
    // Поля идут по убыванию важности, вклад поля меньше вклада вида
    // совпадения — иначе совпадение в примечании обгоняло бы название.
    best = Math.min(best, kind * 10 + fieldIndex);
  });
  return Number.isFinite(best) ? best : 999;
}

/**
 * Отфильтрованный и отсортированный список.
 *
 * Исходный порядок сохраняется внутри одного веса: список уже отсортирован
 * осмысленно (по цеху, по алфавиту), и поиск не должен это перемешивать.
 */
export function filterAndRank<T>(
  items: readonly T[],
  query: string,
  toHaystacks: (item: T) => ReadonlyArray<string | null | undefined>
): T[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [...items];
  const matched: Array<{ item: T; rank: number; index: number }> = [];
  items.forEach((item, index) => {
    const haystacks = toHaystacks(item);
    if (!matchesTokens(haystacks, tokens)) return;
    matched.push({ item, rank: rankMatch(haystacks, query), index });
  });
  matched.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return matched.map((m) => m.item);
}
