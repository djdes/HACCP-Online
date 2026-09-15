/**
 * Поля бумажной шапки, которые живут в `JournalDocument.config`, но не
 * принадлежат ни одному журналу: периодичность контроля, название
 * организации и название документа, заданные «только в этом документе».
 *
 * Конфиг документа пишут десятки мест: сохранение строк, адаптеры
 * TasksFlow, каскад ответственных, автозаполнение. Почти все собирают
 * конфиг нормализатором своего журнала, а нормализатор выкидывает
 * незнакомые ключи — и правка шапки молча пропадала бы после первой же
 * отметки в TasksFlow. Поэтому перенос сделан одним хуком записи
 * (`src/lib/db.ts`): ключа нет в новом конфиге — берём из прежнего.
 * Присланный ключ (в том числе пустая строка) уважается как есть.
 *
 * Модуль без зависимостей: его импортирует `db.ts`.
 */

/** Ключи шапки в конфиге. Совпадают с константами модулей-владельцев (см. тест). */
export const DOCUMENT_HEADER_CONFIG_KEYS = [
  "controlPeriodicity",
  "headerOrgName",
  "headerTitle",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Новый конфиг с полями шапки из прежнего, если в новом их нет.
 * Возвращает тот же объект, когда переносить нечего.
 */
export function carryDocumentHeaderFields(previousConfig: unknown, nextConfig: unknown): unknown {
  const previous = asRecord(previousConfig);
  const next = asRecord(nextConfig);
  if (!previous || !next) return nextConfig;
  let carried: Record<string, unknown> | null = null;
  for (const key of DOCUMENT_HEADER_CONFIG_KEYS) {
    if (next[key] === undefined && typeof previous[key] === "string") {
      carried = carried ?? { ...next };
      carried[key] = previous[key];
    }
  }
  return carried ?? nextConfig;
}

/** Копия конфига без полей шапки — чтобы устаревшая копия клиента их не перезаписала. */
export function withoutDocumentHeaderFields(config: unknown): unknown {
  const record = asRecord(config);
  if (!record) return config;
  if (!DOCUMENT_HEADER_CONFIG_KEYS.some((key) => key in record)) return config;
  const copy = { ...record };
  for (const key of DOCUMENT_HEADER_CONFIG_KEYS) delete copy[key];
  return copy;
}
