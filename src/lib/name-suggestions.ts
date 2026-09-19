/**
 * Память наименований организации — client-safe константы и чистые
 * функции (без `@/lib/db`, см. memory `client-safe-lib-split`).
 */

export const NAME_SUGGESTION_SCOPES = ["dish", "product"] as const;
export type NameSuggestionScope = (typeof NAME_SUGGESTION_SCOPES)[number];

export const NAME_SUGGESTION_MAX_LENGTH = 200;
export const NAME_SUGGESTION_LIMIT = 200;

export function isNameSuggestionScope(value: unknown): value is NameSuggestionScope {
  return typeof value === "string" && (NAME_SUGGESTION_SCOPES as readonly string[]).includes(value);
}

/** Обрезает, схлопывает пробелы, отбрасывает пустое и слишком длинное. */
export function normalizeSuggestionValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value || value.length > NAME_SUGGESTION_MAX_LENGTH) return null;
  return value;
}

/**
 * Список для выпадашки: недавние наименования организации первыми, затем
 * справочник документа; без повторов (регистр не учитывается).
 */
export function mergeSuggestions(
  recent: readonly string[],
  ...catalogs: readonly (readonly string[])[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of [recent, ...catalogs]) {
    for (const item of list) {
      const value = normalizeSuggestionValue(item);
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

/** Локальное «запомнили»: переносит значения наверх, как сделает сервер. */
export function promoteSuggestions(recent: readonly string[], values: readonly string[]): string[] {
  const promoted = mergeSuggestions(values);
  return mergeSuggestions(promoted, recent);
}
