/**
 * Smart-defaults helper — pre-fill значений в формах task-fill из
 * существующих данных (вчерашняя запись, последний sensor reading).
 *
 * Используется adapter'ами в `getTaskForm()` чтобы подкладывать
 * `defaultValue` без необходимости для юзера нажимать «как вчера».
 *
 * Принцип «частые значения» — большинство сотрудников каждый день
 * ставят один и тот же status в hygiene («healthy»), повар каждый
 * день ставит почти ту же t° в холодильнике. Pre-fill сокращает
 * ввод до одного-двух тапов, но не делает данные «плагиатом» —
 * юзер всё равно осознанно подтверждает submit'ом.
 */

import { db } from "@/lib/db";

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Возвращает entry.data за вчера для (documentId, employeeId) или null
 * если не было записи. Generic для всех DocumentEntry-based журналов.
 */
export async function getYesterdayEntryData(
  documentId: string,
  employeeId: string
): Promise<Record<string, unknown> | null> {
  const today = utcDayStart(new Date());
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const entry = await db.journalDocumentEntry.findUnique({
    where: {
      documentId_employeeId_date: {
        documentId,
        employeeId,
        date: yesterday,
      },
    },
    select: { data: true },
  });
  if (!entry) return null;
  if (!entry.data || typeof entry.data !== "object" || Array.isArray(entry.data)) {
    return null;
  }
  // Если вчера была только _autoSeeded плейсхолдер-row — это не
  // «вчерашнее заполнение», а пустая болванка для grid render'а.
  // Smart-defaults не должен подкидывать seed-data в форму нового
  // дня (там даже temperatures/checklist полей нет, только маркер).
  const data = entry.data as Record<string, unknown>;
  if (data._autoSeeded === true) return null;
  return data;
}

/**
 * Возвращает последнее значение sensor reading для оборудования если
 * оно свежее (< maxAgeHours часов). Используется когда форма хочет
 * подложить «текущая температура с датчика» как defaultValue.
 *
 * Возвращает null если:
 *   - у оборудования нет sensorMapping с указанным readingType
 *   - lastReadingAt отсутствует или старше maxAgeHours
 *   - lastValue не парсится как число
 */
export async function getRecentEquipmentReading(args: {
  equipmentId: string;
  readingType: string; // "temperature" | "humidity"
  maxAgeHours?: number; // default 6
}): Promise<number | null> {
  const maxAgeHours = args.maxAgeHours ?? 6;
  const mapping = await db.equipmentSensorMapping.findFirst({
    where: {
      equipmentId: args.equipmentId,
      readingType: args.readingType,
    },
    select: { lastReadingAt: true, lastValue: true },
  });
  if (!mapping || !mapping.lastReadingAt || mapping.lastValue === null) {
    return null;
  }
  const ageMs = Date.now() - mapping.lastReadingAt.getTime();
  if (ageMs > maxAgeHours * 60 * 60 * 1000) {
    return null;
  }
  const parsed = Number(mapping.lastValue);
  return Number.isFinite(parsed) ? parsed : null;
}
