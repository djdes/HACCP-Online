export const ACCEPTANCE_DOCUMENT_TEMPLATE_CODE = "incoming_control";

export type AcceptanceRow = {
  id: string;
  deliveryDate: string;
  deliveryHour: string;
  deliveryMinute: string;
  productName: string;
  manufacturer: string;
  supplier: string;
  transportCondition: "satisfactory" | "unsatisfactory";
  packagingCompliance: "compliant" | "non_compliant";
  organolepticResult: "satisfactory" | "unsatisfactory";
  expiryDate: string;
  expiryHour: string;
  expiryMinute: string;
  note: string;
  responsibleTitle: string;
  responsibleUserId: string;
};

export type AcceptanceDocumentConfig = {
  rows: AcceptanceRow[];
  products: string[];
  manufacturers: string[];
  suppliers: string[];
  expiryFieldLabel: "expiry_deadline" | "shelf_life";
  showPackagingComplianceField: boolean;
  defaultResponsibleTitle: string | null;
  defaultResponsibleUserId: string | null;
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

function normalizeTransport(value: unknown): "satisfactory" | "unsatisfactory" {
  if (value === "unsatisfactory") return "unsatisfactory";
  return "satisfactory";
}

function normalizeCompliance(value: unknown): "compliant" | "non_compliant" {
  if (value === "non_compliant") return "non_compliant";
  // backward compat: old "no" → non_compliant
  if (value === "no") return "non_compliant";
  return "compliant";
}

function normalizeOrganoleptic(value: unknown): "satisfactory" | "unsatisfactory" {
  if (value === "unsatisfactory") return "unsatisfactory";
  // backward compat: old "reject" → unsatisfactory
  if (value === "reject") return "unsatisfactory";
  return "satisfactory";
}

export function createAcceptanceRow(
  overrides?: Partial<AcceptanceRow>
): AcceptanceRow {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: overrides?.id || createId("acceptance-row"),
    deliveryDate: normalizeText(overrides?.deliveryDate) || normalizeText((overrides as Record<string, unknown>)?.dateSupply) || today,
    deliveryHour: normalizeText(overrides?.deliveryHour),
    deliveryMinute: normalizeText(overrides?.deliveryMinute),
    productName: normalizeText(overrides?.productName),
    manufacturer: normalizeText(overrides?.manufacturer),
    supplier: normalizeText(overrides?.supplier),
    transportCondition: normalizeTransport(overrides?.transportCondition),
    packagingCompliance: normalizeCompliance(overrides?.packagingCompliance),
    organolepticResult: normalizeOrganoleptic(overrides?.organolepticResult || (overrides as Record<string, unknown>)?.decision),
    expiryDate: normalizeText(overrides?.expiryDate),
    expiryHour: normalizeText(overrides?.expiryHour),
    expiryMinute: normalizeText(overrides?.expiryMinute),
    note: normalizeText(overrides?.note) || normalizeText((overrides as Record<string, unknown>)?.correctiveAction),
    responsibleTitle: normalizeText(overrides?.responsibleTitle),
    responsibleUserId: normalizeText(overrides?.responsibleUserId),
  };
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => normalizeText(item))
    .filter((item, index, array) => item !== "" && array.indexOf(item) === index);
}

export function getAcceptanceDocumentDefaultConfig(
  users: Array<{ id: string; role?: string | null }>
): AcceptanceDocumentConfig {
  return {
    rows: [],
    products: [],
    manufacturers: [],
    suppliers: [],
    expiryFieldLabel: "expiry_deadline",
    showPackagingComplianceField: true,
    defaultResponsibleTitle: null,
    defaultResponsibleUserId: users[0]?.id || null,
  };
}

export function normalizeAcceptanceDocumentConfig(
  value: unknown,
  users: Array<{ id: string; role?: string | null }> = []
): AcceptanceDocumentConfig {
  const fallback = getAcceptanceDocumentDefaultConfig(users);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.rows)
    ? record.rows
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          return createAcceptanceRow(item as Partial<AcceptanceRow>);
        })
        .filter((item): item is AcceptanceRow => item !== null)
    : [];

  const defaultResponsibleUserId = normalizeText(record.defaultResponsibleUserId);
  const defaultResponsibleTitle = normalizeText(record.defaultResponsibleTitle);

  return {
    rows,
    products: normalizeStringList(record.products),
    manufacturers: normalizeStringList(record.manufacturers),
    suppliers: normalizeStringList(record.suppliers),
    expiryFieldLabel: record.expiryFieldLabel === "shelf_life" ? "shelf_life" : "expiry_deadline",
    showPackagingComplianceField:
      typeof record.showPackagingComplianceField === "boolean"
        ? record.showPackagingComplianceField
        : true,
    defaultResponsibleUserId:
      defaultResponsibleUserId || fallback.defaultResponsibleUserId,
    defaultResponsibleTitle: defaultResponsibleTitle || null,
  };
}

export function formatAcceptanceDateDash(date: string): string {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}-${month}-${year}` : date;
}

export function formatDeliveryDateTime(row: AcceptanceRow): string {
  let s = formatAcceptanceDateDash(row.deliveryDate);
  if (row.deliveryHour) {
    s += `\n${row.deliveryHour}:${row.deliveryMinute || "00"}`;
  }
  return s;
}

export function formatExpiryDateTime(row: AcceptanceRow): string {
  let s = formatAcceptanceDateDash(row.expiryDate);
  if (row.expiryHour) {
    s += `\n${row.expiryHour}:${row.expiryMinute || "00"}`;
  }
  return s;
}

export const TRANSPORT_LABELS = {
  satisfactory: "Удовл.",
  unsatisfactory: "Не удовл.",
} as const;

export const COMPLIANCE_LABELS = {
  compliant: "Соответствует",
  non_compliant: "Не соотв.",
} as const;

export const ORGANOLEPTIC_LABELS = {
  satisfactory: "Удовл.",
  unsatisfactory: "Не удовл.",
} as const;

export function getExpiryFieldDisplayLabel(mode: AcceptanceDocumentConfig["expiryFieldLabel"]): string {
  return mode === "shelf_life" ? "Срок годности" : "Предельный срок реализации (дата, час)";
}
