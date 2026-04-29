/**
 * Per-journal default-config provider — генерирует stock config с
 * дефолтными строками (rows/zones/equipment) при создании нового
 * документа. Без этого многие документы создавались с пустым {},
 * и bulk-assign-today / печать падали с «нет строк для назначения».
 *
 * Используется prefillResponsiblesForNewDocument: сначала берёт base
 * config от соответствующей default-функции, потом поверх накладывает
 * patcher с конкретными slot users.
 *
 * Если для journalCode дефолта нет — возвращаем пустой config, который
 * патчер всё равно дополнит. Это OK для журналов без обязательных rows
 * (накладные/одиночные записи).
 */

import { getAcceptanceDocumentDefaultConfig } from "./acceptance-document";
import { getAccidentDocumentDefaultConfig } from "./accident-document";
import { getAuditPlanDefaultConfig } from "./audit-plan-document";
import { getDefaultAuditProtocolConfig } from "./audit-protocol-document";
import { getDefaultAuditReportConfig } from "./audit-report-document";
import { getBreakdownHistoryDefaultConfig } from "./breakdown-history-document";
import { getDefaultCleaningDocumentConfig } from "./cleaning-document";
import { getDefaultCleaningVentilationConfig } from "./cleaning-ventilation-checklist-document";
import { getDefaultClimateDocumentConfig } from "./climate-document";
import { getDefaultColdEquipmentDocumentConfig } from "./cold-equipment-document";
import { getDisinfectantDefaultConfig } from "./disinfectant-document";
import { getDefaultEquipmentCalibrationConfig } from "./equipment-calibration-document";
import { getDefaultEquipmentCleaningConfig } from "./equipment-cleaning-document";
import { getDefaultEquipmentMaintenanceConfig } from "./equipment-maintenance-document";
import { getDefaultFinishedProductDocumentConfig } from "./finished-product-document";
import { getDefaultGlassControlConfig } from "./glass-control-document";
import { getDefaultGlassListConfig } from "./glass-list-document";
import { getDefaultIntensiveCoolingConfig } from "./intensive-cooling-document";
import { getDefaultMedBookConfig } from "./med-book-document";
import { getDefaultMetalImpurityConfig } from "./metal-impurity-document";
import { getDefaultPerishableRejectionConfig } from "./perishable-rejection-document";
import { getPpeIssuanceDefaultConfig } from "./ppe-issuance-document";
import { getDefaultProductWriteoffConfig } from "./product-writeoff-document";
import { getDefaultRegisterDocumentConfig } from "./register-document";
import { getSanitationDayDefaultConfig } from "./sanitation-day-document";
import { defaultSdcConfig } from "./sanitary-day-checklist-document";
import { getTrainingPlanDefaultConfig } from "./training-plan-document";

type Provider = () => Record<string, unknown>;

const PROVIDERS: Record<string, Provider> = {
  // ═══ ТЕМПЕРАТУРА ═══
  climate_control: () =>
    getDefaultClimateDocumentConfig() as unknown as Record<string, unknown>,
  cold_equipment_control: () =>
    getDefaultColdEquipmentDocumentConfig() as unknown as Record<string, unknown>,
  intensive_cooling: () =>
    getDefaultIntensiveCoolingConfig([]) as unknown as Record<string, unknown>,
  fryer_oil: () =>
    getDefaultRegisterDocumentConfig() as unknown as Record<string, unknown>,

  // ═══ УБОРКА ═══
  cleaning: () =>
    getDefaultCleaningDocumentConfig() as unknown as Record<string, unknown>,
  general_cleaning: () =>
    getSanitationDayDefaultConfig() as unknown as Record<string, unknown>,
  cleaning_ventilation_checklist: () =>
    getDefaultCleaningVentilationConfig() as unknown as Record<string, unknown>,
  uv_lamp_runtime: () =>
    getDefaultRegisterDocumentConfig() as unknown as Record<string, unknown>,
  disinfectant_usage: () =>
    getDisinfectantDefaultConfig() as unknown as Record<string, unknown>,
  sanitary_day_control: () =>
    defaultSdcConfig() as unknown as Record<string, unknown>,
  equipment_cleaning: () =>
    getDefaultEquipmentCleaningConfig() as unknown as Record<string, unknown>,

  // ═══ ПРИЁМКА ═══
  incoming_control: () =>
    getAcceptanceDocumentDefaultConfig([]) as unknown as Record<string, unknown>,
  incoming_raw_materials_control: () =>
    getAcceptanceDocumentDefaultConfig([]) as unknown as Record<string, unknown>,
  perishable_rejection: () =>
    getDefaultPerishableRejectionConfig() as unknown as Record<string, unknown>,
  metal_impurity: () =>
    getDefaultMetalImpurityConfig() as unknown as Record<string, unknown>,

  // ═══ ПРОИЗВОДСТВО / БРАКЕРАЖ ═══
  finished_product: () =>
    getDefaultFinishedProductDocumentConfig() as unknown as Record<
      string,
      unknown
    >,
  product_writeoff: () =>
    getDefaultProductWriteoffConfig() as unknown as Record<string, unknown>,

  // ═══ ОБОРУДОВАНИЕ ═══
  equipment_calibration: () =>
    getDefaultEquipmentCalibrationConfig(
      new Date().getUTCFullYear()
    ) as unknown as Record<string, unknown>,
  equipment_maintenance: () =>
    getDefaultEquipmentMaintenanceConfig(
      new Date().getUTCFullYear()
    ) as unknown as Record<string, unknown>,
  breakdown_history: () =>
    getBreakdownHistoryDefaultConfig() as unknown as Record<string, unknown>,
  glass_items_list: () =>
    getDefaultGlassListConfig() as unknown as Record<string, unknown>,
  glass_control: () =>
    getDefaultGlassControlConfig() as unknown as Record<string, unknown>,

  // ═══ ОБУЧЕНИЕ / ПЕРСОНАЛ ═══
  training_plan: () =>
    getTrainingPlanDefaultConfig() as unknown as Record<string, unknown>,
  staff_training: () =>
    getDefaultRegisterDocumentConfig() as unknown as Record<string, unknown>,
  ppe_issuance: () =>
    getPpeIssuanceDefaultConfig([]) as unknown as Record<string, unknown>,
  med_books: () =>
    getDefaultMedBookConfig() as unknown as Record<string, unknown>,

  // ═══ ИНЦИДЕНТЫ ═══
  accident_journal: () =>
    getAccidentDocumentDefaultConfig() as unknown as Record<string, unknown>,
  complaint_register: () =>
    getDefaultRegisterDocumentConfig() as unknown as Record<string, unknown>,
  pest_control: () =>
    getDefaultRegisterDocumentConfig() as unknown as Record<string, unknown>,

  // ═══ АУДИТЫ ═══
  audit_plan: () =>
    getAuditPlanDefaultConfig() as unknown as Record<string, unknown>,
  audit_protocol: () =>
    getDefaultAuditProtocolConfig() as unknown as Record<string, unknown>,
  audit_report: () =>
    getDefaultAuditReportConfig() as unknown as Record<string, unknown>,
  traceability_test: () =>
    getDefaultRegisterDocumentConfig() as unknown as Record<string, unknown>,
};

export function getDefaultConfigForJournal(
  journalCode: string
): Record<string, unknown> {
  const provider = PROVIDERS[journalCode];
  if (!provider) return {};
  try {
    return provider();
  } catch (err) {
    // Лёгкая защита от падений в дефолт-генераторах: возвращаем пустой
    // вместо ошибки — лучше создать документ без rows, чем не создать
    // вовсе.
    console.warn(
      `[journal-default-configs] provider failed for ${journalCode}`,
      err
    );
    return {};
  }
}
