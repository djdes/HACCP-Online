export const PRODUCT_WRITEOFF_TEMPLATE_CODE = "product_writeoff";
export const PRODUCT_WRITEOFF_DOCUMENT_TITLE = "Акт забраковки";

export type ProductWriteoffCommissionMember = {
  id: string;
  role: string;
  employeeId: string;
  employeeName: string;
};

export type ProductWriteoffRow = {
  id: string;
  productName: string;
  batchNumber: string;
  productionDate: string;
  quantity: string;
  discrepancyDescription: string;
  action: string;
};

export type ProductWriteoffProductList = {
  id: string;
  name: string;
  items: string[];
};

export type ProductWriteoffConfig = {
  documentName: string;
  actNumber: string;
  documentDate: string;
  comment: string;
  supplierName: string;
  commissionMembers: ProductWriteoffCommissionMember[];
  rows: ProductWriteoffRow[];
  productLists: ProductWriteoffProductList[];
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

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function formatProductWriteoffDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU");
}

export function formatProductWriteoffDateLong(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function createProductWriteoffCommissionMember(
  overrides: Partial<ProductWriteoffCommissionMember> = {}
): ProductWriteoffCommissionMember {
  return {
    id: overrides.id || createId("product-writeoff-commission"),
    role: normalizeText(overrides.role),
    employeeId: normalizeText(overrides.employeeId),
    employeeName: normalizeText(overrides.employeeName),
  };
}

export function createProductWriteoffRow(
  overrides: Partial<ProductWriteoffRow> = {}
): ProductWriteoffRow {
  return {
    id: overrides.id || createId("product-writeoff-row"),
    productName: normalizeText(overrides.productName),
    batchNumber: normalizeText(overrides.batchNumber),
    productionDate: normalizeText(overrides.productionDate),
    quantity: normalizeText(overrides.quantity),
    discrepancyDescription: normalizeText(overrides.discrepancyDescription),
    action: normalizeText(overrides.action),
  };
}

export function getDefaultProductWriteoffConfig(referenceDate = new Date()): ProductWriteoffConfig {
  return {
    documentName: PRODUCT_WRITEOFF_DOCUMENT_TITLE,
    actNumber: "1",
    documentDate: isoDate(referenceDate),
    comment: "",
    supplierName: "",
    commissionMembers: [],
    rows: [],
    productLists: [{ id: createId("product-writeoff-list"), name: "Продукция", items: [] }],
  };
}

export function buildProductWriteoffConfigFromData(params: {
  users: Array<{ id: string; name: string; role?: string | null }>;
  products: Array<{ name: string }>;
  batches: Array<{
    code: string;
    productName: string;
    supplier?: string | null;
    quantity: number;
    unit?: string | null;
    receivedAt?: Date | null;
  }>;
  referenceDate?: Date;
}) {
  const { users, products, batches, referenceDate = new Date() } = params;
  const config = getDefaultProductWriteoffConfig(referenceDate);

  const commissionUsers = users.slice(0, 2);
  config.commissionMembers = commissionUsers.map((user, index) =>
    createProductWriteoffCommissionMember({
      role: index === 0 ? "Управляющий" : "Технолог",
      employeeId: user.id,
      employeeName: user.name,
    })
  );

  const firstBatch = batches[0];
  if (firstBatch?.supplier) {
    config.supplierName = firstBatch.supplier;
  }

  const sampleRows = batches.slice(0, 2).map((batch) =>
    createProductWriteoffRow({
      productName: batch.productName,
      batchNumber: batch.code,
      productionDate: batch.receivedAt ? formatProductWriteoffDate(batch.receivedAt) : "",
      quantity:
        Number.isFinite(batch.quantity) && batch.quantity > 0
          ? `${batch.quantity}${batch.unit ? ` ${batch.unit}` : ""}`
          : "",
      discrepancyDescription: "Несоответствие качества",
      action: "Утиль",
    })
  );

  config.rows = sampleRows;

  const items = Array.from(
    new Set([
      ...products.map((product) => product.name.trim()).filter(Boolean),
      ...batches.map((batch) => batch.productName.trim()).filter(Boolean),
    ])
  );

  config.productLists = [{ id: createId("product-writeoff-list"), name: "Продукция", items }];
  return config;
}

export function normalizeProductWriteoffConfig(value: unknown): ProductWriteoffConfig {
  const defaults = getDefaultProductWriteoffConfig();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.rows)
    ? record.rows
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          return createProductWriteoffRow(item as Partial<ProductWriteoffRow>);
        })
        .filter((item): item is ProductWriteoffRow => item !== null)
    : [];

  const commissionMembers = Array.isArray(record.commissionMembers)
    ? record.commissionMembers
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          return createProductWriteoffCommissionMember(item as Partial<ProductWriteoffCommissionMember>);
        })
        .filter((item): item is ProductWriteoffCommissionMember => item !== null)
    : [];

  const productLists = Array.isArray(record.productLists)
    ? record.productLists
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const list = item as Record<string, unknown>;
          const name = normalizeText(list.name);
          return {
            id: normalizeText(list.id) || createId("product-writeoff-list"),
            name: name || "Продукция",
            items: Array.isArray(list.items)
              ? list.items
                  .filter((listItem) => typeof listItem === "string")
                  .map((listItem) => listItem.trim())
                  .filter(Boolean)
              : [],
          };
        })
        .filter((item): item is ProductWriteoffProductList => item !== null)
    : defaults.productLists;

  return {
    documentName: normalizeText(record.documentName) || defaults.documentName,
    actNumber: normalizeText(record.actNumber) || defaults.actNumber,
    documentDate: normalizeText(record.documentDate) || defaults.documentDate,
    comment: normalizeText(record.comment),
    supplierName: normalizeText(record.supplierName),
    commissionMembers,
    rows,
    productLists: productLists.length > 0 ? productLists : defaults.productLists,
  };
}

export function getProductWriteoffDocumentTitle() {
  return PRODUCT_WRITEOFF_DOCUMENT_TITLE;
}

export function getProductWriteoffDocumentListTitle(config: ProductWriteoffConfig) {
  const name = config.documentName || PRODUCT_WRITEOFF_DOCUMENT_TITLE;
  return config.actNumber ? `${name}, акт № ${config.actNumber}` : name;
}

export function getProductWriteoffCreatePeriodBounds(referenceDate = new Date()) {
  const date = isoDate(referenceDate);
  return { dateFrom: date, dateTo: date };
}

export function getProductWriteoffFilePrefix() {
  return "product-writeoff-act";
}
