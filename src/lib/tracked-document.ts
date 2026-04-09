export const TRACKED_DOCUMENT_TEMPLATE_CODES = [
  "cooking_temp",
  "shipment",
  "uv_lamp_control",
  "fryer_oil",
  "general_cleaning",
  "daily_rejection",
  "raw_storage_control",
  "defrosting_control",
] as const;

export type TrackedDocumentTemplateCode =
  (typeof TRACKED_DOCUMENT_TEMPLATE_CODES)[number];

export function isTrackedDocumentTemplate(templateCode: string) {
  return TRACKED_DOCUMENT_TEMPLATE_CODES.includes(
    templateCode as TrackedDocumentTemplateCode
  );
}

const TRACKED_DOCUMENT_TITLES: Record<TrackedDocumentTemplateCode, string> = {
  cooking_temp: "Журнал термической обработки",
  shipment: "Журнал отгрузки",
  uv_lamp_control: "Журнал контроля УФ-ламп",
  fryer_oil: "Журнал фритюрного масла",
  general_cleaning: "Журнал генеральной уборки",
  daily_rejection: "Журнал ежедневного бракеража блюд",
  raw_storage_control: "Журнал контроля хранения сырья",
  defrosting_control: "Журнал контроля размораживания",
};

export function getTrackedDocumentTitle(templateCode: string) {
  return TRACKED_DOCUMENT_TITLES[templateCode as TrackedDocumentTemplateCode] || "Журнал";
}
