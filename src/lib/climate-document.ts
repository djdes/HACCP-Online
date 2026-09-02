import {
  buildDateKeys,
  coerceUtcDate,
  formatMonthLabel,
  isWeekend,
  toDateKey,
} from "@/lib/hygiene-document";

export const CLIMATE_DOCUMENT_TEMPLATE_CODE = "climate_control";
export const CLIMATE_DOCUMENT_TITLE =
  "Бланк контроля температуры и влажности на складах";

/**
 * Журнал ведётся ТОЛЬКО по складским помещениям, где хранятся продукты:
 * сухие склады, кладовые бакалеи, овощные склады и цеха. В обеденном
 * зале, гардеробе и коридорах он не нужен — требование СанПиН
 * 2.3/2.4.3590-20 касается мест хранения пищевых продуктов. Название с
 * уточнением «на складах» стоит именно затем, чтобы заведение не заносило
 * сюда все помещения подряд.
 */
export const CLIMATE_SCOPE_HINT =
  "Только складские помещения с продуктами: сухие склады, кладовые бакалеи, овощные склады и цеха. Обеденный зал, гардероб и коридоры сюда не вносят.";

/**
 * Периодичность по регламенту — раз в день, в первой половине дня.
 * Пропущенный день при проверке трактуется как невыполнение контроля.
 */
export const CLIMATE_FREQUENCY_HINT =
  "Раз в день, в первой половине дня. Пропуск дня — нарушение при проверке.";

export const DEFAULT_CLIMATE_CONTROL_TIMES = ["10:00"] as const;
export const DEFAULT_CLIMATE_ROOM_NAME = "Сухой склад";

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
  /**
   * Комментарии к отклонениям: что сделали, когда показатель вышел за
   * норму. Ключ — `roomId:time:metric`, чтобы комментарий держался за
   * конкретный замер, а не за строку целиком: в одном дне может выйти
   * из нормы и температура утром, и влажность вечером.
   */
  corrections?: Record<string, string>;
};

export type ClimateMetricKind = "temperature" | "humidity";

/** Ключ комментария к отклонению. Один на замер. */
export function climateCorrectionKey(
  roomId: string,
  time: string,
  metric: ClimateMetricKind,
): string {
  return `${roomId}:${time}:${metric}`;
}

export type ClimateDeviation = {
  key: string;
  rowId: string;
  date: string;
  time: string;
  roomId: string;
  roomName: string;
  metric: ClimateMetricKind;
  value: number;
  min: number | null;
  max: number | null;
  comment: string;
};

/** Значение вне нормы. Пустое значение отклонением не считается — его просто ещё не внесли. */
export function isClimateValueOutOfRange(
  value: number | null | undefined,
  metric: ClimateMetricConfig,
): boolean {
  if (value === null || value === undefined) return false;
  if (!metric.enabled) return false;
  if (metric.min !== null && value < metric.min) return true;
  if (metric.max !== null && value > metric.max) return true;
  return false;
}

/**
 * Все отклонения документа — из тех же данных, что и таблица.
 *
 * Считается на лету, а не хранится: поэтому исправленное значение убирает
 * строку из корректирующих действий сразу, без перезагрузки страницы, а
 * заново вышедшее за норму — возвращает.
 */
export function collectClimateDeviations(
  config: ClimateDocumentConfig,
  rows: Array<{ id: string; date: string; data: ClimateEntryData }>,
): ClimateDeviation[] {
  const result: ClimateDeviation[] = [];

  for (const row of rows) {
    for (const room of config.rooms) {
      for (const time of config.controlTimes) {
        const cell = row.data.measurements?.[room.id]?.[time];
        if (!cell) continue;

        const checks: Array<[ClimateMetricKind, ClimateMetricConfig, number | null]> = [
          ["temperature", room.temperature, cell.temperature],
          ["humidity", room.humidity, cell.humidity],
        ];

        for (const [metric, limits, value] of checks) {
          if (!isClimateValueOutOfRange(value, limits)) continue;
          const key = climateCorrectionKey(room.id, time, metric);
          result.push({
            key: `${row.id}:${key}`,
            rowId: row.id,
            date: row.date,
            time,
            roomId: room.id,
            roomName: room.name,
            metric,
            value: value as number,
            min: limits.min,
            max: limits.max,
            comment: row.data.corrections?.[key] ?? "",
          });
        }
      }
    }
  }

  return result;
}

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

/**
 * Пре-заполняет конфиг climate-документа цехами организации.
 * Если у орги нет ни одного `Area` — fallback на дефолтную одну комнату.
 *
 * Каждая комната получает stable id формата `room-area-<slug>` (slug
 * нормализован из имени) — чтобы повторное создание документа не
 * создавало дубликаты row-id'ов в task-fill validator'е.
 */
export function buildClimateConfigFromAreas(
  areas: { id: string; name: string }[]
): ClimateDocumentConfig {
  if (areas.length === 0) return getDefaultClimateDocumentConfig();
  return {
    rooms: areas.map((area, index) =>
      createClimateRoomConfig({
        // Используем area.id чтобы id был стабилен между deploy'ями.
        id: `room-area-${area.id || `idx-${index}`}`,
        name: area.name,
      })
    ),
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

  const corrections = normalizeCorrections(record.corrections);

  return {
    responsibleTitle:
      typeof record.responsibleTitle === "string" ? record.responsibleTitle : null,
    measurements,
    ...(corrections ? { corrections } : {}),
  };
}

/**
 * Комментарии к отклонениям проходят через normalize/sync/merge без потерь:
 * иначе ночной автозаполнитель и перезагрузка страницы стирали бы то, что
 * человек написал в «Корректирующих действиях».
 */
function normalizeCorrections(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const corrections: Record<string, string> = {};
  for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
    if (typeof text === "string" && text.trim()) corrections[key] = text;
  }
  return Object.keys(corrections).length ? corrections : undefined;
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
  if (entryData.corrections) next.corrections = entryData.corrections;

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
  if (currentData.corrections) next.corrections = currentData.corrections;

  return next;
}

export function getClimateFilePrefix() {
  return "climate-journal";
}

/**
 * Дата в колонке «Дата» бланка микроклимата — ДД-ММ-ГГГГ.
 *
 * R5-16: здесь стояли ТОЧКИ, и на одном листе оказывались два разных
 * формата даты: шапка «Начат 01-08-2026» (`formatPaperHeaderDate`) и
 * колонка «01.08.2026». Серверный PDF (`document-pdf.ts` →
 * `formatPdfDate`) и печать бланка уже давно печатают дефисы, так что
 * экран был единственным местом с точками — приводим к общему виду.
 *
 * В ПОЛЯХ ВВОДА диалогов точки остаются допустимы (там это привычный
 * пользователю ввод), правило касается только бланка.
 */
export function getClimateDateLabel(date: Date | string) {
  const dateKey = toDateKey(date);
  const [year, month, day] = dateKey.split("-");
  return `${day}-${month}-${year}`;
}
