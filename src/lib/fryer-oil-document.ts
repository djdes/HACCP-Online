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
    // Формулировки первого столбца и строки «Запах» — дословно по эталону
    // lk.haccp-online.ru (docs/reference/haccp-online/screenshots/
    // fryer_oil-grid.png), включая условия замера в скобках.
    {
      name: "Цвет (в проходящем и отраженном свете на белом фоне при температуре 40°C)",
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
        3: "Горький, с ярко выраженным посторонним привкусом",
        2: "Очень горький, вызывающий неприятное ощущение першения",
        1: "Очень горький, вызывающий неприятное ощущение першения",
      },
      coefficient: 2,
    },
    {
      name: "Запах (при температуре не ниже 50°C)",
      scores: {
        5: "Без постороннего запаха",
        4: "Слабо выраженный, неприятный, продуктов термического распада масла",
        3: "Выраженный, неприятный, продуктов термического распада масла",
        2: "Резкий, неприятный, продуктов термического распада масла",
        1: "Резкий, неприятный, продуктов термического распада масла",
      },
      coefficient: 2,
    },
  ],
  // Эталон (lk.haccp-online.ru, fryer_oil-2-doc.png) держит ЧЕТЫРЕ строки:
  // «неудовлетворительное» — одна строка с баллом «2 или 1», а не два
  // дубля с одинаковой подписью. Балл поэтому строка, а не число.
  gradingTable: [
    { label: "Отличное", score: "5" },
    { label: "Хорошее", score: "4" },
    { label: "Удовлетворительное", score: "3" },
    { label: "Неудовлетворительное", score: "2 или 1" },
  ],
  formulaExample: "(4 x 3 + 3 x 2 + 3 x 2)/7 = 3,4",
  // Расшифровка формулы — дословно по эталону, отдельными строками.
  formulaExplanation: [
    "где в числителе:",
    "4, 3, 3 - баллы по показателям качества",
    "3, 2, 2 - коэффициенты важности",
    "в знаменателе:",
    "7 - сумма коэффициента важности",
  ],
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

/**
 * Время и оценки качества — nullable. ПОЧЕМУ: сидер создаёт строку на
 * каждый день периода (структура «дата → строка» нужна), но сама строка
 * пустая — `{_autoSeeded:true}`. Раньше нормализация подставляла
 * qualityStart/qualityEnd = 5 («Отличное») и endHour = 17, и свежий
 * журнал открывался «идеально заполненным на месяц вперёд» — для
 * инспектора это выдуманные записи. Теперь незаполненное = null и
 * рисуется прочерком.
 */
export type FryerOilEntryData = {
  startDate: string;                // ISO date string "YYYY-MM-DD"
  startHour: number | null;         // 0–23
  startMinute: number | null;       // 0–59
  fatType: string;
  qualityStart: number | null;      // 1–5
  equipmentType: string;
  productType: string;
  endHour: number | null;           // 0–23
  endMinute: number | null;         // 0–59
  qualityEnd: number | null;        // 1–5
  carryoverKg: number;              // остаток жира, кг
  disposedKg: number;               // слито/утилизировано, кг
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
    startHour: null,
    startMinute: null,
    fatType: "",
    qualityStart: null,
    equipmentType: "",
    productType: "",
    endHour: null,
    endMinute: null,
    qualityEnd: null,
    carryoverKg: 0,
    disposedKg: 0,
    controllerName: "",
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const item = value as Record<string, unknown>;

  function safeInt(
    v: unknown,
    fallback: number | null,
    min?: number,
    max?: number
  ): number | null {
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
/** Пустое время (обе части null) — пустая строка, а не «00:00». */
export function formatTime(hour: number | null, minute: number | null): string {
  if (hour === null && minute === null) return "";
  return `${String(hour ?? 0).padStart(2, "0")}:${String(minute ?? 0).padStart(2, "0")}`;
}

/** Подпись оценки качества (1–5) или пусто, если оценки нет. */
export function formatQualityLabel(score: number | null): string {
  if (score === null) return "";
  return QUALITY_LABELS[score] || String(score);
}

export function formatDateRu(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}
