/**
 * Экранирование и формат дат для SOAP-запросов Ветис.
 *
 * XML собирается шаблонными строками, а не библиотекой: полезных
 * нагрузок восемь штук, они полностью типизированы, и единственное, что
 * дала бы зависимость, — вот эта функция на пять строк. Зато она под
 * нашим контролем и покрыта тестом: незакрытая кавычка в названии
 * продукции («Молоко "Домик в деревне"») ломала бы весь конверт.
 */

export function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** `Date | "YYYY-MM-DD"` → `YYYY-MM-DD` (xsd:date). */
export function toXsdDate(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** `Date` → `YYYY-MM-DDTHH:mm:ss.SSSZ` (xsd:dateTime). */
export function toXsdDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString();
}

/**
 * Необязательный элемент: пустое значение не должно превращаться в
 * `<tag></tag>` — Ветис на пустых обязательных полях отвечает отказом.
 */
export function optionalTag(tag: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${tag}>${escapeXml(value)}</${tag}>`;
}
