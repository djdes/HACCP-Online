/**
 * Sensor sync — забирает свежие значения с Tuya-датчиков и кэширует
 * их в `EquipmentSensorMapping.lastReadingAt / lastValue`.
 *
 * Где используется:
 *   - GET /api/cron/sensor-sync — крон-эндпоинт, проходит по всем
 *     organisations + всем активным sensor-mapping-ам один раз.
 *   - В будущем (шаг 2.4-2.5) логика создания JournalEntry /
 *     JournalDocumentEntry на основе свежего значения. Пока этот
 *     модуль ТОЛЬКО кэширует last-reading — UI в /settings/equipment
 *     уже сможет показать «датчик жив, последнее значение N°C
 *     M минут назад».
 *
 * Failover (Q6 = hybrid): отдельная функция `enqueueSensorFailover`
 * вызывается из обычного daily-sync. Если для template с
 * `fillMode="sensor"` нет mapping-ов или у всех `lastReadingAt`
 * старше 24 часов — fallback к per-employee режиму. Реализуется в
 * шаге 2.5 (`syncDailyJournalObligationsForOrganization`).
 */

import { db } from "@/lib/db";
import { getDeviceTemperature } from "@/lib/tuya";

export type SensorSyncReport = {
  organizationId: string;
  mappingsTotal: number;
  fresh: number;
  failed: number;
};

const SUPPORTED_READING_TYPES = ["temperature", "humidity"] as const;
type ReadingType = (typeof SUPPORTED_READING_TYPES)[number];

function isSupportedReadingType(value: string): value is ReadingType {
  return (SUPPORTED_READING_TYPES as readonly string[]).includes(value);
}

export async function syncSensorReadingsForOrganization(
  organizationId: string,
  now: Date = new Date()
): Promise<SensorSyncReport> {
  const mappings = await db.equipmentSensorMapping.findMany({
    where: {
      equipment: { area: { organizationId } },
      template: { fillMode: "sensor", isActive: true },
    },
    select: {
      id: true,
      readingType: true,
      equipment: {
        select: { id: true, tuyaDeviceId: true },
      },
      template: { select: { id: true, code: true } },
    },
  });

  const report: SensorSyncReport = {
    organizationId,
    mappingsTotal: mappings.length,
    fresh: 0,
    failed: 0,
  };

  // Кэш чтобы не дёргать одно и то же устройство несколько раз —
  // у одного Tuya-девайса часто несколько mapping-ов (t° и %).
  const deviceCache = new Map<
    string,
    Awaited<ReturnType<typeof getDeviceTemperature>> | Error
  >();

  for (const mapping of mappings) {
    const deviceId = mapping.equipment.tuyaDeviceId;
    if (!deviceId) continue;

    let result = deviceCache.get(deviceId);
    if (!result) {
      try {
        result = await getDeviceTemperature(deviceId);
        deviceCache.set(deviceId, result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        deviceCache.set(deviceId, error);
        result = error;
      }
    }

    if (result instanceof Error) {
      report.failed++;
      continue;
    }

    if (!isSupportedReadingType(mapping.readingType)) {
      report.failed++;
      continue;
    }

    const value =
      mapping.readingType === "temperature"
        ? result.temperature
        : result.humidity;
    if (value == null) {
      report.failed++;
      continue;
    }

    await db.equipmentSensorMapping.update({
      where: { id: mapping.id },
      data: { lastReadingAt: now, lastValue: String(value) },
    });
    report.fresh++;
  }

  return report;
}

export async function syncSensorReadingsForAllOrganizations(
  now: Date = new Date()
): Promise<SensorSyncReport[]> {
  const orgs = await db.organization.findMany({
    select: { id: true },
  });
  const reports: SensorSyncReport[] = [];
  for (const org of orgs) {
    try {
      reports.push(await syncSensorReadingsForOrganization(org.id, now));
    } catch (err) {
      console.error("[sensor-sync] org failed", org.id, err);
      reports.push({
        organizationId: org.id,
        mappingsTotal: 0,
        fresh: 0,
        failed: 1,
      });
    }
  }
  return reports;
}
