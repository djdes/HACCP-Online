/**
 * Человеческая подпись поля журнала.
 *
 * Список записей в Mini App печатал ключи как есть:
 * «temperature: 4 · productName: Молоко». Для повара это выглядит как
 * дамп базы, а не как его же запись.
 *
 * Порядок источников важен. Настоящая подпись из схемы шаблона всегда
 * точнее любой догадки по имени ключа: в схеме написано «Температура,
 * °C», а из `temperature` больше «Температура» не выжать. Транслитерация
 * — запасной путь для полей, которых в схеме нет (старые записи,
 * служебные ключи).
 *
 * Приём уже был в `task-fill/[taskId]/page.tsx`, но жил там копией и до
 * Mini App не доехал.
 */

/**
 * `camelCase` и `snake_case` → «Читаемая строка».
 *
 * Результат — одно предложение, а не Заголовок С Большой Буквы:
 * рядом стоят настоящие подписи из схемы («Температура, °C»), и по-английски
 * капитализированное «Product Name» рядом с ними читается как чужое.
 *
 * Сокращения не трогаем: «ID» и «ИНН» строчными превратились бы
 * в «Id» и «Инн» — это хуже исходного ключа.
 */
export function prettifyKey(key: string): string {
  const spaced = key.replace(/([a-zа-я0-9])([A-ZА-Я])/g, "$1 $2");
  const final = spaced.replace(/_/g, " ").trim();
  if (!final) return key;
  const words = final.split(/\s+/).map((word, index) => {
    if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
    // Целиком заглавное — это сокращение, оставляем как есть.
    if (word.length > 1 && word === word.toUpperCase()) return word;
    return word.charAt(0).toLowerCase() + word.slice(1);
  });
  return words.join(" ");
}

/** Подпись из схемы, иначе — разобранный ключ. */
export function fieldLabel(
  key: string,
  labelByKey?: ReadonlyMap<string, string> | Record<string, string>
): string {
  if (labelByKey) {
    // `ReadonlyMap` — не класс, и `instanceof Map` его из объединения не убирает.
    const asMap = labelByKey as ReadonlyMap<string, string>;
    const fromSchema =
      typeof asMap.get === "function"
        ? asMap.get(key)
        : (labelByKey as Record<string, string>)[key];
    if (fromSchema && fromSchema.trim()) return fromSchema.trim();
  }
  return prettifyKey(key);
}

/**
 * Значение записи одной строкой.
 *
 * Булево показываем словами: «true» в журнале не говорит проверяющему
 * ничего, а «да/нет» говорит.
 */
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (Array.isArray(value)) {
    return value.length ? value.map((v) => formatFieldValue(v)).join(", ") : "—";
  }
  if (typeof value === "object") return "—";
  return String(value);
}

/**
 * Подписи служебных полей, которые встречаются почти в любом журнале
 * и потому редко описаны в `fields` конкретного шаблона.
 */
export const SYSTEM_FIELD_LABELS: Record<string, string> = {
  comment: "Комментарий",
  note: "Примечание",
  notes: "Примечание",
  responsiblePerson: "Ответственный",
  responsibleTitle: "Должность ответственного",
  employeeName: "Сотрудник",
  employeeId: "ID сотрудника",
  damagesDetected: "Повреждения обнаружены",
  itemName: "Наименование",
  quantity: "Количество",
  damageInfo: "Информация о повреждениях",
  checkDate: "Дата проверки",
  arrivalDate: "Дата приёмки",
  arrivalTime: "Время приёмки",
  productName: "Наименование продукта",
  productionDate: "Дата изготовления",
  manufacturer: "Изготовитель",
  supplier: "Поставщик",
  packaging: "Упаковка",
  documentNumber: "Номер документа",
  organolepticResult: "Органолептика",
  storageCondition: "Условия хранения",
  expiryDate: "Срок годности",
  actualSaleDate: "Дата фактической реализации",
  actualSaleTime: "Время фактической реализации",
  temperature: "Температура (°C)",
  isWithinNorm: "В пределах нормы",
  correctiveAction: "Корректирующее действие",
};

/**
 * Словарь «ключ → подпись» из описаний полей.
 *
 * Группы идут по убыванию точности: сначала `fields` самого шаблона,
 * потом реестр дефолтных пайплайнов. Первое встретившееся имя побеждает:
 * если в организации переименовали поле, дефолт не должен вернуть старое.
 * Системные подписи добавляются последними и ничего не перетирают.
 */
export function buildFieldLabels(
  ...fieldGroups: Array<unknown>
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const group of fieldGroups) {
    if (!Array.isArray(group)) continue;
    for (const field of group) {
      if (!field || typeof field !== "object") continue;
      const { key, label } = field as { key?: unknown; label?: unknown };
      if (typeof key !== "string" || !key) continue;
      if (typeof label !== "string" || !label.trim()) continue;
      if (labels[key]) continue;
      labels[key] = label.trim();
    }
  }
  for (const [key, label] of Object.entries(SYSTEM_FIELD_LABELS)) {
    if (!labels[key]) labels[key] = label;
  }
  return labels;
}
