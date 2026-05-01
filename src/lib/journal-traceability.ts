/**
 * Cross-journal traceability — связь между записями журналов через
 * batchKey. По СанПиН + ТР ТС 021/2011 у общепита должна быть
 * прослеживаемость партии: «откуда сырьё → как готовили → когда
 * отпустили → если списали — куда».
 *
 * Реализация: JournalEntry.batchKey (опциональное поле). При создании
 * записи в incoming_control / incoming_raw_materials_control / perishable_rejection
 * — генерим уникальный batchKey автоматически. Дальше при создании
 * finished_product / product_writeoff — пользователь выбирает партию
 * из списка recent batches за последние 7 дней.
 *
 * UI:
 *   • На форме incoming_control — placeholder показывает auto-batchKey,
 *     пользователь может переименовать.
 *   • На форме finished_product / product_writeoff — селектор «Из какой
 *     партии?» с recent batches.
 *   • На странице записи (entry detail) — бейдж «Связан с партией X»
 *     + ссылка на upstream/downstream entries.
 *   • На странице traceability_test — введите batchKey, увидите весь
 *     путь.
 */

import type { Prisma } from "@prisma/client";

/**
 * Журналы которые «начинают» партию — для них автоматически генерим
 * batchKey при сохранении.
 */
export const TRACEABILITY_SOURCE_CODES = new Set([
  "incoming_control",
  "incoming_raw_materials_control",
  "perishable_rejection",
]);

/**
 * Журналы которые «потребляют» партию — для них показываем селектор
 * партии при сохранении.
 */
export const TRACEABILITY_CONSUMER_CODES = new Set([
  "finished_product",
  "product_writeoff",
  "intensive_cooling",
  "metal_impurity",
]);

export function isTraceabilitySource(journalCode: string): boolean {
  return TRACEABILITY_SOURCE_CODES.has(journalCode);
}

export function isTraceabilityConsumer(journalCode: string): boolean {
  return TRACEABILITY_CONSUMER_CODES.has(journalCode);
}

/**
 * Генерим читабельный batchKey: `<orgPrefix>-<YYYYMMDD>-<rand4>`.
 * orgPrefix — первые 4 цифры/буквы organizationId.
 */
export function generateBatchKey(organizationId: string): string {
  const orgPrefix = organizationId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0")
    .toUpperCase();
  return `${orgPrefix || "ORG"}-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Расчёт «возраста партии» — сколько дней прошло с её начала. Полезно
 * для фильтрации (showing only batches за последние 7 дней).
 */
export function batchAgeInDays(batchKey: string): number | null {
  // Формат YYYYMMDD в середине; парсим.
  const match = batchKey.match(/-(\d{8})-/);
  if (!match) return null;
  const ymd = match[1];
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  const date = new Date(y, m - 1, d);
  const days = (Date.now() - date.getTime()) / 86_400_000;
  return Math.round(days);
}

/**
 * Извлекает batchKey из data (если он там есть напрямую) ИЛИ из
 * data.batchNumber (legacy field for finished_product).
 */
export function extractBatchKeyFromData(data: Prisma.JsonValue): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.batchKey === "string" && obj.batchKey.length > 0) {
    return obj.batchKey;
  }
  if (typeof obj.batchNumber === "string" && obj.batchNumber.length > 0) {
    return obj.batchNumber;
  }
  return null;
}
