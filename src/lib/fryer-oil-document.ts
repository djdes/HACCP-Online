export const FRYER_OIL_TEMPLATE_CODE = "fryer_oil";

export const FRYER_OIL_PAGE_TITLE = "Журнал учета использования фритюрных жиров";

// Default select list values
export const DEFAULT_FAT_TYPES = [
  "Подсолнечное масло",
  "Пальмовое масло",
  "Соевое масло",
  "Рапсовое масло",
  "Кокосовое масло",
];

export const DEFAULT_EQUIPMENT_TYPES = [
  "Фритюрница №1",
  "Фритюрница №2",
  "Фритюрница №3",
];

export const DEFAULT_PRODUCT_TYPES = [
  "Вареники",
  "Пельмени",
  "Подсолнечное масло",
];

// Quality score labels (1–5)
export const QUALITY_LABELS: Record<number, string> = {
  5: "Отличное",
  4: "Хорошее",
  3: "Удовлетворительное",
  2: "Неудовлетворительное",
  1: "Неудовлетворительное",
};

// Full quality assessment reference table (Приложение)
export const QUALITY_ASSESSMENT_TABLE = {
  indicators: [
    {
      name: "Цвет",
      scores: {
        5: "Соломенно-желтый",
        4: "Интенсивно-желтый с коричневым оттенком",
        3: "Светло-коричневый",
        2: "Коричневый или темно-коричневый",
        1: "Коричневый или темно-коричневый",
      },
      coefficient: 3,
    },
    {
      name: "Вкус",
      scores: {
        5: "Без постороннего привкуса",
        4: "Слабо выраженный горьковатый",
        3: "Горький с ярко выраженным посторонним привкусом",
        2: "Очень горький, вызывающий неприятное ощущение першения",
        1: "Очень горький, вызывающий неприятное ощущение першения",
      },
      coefficient: 2,
    },
    {
      name: "Запах",
      scores: {
        5: "Без постороннего запаха",
        4: "Слабо выраженный неприятный продуктов термического распада масла",
        3: "Выраженный неприятный",
        2: "Резкий неприятный",
        1: "Резкий неприятный",
      },
      coefficient: 2,
    },
  ],
  gradingTable: [
    { label: "Отличное", score: 5 },
    { label: "Хорошее", score: 4 },
    { label: "Удовлетворительное", score: 3 },
    { label: "Неудовлетворительное", score: 2 },
    { label: "Неудовлетворительное", score: 1 },
  ],
  formulaExample: "(4 × 3 + 3 × 2 + 3 × 2) / 7 = 3,4",
};

// Types
export type FryerOilSelectLists = {
  fatTypes: string[];
  equipmentTypes: string[];
  productTypes: string[];
};

export type FryerOilDocumentConfig = {
  lists: FryerOilSelectLists;
};

export type FryerOilEntryData = {
  startDate: string;        // ISO date string "YYYY-MM-DD"
  startHour: number;        // 0–23
  startMinute: number;      // 0–59
  fatType: string;
  qualityStart: number;     // 1–5
  equipmentType: string;
  productType: string;
  endHour: number;          // 0–23
  endMinute: number;        // 0–59
  qualityEnd: number;       // 1–5
  carryoverKg: number;      // остаток жира, кг
  disposedKg: number;       // слито/утилизировано, кг
  controllerName: string;
};

// Factory / default helpers
export function defaultFryerOilDocumentConfig(): FryerOilDocumentConfig {
  return {
    lists: {
      fatTypes: [...DEFAULT_FAT_TYPES],
      equipmentTypes: [...DEFAULT_EQUIPMENT_TYPES],
      productTypes: [...DEFAULT_PRODUCT_TYPES],
    },
  };
}

// Normalizers
function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((v) => typeof v === "string" && v.trim()).map((v) => (v as string).trim());
}

export function normalizeFryerOilSelectLists(value: unknown): FryerOilSelectLists {
  const defaults = defaultFryerOilDocumentConfig().lists;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }
  const item = value as Record<string, unknown>;
  return {
    fatTypes: normalizeStringArray(item.fatTypes, defaults.fatTypes),
    equipmentTypes: normalizeStringArray(item.equipmentTypes, defaults.equipmentTypes),
    productTypes: normalizeStringArray(item.productTypes, defaults.productTypes),
  };
}

export function normalizeFryerOilDocumentConfig(value: unknown): FryerOilDocumentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultFryerOilDocumentConfig();
  }
  const item = value as Record<string, unknown>;
  return {
    lists: normalizeFryerOilSelectLists(item.lists),
  };
}

export function normalizeFryerOilEntryData(value: unknown): FryerOilEntryData {
  const defaults: FryerOilEntryData = {
    startDate: "",
    startHour: 8,
    startMinute: 0,
    fatType: "",
    qualityStart: 5,
    equipmentType: "",
    productType: "",
    endHour: 17,
    endMinute: 0,
    qualityEnd: 5,
    carryoverKg: 0,
    disposedKg: 0,
    controllerName: "",
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const item = value as Record<string, unknown>;

  function safeInt(v: unknown, fallback: number, min?: number, max?: number): number {
    const n = typeof v === "number" ? Math.round(v) : typeof v === "string" ? parseInt(v, 10) : NaN;
    if (isNaN(n)) return fallback;
    if (min !== undefined && n < min) return fallback;
    if (max !== undefined && n > max) return fallback;
    return n;
  }

  function safeFloat(v: unknown, fallback: number): number {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    if (isNaN(n) || n < 0) return fallback;
    return n;
  }

  return {
    startDate: typeof item.startDate === "string" ? item.startDate : defaults.startDate,
    startHour: safeInt(item.startHour, defaults.startHour, 0, 23),
    startMinute: safeInt(item.startMinute, defaults.startMinute, 0, 59),
    fatType: typeof item.fatType === "string" ? item.fatType : defaults.fatType,
    qualityStart: safeInt(item.qualityStart, defaults.qualityStart, 1, 5),
    equipmentType: typeof item.equipmentType === "string" ? item.equipmentType : defaults.equipmentType,
    productType: typeof item.productType === "string" ? item.productType : defaults.productType,
    endHour: safeInt(item.endHour, defaults.endHour, 0, 23),
    endMinute: safeInt(item.endMinute, defaults.endMinute, 0, 59),
    qualityEnd: safeInt(item.qualityEnd, defaults.qualityEnd, 1, 5),
    carryoverKg: safeFloat(item.carryoverKg, defaults.carryoverKg),
    disposedKg: safeFloat(item.disposedKg, defaults.disposedKg),
    controllerName: typeof item.controllerName === "string" ? item.controllerName : defaults.controllerName,
  };
}

// Public accessors
export function getFryerOilDocumentTitle(): string {
  return FRYER_OIL_PAGE_TITLE;
}

export function getFryerOilFilePrefix(): string {
  return "fryer-oil-journal";
}

// Formatting utilities
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatDateRu(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}
