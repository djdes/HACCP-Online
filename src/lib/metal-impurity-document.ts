export const METAL_IMPURITY_TEMPLATE_CODE = "metal_impurity";
export const METAL_IMPURITY_SOURCE_SLUG = "metalimpurityjournal";
export const METAL_IMPURITY_DOCUMENT_TITLE = "Журнал учета металлопримесей";

export type MetalImpurityOption = {
  id: string;
  name: string;
};

export type MetalImpurityRow = {
  id: string;
  date: string;
  materialId: string;
  supplierId: string;
  consumedQuantityKg: string;
  impurityQuantityG: string;
  impurityCharacteristic: string;
  responsibleName: string;
};

export type MetalImpurityDocumentConfig = {
  startDate: string;
  endDate: string;
  responsiblePosition: string;
  responsibleEmployee: string;
  materials: MetalImpurityOption[];
  suppliers: MetalImpurityOption[];
  rows: MetalImpurityRow[];
};

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeOptions(value: unknown, fallback: MetalImpurityOption[]) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      const name = safeText(source.name);
      if (!name) return null;
      return {
        id: safeText(source.id, `option-${index + 1}`),
        name,
      };
    })
    .filter((item): item is MetalImpurityOption => item !== null);

  return items.length > 0 ? items : fallback;
}

function normalizeRows(value: unknown, fallback: MetalImpurityRow[]) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      return {
        id: safeText(source.id, `row-${index + 1}`),
        date: safeText(source.date),
        materialId: safeText(source.materialId),
        supplierId: safeText(source.supplierId),
        consumedQuantityKg: safeText(source.consumedQuantityKg),
        impurityQuantityG: safeText(source.impurityQuantityG),
        impurityCharacteristic: safeText(source.impurityCharacteristic),
        responsibleName: safeText(source.responsibleName),
      };
    })
    .filter((item): item is MetalImpurityRow => item !== null);

  return items.length > 0 ? items : fallback;
}

export function createMetalImpurityRow(params?: Partial<MetalImpurityRow>): MetalImpurityRow {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: createId("metal"),
    date: params?.date || today,
    materialId: params?.materialId || "",
    supplierId: params?.supplierId || "",
    consumedQuantityKg: params?.consumedQuantityKg || "",
    impurityQuantityG: params?.impurityQuantityG || "",
    impurityCharacteristic: params?.impurityCharacteristic || "",
    responsibleName: params?.responsibleName || "",
  };
}

export function getDefaultMetalImpurityConfig(params?: {
  responsibleName?: string;
  responsiblePosition?: string;
  date?: string;
}): MetalImpurityDocumentConfig {
  const startDate = params?.date || new Date().toISOString().slice(0, 10);
  const materials = [
    { id: "mat-1", name: "Мука пшеничная в/с" },
    { id: "mat-2", name: "Мука ржаная" },
  ];
  const suppliers = [
    { id: "sup-1", name: 'ООО "Агро-Юг"' },
    { id: "sup-2", name: 'ИП "Зерно"' },
  ];

  return {
    startDate,
    endDate: "",
    responsiblePosition: params?.responsiblePosition || "Управляющий",
    responsibleEmployee: params?.responsibleName || "Иванов И.И.",
    materials,
    suppliers,
    rows: [
      createMetalImpurityRow({
        date: startDate,
        materialId: materials[0].id,
        supplierId: suppliers[0].id,
        consumedQuantityKg: "250",
        impurityQuantityG: "0.45",
        impurityCharacteristic: "мелкие частицы темного металла",
        responsibleName: params?.responsibleName || "Иванов И.И.",
      }),
    ],
  };
}

export function normalizeMetalImpurityConfig(
  value: unknown,
  params?: {
    responsibleName?: string;
    responsiblePosition?: string;
    date?: string;
  }
): MetalImpurityDocumentConfig {
  const fallback = getDefaultMetalImpurityConfig(params);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const source = value as Record<string, unknown>;
  const materials = normalizeOptions(source.materials, fallback.materials);
  const suppliers = normalizeOptions(source.suppliers, fallback.suppliers);

  return {
    startDate: safeText(source.startDate, fallback.startDate),
    endDate: safeText(source.endDate, fallback.endDate),
    responsiblePosition: safeText(
      source.responsiblePosition,
      fallback.responsiblePosition
    ),
    responsibleEmployee: safeText(
      source.responsibleEmployee,
      fallback.responsibleEmployee
    ),
    materials,
    suppliers,
    rows: normalizeRows(source.rows, fallback.rows).map((row) => ({
      ...row,
      materialId: row.materialId || materials[0]?.id || "",
      supplierId: row.supplierId || suppliers[0]?.id || "",
      responsibleName: row.responsibleName || fallback.responsibleEmployee,
    })),
  };
}

export function getMetalImpurityValuePerKg(
  impurityQuantityG: string,
  consumedQuantityKg: string
) {
  const impurity = Number(impurityQuantityG.replace(",", "."));
  const consumed = Number(consumedQuantityKg.replace(",", "."));
  if (!Number.isFinite(impurity) || !Number.isFinite(consumed) || consumed <= 0) return "";
  return ((impurity * 1000) / consumed).toFixed(2);
}

export function getMetalImpurityOptionName(options: MetalImpurityOption[], id: string) {
  return options.find((item) => item.id === id)?.name || "—";
}
