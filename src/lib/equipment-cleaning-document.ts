export const EQUIPMENT_CLEANING_TEMPLATE_CODE = "equipment_cleaning";
export const EQUIPMENT_CLEANING_SOURCE_SLUG = "equipcleanjournal";
export const EQUIPMENT_CLEANING_DOCUMENT_TITLE =
  "Журнал мойки и дезинфекции оборудования";

export type EquipmentCleaningFieldVariant =
  | "rinse_temperature"
  | "rinse_completeness";

export type EquipmentCleaningDocumentConfig = {
  fieldVariant: EquipmentCleaningFieldVariant;
};

export type EquipmentCleaningRowData = {
  washDate: string;
  washTime: string;
  equipmentName: string;
  detergentName: string;
  detergentConcentration: string;
  disinfectantName: string;
  disinfectantConcentration: string;
  rinseTemperature: string | null;
  rinseResult: "compliant" | "non_compliant" | null;
  washerPosition: string;
  washerName: string;
  washerUserId: string | null;
  controllerPosition: string;
  controllerName: string;
  controllerUserId: string | null;
};

export const EQUIPMENT_CLEANING_VARIANT_LABELS: Record<
  EquipmentCleaningFieldVariant,
  string
> = {
  rinse_temperature: '"Ополаскивание, °C"',
  rinse_completeness: '"Полнота смываемости"',
};

export function getDefaultEquipmentCleaningConfig(): EquipmentCleaningDocumentConfig {
  return {
    fieldVariant: "rinse_temperature",
  };
}

export function normalizeEquipmentCleaningConfig(
  raw: unknown
): EquipmentCleaningDocumentConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return getDefaultEquipmentCleaningConfig();
  }

  const value = (raw as { fieldVariant?: unknown }).fieldVariant;
  return {
    fieldVariant:
      value === "rinse_completeness" ? "rinse_completeness" : "rinse_temperature",
  };
}

export function getEquipmentCleaningDocumentTitle() {
  return EQUIPMENT_CLEANING_DOCUMENT_TITLE;
}

export function getEquipmentCleaningFieldVariantLabel(
  variant: EquipmentCleaningFieldVariant
) {
  return EQUIPMENT_CLEANING_VARIANT_LABELS[variant];
}

export function getEquipmentCleaningCreatePeriodBounds() {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);

  return {
    dateFrom: date,
    dateTo: date,
  };
}

export function emptyEquipmentCleaningRow(
  overrides: Partial<EquipmentCleaningRowData> = {}
): EquipmentCleaningRowData {
  const now = new Date();

  return {
    washDate: now.toISOString().slice(0, 10),
    washTime: `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`,
    equipmentName: "",
    detergentName: "",
    detergentConcentration: "",
    disinfectantName: "",
    disinfectantConcentration: "",
    rinseTemperature: "",
    rinseResult: "compliant",
    washerPosition: "",
    washerName: "",
    washerUserId: null,
    controllerPosition: "",
    controllerName: "",
    controllerUserId: null,
    ...overrides,
  };
}

export function normalizeEquipmentCleaningRowData(
  raw: unknown
): EquipmentCleaningRowData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyEquipmentCleaningRow();
  }

  const value = raw as Record<string, unknown>;

  return emptyEquipmentCleaningRow({
    washDate:
      typeof value.washDate === "string"
        ? value.washDate
        : new Date().toISOString().slice(0, 10),
    washTime:
      typeof value.washTime === "string" && value.washTime
        ? value.washTime.slice(0, 5)
        : "00:00",
    equipmentName:
      typeof value.equipmentName === "string" ? value.equipmentName : "",
    detergentName:
      typeof value.detergentName === "string" ? value.detergentName : "",
    detergentConcentration:
      typeof value.detergentConcentration === "string"
        ? value.detergentConcentration
        : "",
    disinfectantName:
      typeof value.disinfectantName === "string" ? value.disinfectantName : "",
    disinfectantConcentration:
      typeof value.disinfectantConcentration === "string"
        ? value.disinfectantConcentration
        : "",
    rinseTemperature:
      typeof value.rinseTemperature === "string" ? value.rinseTemperature : "",
    rinseResult:
      value.rinseResult === "non_compliant"
        ? "non_compliant"
        : value.rinseResult === "compliant"
          ? "compliant"
          : null,
    washerPosition:
      typeof value.washerPosition === "string" ? value.washerPosition : "",
    washerName: typeof value.washerName === "string" ? value.washerName : "",
    washerUserId:
      typeof value.washerUserId === "string" ? value.washerUserId : null,
    controllerPosition:
      typeof value.controllerPosition === "string"
        ? value.controllerPosition
        : "",
    controllerName:
      typeof value.controllerName === "string" ? value.controllerName : "",
    controllerUserId:
      typeof value.controllerUserId === "string" ? value.controllerUserId : null,
  });
}

export function getEquipmentCleaningPeriodLabel(dateFrom: Date | string) {
  const value =
    typeof dateFrom === "string" ? new Date(`${dateFrom}T00:00:00`) : dateFrom;

  return value.toLocaleDateString("ru-RU").replaceAll(".", "-");
}

export function formatEquipmentCleaningDate(date: string) {
  return date.split("-").reverse().join("-");
}

export function getEquipmentCleaningResultLabel(
  value: EquipmentCleaningRowData["rinseResult"]
) {
  if (value === "non_compliant") return "Не соответствует";
  return "Соответствует";
}
