/**
 * Связь строки журнала со справочником «Оборудование».
 *
 * ПОЧЕМУ отдельный модуль: `equipment-directory.ts` импортирует `@/lib/db`
 * и в клиент не годится, а связывать строку со справочником нужно и на
 * экране журнала, и в печати. Здесь только чистые функции.
 */

export type EquipmentDirectoryOption = {
  id: string;
  name: string;
};

export type EquipmentLinkedRow = {
  equipmentName: string;
  sourceEquipmentId?: string | null;
};

export function normalizeSourceEquipmentId(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Имя единицы для показа и печати.
 *
 * ПОЧЕМУ из справочника: переименование в `/settings/equipment` должно
 * доходить до уже созданного графика. Если единицу удалили из справочника —
 * остаётся имя, сохранённое в документе (журнал предъявляют инспектору,
 * строка не должна опустеть).
 */
export function resolveEquipmentRowName(
  row: EquipmentLinkedRow,
  directory: readonly EquipmentDirectoryOption[]
): string {
  const id = normalizeSourceEquipmentId(row.sourceEquipmentId);
  if (!id) return row.equipmentName;
  const found = directory.find((item) => item.id === id);
  const name = found?.name?.trim();
  return name || row.equipmentName;
}

/**
 * Конфиг документа с подставленными из справочника именами.
 *
 * Нужен печати: на экране имя резолвится при рендере, и без этого бланк
 * после переименования единицы расходился бы с тем, что видит человек.
 */
export function withResolvedEquipmentNames<
  R extends EquipmentLinkedRow,
  C extends { rows: R[] },
>(config: C, directory: readonly EquipmentDirectoryOption[]): C {
  if (directory.length === 0) return config;
  return {
    ...config,
    rows: config.rows.map((row) => {
      const name = resolveEquipmentRowName(row, directory);
      return name === row.equipmentName ? row : { ...row, equipmentName: name };
    }),
  };
}

/**
 * Оборудование справочника, которого в журнале ещё нет.
 *
 * Сверяем и по id, и по имени: строки старых документов ссылки не имеют,
 * и без сверки по имени «добавить недостающее» задваивало бы их.
 */
export function getMissingDirectoryEquipment(
  directory: readonly EquipmentDirectoryOption[],
  rows: readonly EquipmentLinkedRow[]
): EquipmentDirectoryOption[] {
  const usedIds = new Set(
    rows
      .map((row) => normalizeSourceEquipmentId(row.sourceEquipmentId))
      .filter((value): value is string => value !== null)
  );
  const usedNames = new Set(
    rows
      .map((row) => row.equipmentName.trim().toLowerCase())
      .filter((value) => value !== "")
  );
  return directory.filter(
    (item) =>
      !usedIds.has(item.id) && !usedNames.has(item.name.trim().toLowerCase())
  );
}
