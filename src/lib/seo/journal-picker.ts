/**
 * Калькулятор «какие журналы нужны»: тип заведения и особенности → список
 * кодов каталога. Правила простые и объяснимые: базовый набор для всех,
 * плюс журналы под конкретные процессы.
 */
export type VenueKind = "cafe" | "canteen" | "bakery" | "production" | "retail" | "catering" | "hotel" | "education" | "medical";

export const VENUE_LABEL: Record<VenueKind, string> = {
  cafe: "Кафе, ресторан, бар",
  canteen: "Столовая",
  bakery: "Пекарня, кондитерская",
  production: "Пищевое производство",
  retail: "Продуктовый магазин",
  catering: "Кейтеринг, доставка",
  hotel: "Отель с питанием",
  education: "Школа, детсад, лагерь",
  medical: "Медцентр с пищеблоком",
};

export type VenueOption = "fridges" | "hotFood" | "rawMeat" | "fryer" | "flour" | "glass" | "uv" | "chemicals" | "outsourcePest";

export const OPTION_LABEL: Record<VenueOption, string> = {
  fridges: "Есть холодильники и морозильники",
  hotFood: "Готовим горячие блюда",
  rawMeat: "Работаем с сырым мясом, рыбой, яйцом",
  fryer: "Есть фритюр",
  flour: "Есть мука и сыпучие (риск металлопримесей)",
  glass: "Есть стеклянная тара и посуда на производстве",
  uv: "Есть бактерицидные лампы",
  chemicals: "Используем дезсредства сами",
  outsourcePest: "Дезинсекцию и дератизацию делает подрядчик",
};

const BASE = ["hygiene", "health_check", "med_books", "cleaning", "general_cleaning", "sanitary_day_control", "staff_training", "pest_control"];

export function pickJournals(kind: VenueKind, options: VenueOption[]): string[] {
  const set = new Set<string>(BASE);
  const has = (o: VenueOption) => options.includes(o);
  if (has("fridges") || kind !== "retail") set.add("cold_equipment_control");
  if (has("hotFood") || ["cafe", "canteen", "hotel", "education", "medical", "catering"].includes(kind)) {
    set.add("finished_product");
    set.add("intensive_cooling");
  }
  if (["cafe", "canteen", "bakery", "production", "catering", "hotel", "education", "medical"].includes(kind)) {
    set.add("incoming_control");
    set.add("perishable_rejection");
    set.add("product_writeoff");
  }
  if (kind === "retail") {
    set.add("incoming_control");
    set.add("perishable_rejection");
    set.add("product_writeoff");
    set.add("climate_control");
  }
  if (kind === "production") {
    set.add("incoming_raw_materials_control");
    set.add("traceability_test");
    set.add("climate_control");
    set.add("equipment_calibration");
    set.add("equipment_maintenance");
    set.add("equipment_cleaning");
    set.add("audit_plan");
    set.add("audit_protocol");
    set.add("audit_report");
  }
  if (kind === "bakery" || has("flour")) set.add("metal_impurity");
  if (has("rawMeat")) {
    set.add("equipment_cleaning");
    set.add("traceability_test");
  }
  if (has("fryer")) set.add("fryer_oil");
  if (has("glass") || kind === "production") {
    set.add("glass_items_list");
    set.add("glass_control");
  }
  if (has("uv")) set.add("uv_lamp_runtime");
  if (has("chemicals") || kind !== "retail") set.add("disinfectant_usage");
  if (["cafe", "canteen", "hotel", "education", "medical"].includes(kind)) set.add("cleaning_ventilation_checklist");
  if (kind === "education" || kind === "medical") {
    set.add("ppe_issuance");
    set.add("training_plan");
  }
  if (["cafe", "catering", "hotel"].includes(kind)) set.add("complaint_register");
  set.add("equipment_calibration");
  return [...set];
}
