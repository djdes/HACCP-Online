/**
 * Название документа в бумажной шапке, заданное прямо в шапке документа.
 *
 * Клиенты журналов передают в шапку стандартное название бланка
 * («ГИГИЕНИЧЕСКИЙ ЖУРНАЛ»). Если управляющий переименовал документ из
 * шапки, текст хранится в `config.headerTitle` этого документа и
 * перебивает стандартный — на экране, в Mini App и в PDF. Пусто —
 * стандартное название.
 */

/** Ключ внутри `JournalDocument.config`. */
export const HEADER_TITLE_CONFIG_KEY = "headerTitle";

/** Предел длины: текст живёт в средней ячейке шапки. */
export const HEADER_TITLE_MAX = 200;

/** Нормализация ввода: пробелы схлопнуты, длина ограничена. Пусто → "". */
export function sanitizeHeaderTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, HEADER_TITLE_MAX);
}

/** Название из шапки документа или null, если его не меняли. */
export function readHeaderTitleOverride(config: unknown): string | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  return sanitizeHeaderTitle((config as Record<string, unknown>)[HEADER_TITLE_CONFIG_KEY]) || null;
}
