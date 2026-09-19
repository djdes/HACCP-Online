export const EQUIPMENT_MAINTENANCE_TEMPLATE_CODE = "equipment_maintenance";
export const EQUIPMENT_MAINTENANCE_DOCUMENT_TITLE = "График профилактического обслуживания оборудования";

export const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export const MONTH_LABELS: Record<string, string> = {
  jan: "Янв", feb: "Фев", mar: "Мар", apr: "Апр", may: "Май", jun: "Июн",
  jul: "Июл", aug: "Авг", sep: "Сен", oct: "Окт", nov: "Ноя", dec: "Дек",
};

export const MONTH_FULL_LABELS: Record<string, string> = {
  jan: "Январь", feb: "Февраль", mar: "Март", apr: "Апрель", may: "Май", jun: "Июнь",
  jul: "Июль", aug: "Август", sep: "Сентябрь", oct: "Октябрь", nov: "Ноябрь", dec: "Декабрь",
};

export type MaintenanceType = "A" | "B";

export type EquipmentMaintenanceRow = {
  id: string;
  equipmentName: string;
  workType: string;
  maintenanceType: MaintenanceType;
  plan: Record<string, string>;
  fact: Record<string, string>;
};

export type EquipmentMaintenanceConfig = {
  rows: EquipmentMaintenanceRow[];
  year: number;
  documentDate: string;
  approveRole: string;
  approveEmployeeId?: string | null;
  approveEmployee: string;
  responsibleRole: string;
  responsibleEmployeeId?: string | null;
  responsibleEmployee: string;
};

function createId(prefix: string) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMonthMap(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    for (const key of MONTH_KEYS) result[key] = "-";
    return result;
  }
  const obj = value as Record<string, unknown>;
  for (const key of MONTH_KEYS) {
    result[key] = typeof obj[key] === "string" ? obj[key] as string : "-";
  }
  return result;
}

export function createEquipmentMaintenanceRow(
  overrides: Partial<EquipmentMaintenanceRow> = {}
): EquipmentMaintenanceRow {
  return {
    id: overrides.id || createId("maint-row"),
    equipmentName: normalizeText(overrides.equipmentName),
    workType: normalizeText(overrides.workType),
    maintenanceType: overrides.maintenanceType === "A" ? "A" : "B",
    plan: normalizeMonthMap(overrides.plan),
    fact: normalizeMonthMap(overrides.fact),
  };
}

type EquipmentMaintenanceSource = {
  id: string;
  name: string;
  type?: string | null;
};

/**
 * Строит конфиг ППР из реального списка Equipment орги. Каждая
 * единица оборудования становится отдельной строкой графика. Тип
 * обслуживания эвристически берётся из `Equipment.type`:
 *   - холодильное / морозильное → "B" (профилактика)
 *   - всё остальное → "A" (текущее обслуживание)
 *
 * Если equipment пуст — возвращает stub-дефолт от
 * `getDefaultEquipmentMaintenanceConfig`.
 */
export function buildEquipmentMaintenanceConfigFromEquipment(
  equipment: EquipmentMaintenanceSource[],
  year = new Date().getUTCFullYear()
): EquipmentMaintenanceConfig {
  if (equipment.length === 0) {
    return getDefaultEquipmentMaintenanceConfig(year);
  }

  const emptyPlan: Record<string, string> = {};
  const emptyFact: Record<string, string> = {};
  for (const key of MONTH_KEYS) {
    emptyPlan[key] = "-";
    emptyFact[key] = "";
  }

  const rows = equipment.map((item) => {
    const normalizedType = (item.type ?? "").toLowerCase();
    const isCold =
      normalizedType.includes("refrigerator") ||
      normalizedType.includes("freezer") ||
      normalizedType.includes("холодильн") ||
      normalizedType.includes("морозильн");
    return createEquipmentMaintenanceRow({
      equipmentName: item.name,
      maintenanceType: isCold ? "B" : "A",
      plan: { ...emptyPlan },
      fact: { ...emptyFact },
    });
  });

  return {
    year,
    documentDate: `${year}-01-01`,
    approveRole: "Управляющий",
    approveEmployeeId: null,
    approveEmployee: "",
    responsibleRole: "Шеф-повар",
    responsibleEmployeeId: null,
    responsibleEmployee: "",
    rows,
  };
}

export function getDefaultEquipmentMaintenanceConfig(
  year = new Date().getUTCFullYear()
): EquipmentMaintenanceConfig {
  // ПОЧЕМУ пусто: журнал предъявляют инспектору. Раньше здесь лежали
  // четыре выдуманные единицы оборудования с проставленными планом И
  // фактом — каждый новый документ и его печать содержали отметки о
  // работах, которых не было. Строки берутся из справочника оборудования
  // при создании документа, факт проставляет человек.
  return {
    year,
    documentDate: `${year}-01-01`,
    approveRole: "Управляющий",
    approveEmployeeId: null,
    approveEmployee: "",
    responsibleRole: "Шеф-повар",
    responsibleEmployeeId: null,
    responsibleEmployee: "",
    rows: [],
  };
}

export function normalizeEquipmentMaintenanceConfig(
  value: unknown
): EquipmentMaintenanceConfig {
  const defaults = getDefaultEquipmentMaintenanceConfig();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.rows)
    ? record.rows
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          return createEquipmentMaintenanceRow(item as Partial<EquipmentMaintenanceRow>);
        })
        .filter((item): item is EquipmentMaintenanceRow => item !== null)
    : defaults.rows;

  const year =
    typeof record.year === "number" && Number.isFinite(record.year)
      ? Math.trunc(record.year)
      : defaults.year;

  return {
    rows,
    year,
    documentDate: normalizeText(record.documentDate) || defaults.documentDate,
    approveRole: normalizeText(record.approveRole) || defaults.approveRole,
    approveEmployeeId:
      normalizeText(record.approveEmployeeId) || defaults.approveEmployeeId || null,
    approveEmployee: normalizeText(record.approveEmployee) || defaults.approveEmployee,
    responsibleRole: normalizeText(record.responsibleRole) || defaults.responsibleRole,
    responsibleEmployeeId:
      normalizeText(record.responsibleEmployeeId) || defaults.responsibleEmployeeId || null,
    responsibleEmployee: normalizeText(record.responsibleEmployee) || defaults.responsibleEmployee,
  };
}

export function formatMaintenanceDate(dateKey: string): string {
  if (!dateKey) return "";
  const [year, month, day] = dateKey.split("-");
  return year && month && day ? `${day}-${month}-${year}` : dateKey;
}

export function getMaintenanceCreatePeriodBounds(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

export const DAY_OPTIONS = ["-", ...Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))];

/**
 * Дни месяца для выпадающего списка плана/факта. Раньше список был
 * жёстко 1–28, и ППР нельзя было назначить на 29–31 число.
 */
export function getMonthDayOptions(monthKey: string, year: number): string[] {
  const monthIndex = MONTH_KEYS.indexOf(monthKey as (typeof MONTH_KEYS)[number]);
  const safeYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear();
  const daysInMonth =
    monthIndex >= 0 ? new Date(Date.UTC(safeYear, monthIndex + 1, 0)).getUTCDate() : 31;
  return [
    "-",
    ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0")),
  ];
}
