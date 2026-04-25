import {
  buildDateKeys,
  coerceUtcDate,
  formatMonthLabel,
  isWeekend,
  toDateKey,
} from "@/lib/hygiene-document";

export const CLIMATE_DOCUMENT_TEMPLATE_CODE = "climate_control";
export const CLIMATE_DOCUMENT_TITLE = "Бланк контроля температуры и влажности";
export const DEFAULT_CLIMATE_CONTROL_TIMES = ["10:00", "17:00"] as const;
export const DEFAULT_CLIMATE_ROOM_NAME = "Склад";

export type ClimateMetricConfig = {
  enabled: boolean;
  min: number | null;
  max: number | null;
};

export type ClimateRoomConfig = {
  id: string;
  name: string;
  temperature: ClimateMetricConfig;
  humidity: ClimateMetricConfig;
};

export type ClimateDocumentConfig = {
  rooms: ClimateRoomConfig[];
  controlTimes: string[];
  skipWeekends: boolean;
};

export type ClimateMeasurement = {
  temperature: number | null;
  humidity: number | null;
};

export type ClimateEntryData = {
  responsibleTitle: string | null;
  measurements: Record<string, Record<string, ClimateMeasurement>>;
};

function createId(prefix: string) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomPart}`;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeMetric(value: unknown, fallback: ClimateMetricConfig): ClimateMetricConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    enabled:
      typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
    min: normalizeNumber(record.min),
    max: normalizeNumber(record.max),
  };
}

export function createClimateRoomConfig(
  overrides: Partial<ClimateRoomConfig> = {}
): ClimateRoomConfig {
  return {
    id: overrides.id || createId("room"),
    name: overrides.name?.trim() || DEFAULT_CLIMATE_ROOM_NAME,
    temperature: normalizeMetric(overrides.temperature, {
      enabled: true,
      min: 18,
      max: 25,
    }),
    humidity: normalizeMetric(overrides.humidity, {
      enabled: true,
      min: 15,
      max: 75,
    }),
  };
}

export function getClimateDocumentTitle() {
  return CLIMATE_DOCUMENT_TITLE;
}

export function getClimateCreatePeriodBounds(referenceDate = new Date()) {
  const date = coerceUtcDate(referenceDate);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return {
    dateFrom: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function getDefaultClimateDocumentConfig(): ClimateDocumentConfig {
  return {
    // Детерминированный id `room-0` для default-комнаты — иначе при
    // каждом `normalizeClimateDocumentConfig` для документов с
    // пустым `config.rooms` создаётся комната с новым `randomUUID`,
    // и task-fill валится на «expected number, received undefined»
    // (см. b2c7730 + dump БД 2026-04-25).
    rooms: [createClimateRoomConfig({ id: "room-0" })],
    controlTimes: [...DEFAULT_CLIMATE_CONTROL_TIMES],
    skipWeekends: false,
  };
}

export function normalizeClimateDocumentConfig(value: unknown): ClimateDocumentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return getDefaultClimateDocumentConfig();
  }

  const record = value as Record<string, unknown>;
  const times = Array.isArray(record.controlTimes)
    ? record.controlTimes
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  // Прод-баг: createId() ниже использует randomUUID — при normalize
  // config документа без stable room.id адаптер на каждом запросе
  // получает РАЗНЫЕ uuid, и `t_<roomId>` в форме (load) не совпадает
  // с тем что ожидает validator (submit), → «expected number,
  // received undefined» (см. d484f2d).
  //
  // Лекарство: при отсутствии id в БД назначаем детерминированный
  // `room-<index>` — такой же при любом следующем normalize одного
  // и того же raw config.
  const rooms = Array.isArray(record.rooms)
    ? record.rooms
        .map((room, index) => {
          if (!room || typeof room !== "object" || Array.isArray(room)) return null;
          const roomRecord = room as Record<string, unknown>;
          const rawId =
            typeof roomRecord.id === "string" && roomRecord.id.trim() !== ""
              ? roomRecord.id
              : `room-${index}`;

          return createClimateRoomConfig({
            id: rawId,
            name:
              typeof roomRecord.name === "string" ? roomRecord.name : undefined,
            temperature: normalizeMetric(roomRecord.temperature, {
              enabled: true,
              min: 18,
              max: 25,
            }),
            humidity: normalizeMetric(roomRecord.humidity, {
              enabled: true,
              min: 15,
              max: 75,
            }),
          });
        })
        .filter((room): room is ClimateRoomConfig => room !== null)
    : [];

  return {
    rooms: rooms.length > 0 ? rooms : getDefaultClimateDocumentConfig().rooms,
    controlTimes: times.length > 0 ? times : [...DEFAULT_CLIMATE_CONTROL_TIMES],
    skipWeekends:
      typeof record.skipWeekends === "boolean" ? record.skipWeekends : false,
  };
}

export function createEmptyClimateEntryData(
  config: ClimateDocumentConfig,
  responsibleTitle: string | null = null
): ClimateEntryData {
  const measurements: Record<string, Record<string, ClimateMeasurement>> = {};

  config.rooms.forEach((room) => {
    measurements[room.id] = {};
    config.controlTimes.forEach((time) => {
      measurements[room.id][time] = {
        temperature: null,
        humidity: null,
      };
    });
  });

  return {
    responsibleTitle,
    measurements,
  };
}

export function normalizeClimateEntryData(value: unknown): ClimateEntryData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      responsibleTitle: null,
      measurements: {},
    };
  }

  const record = value as Record<string, unknown>;
  const measurementsValue = record.measurements;
  const measurements: Record<string, Record<string, ClimateMeasurement>> = {};

  if (measurementsValue && typeof measurementsValue === "object" && !Array.isArray(measurementsValue)) {
    Object.entries(measurementsValue as Record<string, unknown>).forEach(([roomId, roomValue]) => {
      if (!roomValue || typeof roomValue !== "object" || Array.isArray(roomValue)) return;

      const roomMeasurements: Record<string, ClimateMeasurement> = {};
      Object.entries(roomValue as Record<string, unknown>).forEach(([time, metricValue]) => {
        if (!metricValue || typeof metricValue !== "object" || Array.isArray(metricValue)) {
          roomMeasurements[time] = {
            temperature: null,
            humidity: null,
          };
          return;
        }

        const metricRecord = metricValue as Record<string, unknown>;
        roomMeasurements[time] = {
          temperature: normalizeNumber(metricRecord.temperature),
          humidity: normalizeNumber(metricRecord.humidity),
        };
      });

      measurements[roomId] = roomMeasurements;
    });
  }

  return {
    responsibleTitle:
      typeof record.responsibleTitle === "string" ? record.responsibleTitle : null,
    measurements,
  };
}

export function getClimatePeriodLabel(dateFrom: Date | string, dateTo: Date | string) {
  return formatMonthLabel(dateFrom, dateTo);
}

export function getClimatePeriodicityText(config: ClimateDocumentConfig) {
  const times = config.controlTimes.filter(Boolean);
  if (times.length === 0) return "Периодичность не настроена";
  if (times.length === 1) return `1 раз в смену: ${times[0]}`;
  return `${times.length} раза в смену: ${times.join(" и ")}`;
}

function hashToUnit(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return (hash % 1000) / 999;
}

function buildGeneratedMetric(
  min: number | null,
  max: number | null,
  seed: string
): number | null {
  if (min == null && max == null) return null;
  if (min != null && max == null) return min;
  if (min == null && max != null) return max;
  if (min === max) return min;

  const low = Math.min(min as number, max as number);
  const high = Math.max(min as number, max as number);
  const unit = hashToUnit(seed);
  return Math.round((low + (high - low) * unit) * 10) / 10;
}

export function buildClimateAutoFillEntryData(params: {
  config: ClimateDocumentConfig;
  dateKey: string;
  responsibleTitle: string | null;
}): ClimateEntryData {
  const { config, dateKey, responsibleTitle } = params;
  const data = createEmptyClimateEntryData(config, responsibleTitle);

  config.rooms.forEach((room) => {
    config.controlTimes.forEach((time) => {
      const seedBase = `${dateKey}:${room.id}:${time}`;
      data.measurements[room.id][time] = {
        temperature: room.temperature.enabled
          ? buildGeneratedMetric(room.temperature.min, room.temperature.max, `${seedBase}:temperature`)
          : null,
        humidity: room.humidity.enabled
          ? buildGeneratedMetric(room.humidity.min, room.humidity.max, `${seedBase}:humidity`)
          : null,
      };
    });
  });

  return data;
}

export function buildClimateAutoFillRows(params: {
  config: ClimateDocumentConfig;
  dateFrom: Date | string;
  dateTo: Date | string;
  responsibleTitle: string | null;
  responsibleUserId: string;
}) {
  const { config, dateFrom, dateTo, responsibleTitle, responsibleUserId } = params;

  return buildDateKeys(dateFrom, dateTo)
    .filter((dateKey) => !(config.skipWeekends && isWeekend(dateKey)))
    .map((dateKey) => ({
      employeeId: responsibleUserId,
      date: new Date(dateKey),
      data: buildClimateAutoFillEntryData({
        config,
        dateKey,
        responsibleTitle,
      }),
    }));
}

export function syncClimateEntryDataWithConfig(
  entryData: ClimateEntryData,
  config: ClimateDocumentConfig
): ClimateEntryData {
  const next = createEmptyClimateEntryData(config, entryData.responsibleTitle);

  config.rooms.forEach((room) => {
    config.controlTimes.forEach((time) => {
      const existing = entryData.measurements[room.id]?.[time];
      next.measurements[room.id][time] = {
        temperature: existing?.temperature ?? null,
        humidity: existing?.humidity ?? null,
      };
    });
  });

  return next;
}

export function mergeClimateEntryData(
  currentData: ClimateEntryData,
  generatedData: ClimateEntryData
): ClimateEntryData {
  const next: ClimateEntryData = {
    responsibleTitle: currentData.responsibleTitle || generatedData.responsibleTitle,
    measurements: {},
  };

  Object.keys(generatedData.measurements).forEach((roomId) => {
    next.measurements[roomId] = {};

    Object.keys(generatedData.measurements[roomId] || {}).forEach((time) => {
      const currentMeasurement = currentData.measurements[roomId]?.[time];
      const generatedMeasurement = generatedData.measurements[roomId]?.[time] || {
        temperature: null,
        humidity: null,
      };

      next.measurements[roomId][time] = {
        temperature:
          currentMeasurement?.temperature ?? generatedMeasurement.temperature ?? null,
        humidity: currentMeasurement?.humidity ?? generatedMeasurement.humidity ?? null,
      };
    });
  });

  return next;
}

export function getClimateFilePrefix() {
  return "climate-journal";
}

export function getClimateDateLabel(date: Date | string) {
  const dateKey = toDateKey(date);
  const [year, month, day] = dateKey.split("-");
  return `${day}.${month}.${year}`;
}
