/**
 * Точки (2026-09-05): пометка «общий документ» в списках журнала.
 *
 * При включённом режиме точек документ без `buildingId` виден на каждой
 * точке. Рядом с документом точки он выглядит дублем, поэтому списки
 * подписывают его бейджем «Общий». Флаг считается по самому списку: если
 * в нём есть хотя бы один документ точки — общие подписываем; если все
 * общие (режим только что включили) — подписывать нечего, двусмысленности
 * нет.
 */
export function sharedDocumentFlag(
  document: { buildingId?: string | null },
  list: ReadonlyArray<{ buildingId?: string | null }>,
): boolean {
  return !document.buildingId && list.some((item) => Boolean(item.buildingId));
}

export function withSharedFlag<T extends { buildingId?: string | null }>(
  documents: T[],
): Array<T & { shared: boolean }> {
  const hasLocationDocuments = documents.some((document) => Boolean(document.buildingId));
  return documents.map((document) => ({
    ...document,
    shared: hasLocationDocuments && !document.buildingId,
  }));
}
