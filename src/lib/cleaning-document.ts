import {
  buildDateKeys,
  coerceUtcDate,
  formatMonthLabel,
  isWeekend,
  toDateKey,
} from "@/lib/hygiene-document";

export const CLEANING_DOCUMENT_TEMPLATE_CODE = "cleaning";
export const CLEANING_PAGE_TITLE = "Чек-лист уборки и проветривания помещений";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CleaningActivityType = "disinfection" | "ventilation" | "wetCleaning";

export type CleaningScheduleItem = {
  times: string[];
  responsibleUserId: string | null;
};

export type CleaningProcedure = {
  surfaces: string;
  ventilationRooms: string;
  wetCleaningRooms: string;
  detergent: string;
};

export type CleaningResponsiblePerson = {
  userId: string;
  title: string;
};

export type CleaningDocumentConfig = {
  ventilationEnabled: boolean;
  skipWeekends: boolean;
  schedule: {
    disinfection: CleaningScheduleItem;
    ventilation: CleaningScheduleItem;
    wetCleaning: CleaningScheduleItem;
  };
  procedure: CleaningProcedure;
  responsiblePersons: CleaningResponsiblePerson[];
  periodicity: {
    disinfectionPerDay: number;
    ventilationPerDay: number;
    wetCleaningPerDay: number;
  };
};

export type CleaningActivityEntry = {
  type: CleaningActivityType;
  times: string[];
  responsibleName: string;
};

export type CleaningEntryData = {
  activities: CleaningActivityEntry[];
};

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const ACTIVITY_LABELS: Record<CleaningActivityType, string> = {
  disinfection: "Дезинфекция",
  ventilation: "Проветривание",
  wetCleaning: "Влажная уборка",
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function defaultCleaningDocumentConfig(): CleaningDocumentConfig {
  return {
    ventilationEnabled: true,
    skipWeekends: false,
    schedule: {
      disinfection: {
        times: ["14:00", "12:00", "23:00"],
        responsibleUserId: null,
      },
      ventilation: {
        times: ["12:00", "10:00", "23:00"],
        responsibleUserId: null,
      },
      wetCleaning: {
        times: ["12:00", "18:00"],
        responsibleUserId: null,
      },
    },
    procedure: {
      surfaces:
        "дверные ручки, выключатели, стены, поверхности столов, спинки стульев, меню, кассовый аппарат, орг.техника",
      ventilationRooms: "производственный цех",
      wetCleaningRooms:
        "заготовочный цех, мясной цех, холодный цех, горячий цех, обеденный зал, бар",
      detergent: "Ph Средство дезинфицирующее - 0.5%",
    },
    responsiblePersons: [],
    periodicity: {
      disinfectionPerDay: 3,
      ventilationPerDay: 3,
      wetCleaningPerDay: 2,
    },
  };
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function normalizeScheduleItem(value: unknown): CleaningScheduleItem {
  const defaults: CleaningScheduleItem = { times: [], responsibleUserId: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const rec = value as Record<string, unknown>;
  return {
    times: normalizeStringArray(rec.times),
    responsibleUserId:
      typeof rec.responsibleUserId === "string" && rec.responsibleUserId.trim() !== ""
        ? rec.responsibleUserId
        : null,
  };
}

export function normalizeCleaningDocumentConfig(
  value: unknown
): CleaningDocumentConfig {
  const defaults = defaultCleaningDocumentConfig();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const rec = value as Record<string, unknown>;

  // schedule
  const scheduleRaw =
    rec.schedule && typeof rec.schedule === "object" && !Array.isArray(rec.schedule)
      ? (rec.schedule as Record<string, unknown>)
      : {};

  const schedule = {
    disinfection: normalizeScheduleItem(scheduleRaw.disinfection),
    ventilation: normalizeScheduleItem(scheduleRaw.ventilation),
    wetCleaning: normalizeScheduleItem(scheduleRaw.wetCleaning),
  };

  // If schedule items are empty, fall back to defaults
  if (schedule.disinfection.times.length === 0)
    schedule.disinfection = defaults.schedule.disinfection;
  if (schedule.ventilation.times.length === 0)
    schedule.ventilation = defaults.schedule.ventilation;
  if (schedule.wetCleaning.times.length === 0)
    schedule.wetCleaning = defaults.schedule.wetCleaning;

  // procedure
  const procedureRaw =
    rec.procedure &&
    typeof rec.procedure === "object" &&
    !Array.isArray(rec.procedure)
      ? (rec.procedure as Record<string, unknown>)
      : {};

  const procedure: CleaningProcedure = {
    surfaces: normalizeText(procedureRaw.surfaces, defaults.procedure.surfaces),
    ventilationRooms: normalizeText(
      procedureRaw.ventilationRooms,
      defaults.procedure.ventilationRooms
    ),
    wetCleaningRooms: normalizeText(
      procedureRaw.wetCleaningRooms,
      defaults.procedure.wetCleaningRooms
    ),
    detergent: normalizeText(procedureRaw.detergent, defaults.procedure.detergent),
  };

  // responsiblePersons
  const responsiblePersons: CleaningResponsiblePerson[] = Array.isArray(
    rec.responsiblePersons
  )
    ? rec.responsiblePersons
        .filter(
          (p): p is Record<string, unknown> =>
            !!p && typeof p === "object" && !Array.isArray(p)
        )
        .map((p) => ({
          userId: normalizeText(p.userId),
          title: normalizeText(p.title),
        }))
        .filter((p) => p.userId !== "")
    : [];

  // periodicity
  const periodicityRaw =
    rec.periodicity &&
    typeof rec.periodicity === "object" &&
    !Array.isArray(rec.periodicity)
      ? (rec.periodicity as Record<string, unknown>)
      : {};

  const periodicity = {
    disinfectionPerDay:
      typeof periodicityRaw.disinfectionPerDay === "number"
        ? periodicityRaw.disinfectionPerDay
        : defaults.periodicity.disinfectionPerDay,
    ventilationPerDay:
      typeof periodicityRaw.ventilationPerDay === "number"
        ? periodicityRaw.ventilationPerDay
        : defaults.periodicity.ventilationPerDay,
    wetCleaningPerDay:
      typeof periodicityRaw.wetCleaningPerDay === "number"
        ? periodicityRaw.wetCleaningPerDay
        : defaults.periodicity.wetCleaningPerDay,
  };

  return {
    ventilationEnabled:
      typeof rec.ventilationEnabled === "boolean"
        ? rec.ventilationEnabled
        : defaults.ventilationEnabled,
    skipWeekends:
      typeof rec.skipWeekends === "boolean"
        ? rec.skipWeekends
        : defaults.skipWeekends,
    schedule,
    procedure,
    responsiblePersons,
    periodicity,
  };
}

export function normalizeCleaningEntryData(value: unknown): CleaningEntryData {
  const empty: CleaningEntryData = { activities: [] };

  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;

  const rec = value as Record<string, unknown>;

  const VALID_TYPES = new Set<string>(["disinfection", "ventilation", "wetCleaning"]);

  const activities: CleaningActivityEntry[] = Array.isArray(rec.activities)
    ? rec.activities
        .filter(
          (a): a is Record<string, unknown> =>
            !!a && typeof a === "object" && !Array.isArray(a)
        )
        .filter((a) => typeof a.type === "string" && VALID_TYPES.has(a.type))
        .map((a) => ({
          type: a.type as CleaningActivityType,
          times: normalizeStringArray(a.times),
          responsibleName: normalizeText(a.responsibleName),
        }))
    : [];

  return { activities };
}

// ---------------------------------------------------------------------------
// Auto-fill
// ---------------------------------------------------------------------------

export function buildCleaningAutoFillEntries(params: {
  config: CleaningDocumentConfig;
  dateFrom: string;
  dateTo: string;
  users: { id: string; name: string }[];
}): Array<{ date: string; data: CleaningEntryData }> {
  const { config, dateFrom, dateTo, users } = params;
  const todayKey = toDateKey(new Date());

  const resolveResponsibleName = (userId: string | null): string => {
    if (userId) {
      const found = users.find((u) => u.id === userId);
      if (found) return found.name;
    }
    return users[0]?.name ?? "";
  };

  const activityTypes: CleaningActivityType[] = config.ventilationEnabled
    ? ["disinfection", "ventilation", "wetCleaning"]
    : ["disinfection", "wetCleaning"];

  return buildDateKeys(dateFrom, dateTo)
    .filter((dateKey) => dateKey <= todayKey)
    .filter((dateKey) => !(config.skipWeekends && isWeekend(dateKey)))
    .map((dateKey) => {
      const activities: CleaningActivityEntry[] = activityTypes.map((type) => {
        const scheduleItem = config.schedule[type];
        return {
          type,
          times: [...scheduleItem.times],
          responsibleName: resolveResponsibleName(scheduleItem.responsibleUserId),
        };
      });

      return {
        date: dateKey,
        data: { activities },
      };
    });
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function getCleaningDocumentTitle(): string {
  return CLEANING_PAGE_TITLE;
}

export function getCleaningCreatePeriodBounds(referenceDate = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const date = coerceUtcDate(referenceDate);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return {
    dateFrom: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function getCleaningPeriodLabel(
  dateFrom: Date | string,
  dateTo: Date | string
): string {
  return formatMonthLabel(dateFrom, dateTo);
}

export function getCleaningFilePrefix(): string {
  return "cleaning-checklist";
}

// ---------------------------------------------------------------------------
// Legacy compatibility shims
// These are kept so existing consumer files (cleaning-document-client,
// [id]/cleaning/route, journal-documents/route, document-pdf) keep compiling
// while they await their own rewrites.
// ---------------------------------------------------------------------------

/** @deprecated Use CleaningDocumentConfig instead */
export type CleaningMark = "routine" | "general";

/** @deprecated Part of old room-×-date grid model */
export type CleaningConfigItem = {
  id: string;
  sourceAreaId: string | null;
  name: string;
  detergent: string;
  routineScope: string;
  generalScope: string;
};

export const CLEANING_DOCUMENT_TITLE = CLEANING_PAGE_TITLE;

export const CLEANING_MARK_OPTIONS = [
  { value: "routine" as const, code: "Т", label: "Текущая" },
  { value: "general" as const, code: "Г", label: "Генеральная" },
] as const;

export const CLEANING_LEGEND = [
  "Т - текущая уборка",
  "Г - генеральная уборка",
  "Пустая ячейка - уборка не отмечена",
] as const;

function legacyCreateId(prefix: string) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

/** @deprecated Part of old room-×-date grid model */
export function createCleaningConfigItem(
  overrides: Partial<CleaningConfigItem> = {}
): CleaningConfigItem {
  const t = (v: unknown, fb = "") => (typeof v === "string" ? (v as string).trim() : fb);
  return {
    id: overrides.id || legacyCreateId("cleaning-row"),
    sourceAreaId: overrides.sourceAreaId || null,
    name: t(overrides.name, "помещение"),
    detergent: t(overrides.detergent),
    routineScope: t(overrides.routineScope),
    generalScope: t(overrides.generalScope),
  };
}

/** @deprecated Part of old room-×-date grid model */
export function getCleaningMarkCode(mark: CleaningMark | null | undefined) {
  return CLEANING_MARK_OPTIONS.find((option) => option.value === mark)?.code || "";
}

/** @deprecated Part of old room-×-date grid model */
export function createEmptyCleaningEntryData(
  mark: CleaningMark | null = null
): { mark: CleaningMark | null } {
  return { mark };
}

/** @deprecated Use defaultCleaningDocumentConfig instead */
export function getDefaultCleaningDocumentConfig() {
  return defaultCleaningDocumentConfig();
}

/** @deprecated Part of old room-×-date grid model */
export function buildCleaningConfigFromAreas(
  areas: { id: string; name: string }[],
  _userDefaults?: { responsibleCleaningUserId?: string | null; responsibleControlUserId?: string | null }
): CleaningDocumentConfig {
  void areas;
  return defaultCleaningDocumentConfig();
}

/** @deprecated Part of old room-×-date grid model */
export function getDefaultCleaningResponsibleIds(
  users: { id: string; role: string }[]
) {
  const responsibleCleaningUserId =
    users.find((u) => u.role === "operator")?.id ||
    users.find((u) => u.role === "technologist")?.id ||
    users[0]?.id ||
    null;

  const responsibleControlUserId =
    users.find((u) => u.role === "owner")?.id ||
    users.find((u) => u.role === "technologist")?.id ||
    users.find((u) => u.id !== responsibleCleaningUserId)?.id ||
    responsibleCleaningUserId ||
    null;

  return { responsibleCleaningUserId, responsibleControlUserId };
}

/** @deprecated Use buildCleaningAutoFillEntries instead */
export function buildCleaningAutoFillRows(params: {
  config: CleaningDocumentConfig;
  dateFrom: Date | string;
  dateTo: Date | string;
  referenceDate?: Date | string;
}): Array<{ employeeId: string; date: Date; data: { mark: CleaningMark | null } }> {
  const { config, dateFrom, dateTo, referenceDate = new Date() } = params;
  const todayKey = toDateKey(referenceDate);

  return buildDateKeys(dateFrom, dateTo)
    .filter((dateKey) => dateKey <= todayKey)
    .filter((dateKey) => !(config.skipWeekends && isWeekend(dateKey)))
    .map((dateKey) => ({
      employeeId: `auto:${dateKey}`,
      date: new Date(dateKey),
      data: createEmptyCleaningEntryData("routine"),
    }));
}
