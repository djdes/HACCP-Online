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
import { defaultCleaningDocumentConfig } from "./cleaning-document";
import { getDefaultCleaningVentilationConfig } from "./cleaning-ventilation-checklist-document";
import {
  buildClimateConfigFromAreas,
  getDefaultClimateDocumentConfig,
} from "./climate-document";
import {
  buildColdEquipmentConfigFromEquipment,
  getDefaultColdEquipmentDocumentConfig,
} from "./cold-equipment-document";
import { getDisinfectantDefaultConfig } from "./disinfectant-document";
import {
  buildEquipmentCalibrationConfigFromEquipment,
  getDefaultEquipmentCalibrationConfig,
} from "./equipment-calibration-document";
import { getDefaultEquipmentCleaningConfig } from "./equipment-cleaning-document";
import {
  buildEquipmentMaintenanceConfigFromEquipment,
  getDefaultEquipmentMaintenanceConfig,
} from "./equipment-maintenance-document";
import {
  buildFinishedProductConfigFromUsers,
  getDefaultFinishedProductDocumentConfig,
} from "./finished-product-document";
import { getDefaultGlassControlConfig } from "./glass-control-document";
import {
  buildGlassListConfigFromData,
  getDefaultGlassListConfig,
} from "./glass-list-document";
import { getDefaultIntensiveCoolingConfig } from "./intensive-cooling-document";
import { getDefaultMedBookConfig } from "./med-book-document";
import { getDefaultMetalImpurityConfig } from "./metal-impurity-document";
import { getDefaultPerishableRejectionConfig } from "./perishable-rejection-document";
import { getPpeIssuanceDefaultConfig } from "./ppe-issuance-document";
import { getDefaultProductWriteoffConfig } from "./product-writeoff-document";
import {
  buildRegisterDocumentConfigFromUsers,
  getDefaultRegisterDocumentConfig,
} from "./register-document";
import {
  buildSanitationDayConfigFromAreas,
  getSanitationDayDefaultConfig,
} from "./sanitation-day-document";
import { defaultSdcConfig } from "./sanitary-day-checklist-document";
import { getTrainingPlanDefaultConfig } from "./training-plan-document";

/**
 * Org-данные, которые провайдер может опционально использовать для
 * генерации enriched дефолта (например, climate подтянет rooms из
 * areas, cold-equipment — equipment по типу холодильник).
 *
 * Все поля optional: если caller не передаёт — провайдер делает stub
 * (один default-row). Если передаёт — провайдер заполняет по реальным
 * данным.
 */
export type DefaultConfigOrgData = {
  areas?: Array<{ id: string; name: string }>;
  equipment?: Array<{
    id: string;
    name: string;
    type?: string | null;
    tempMin?: number | null;
    tempMax?: number | null;
  }>;
  users?: Array<{
    id: string;
    name: string;
    role: string;
    /** Должность, вписанная руками в карточке сотрудника. */
    positionTitle?: string | null;
    /** Должность из справочника — она приоритетнее вписанной руками. */
    jobPositionName?: string | null;
  }>;
  products?: Array<{ id: string; name: string }>;
  organizationName?: string;
};

/**
 * Должность сотрудника для печатной формы. Порядок тот же, что в PDF
 * (`document-pdf.ts`): справочник → вписанное руками → пусто. Роль
 * («cook», «waiter») сюда не подставляем: в бланке для проверки она
 * выглядит как техническая метка, а не как должность.
 */
export function pickUserTitle(user: {
  positionTitle?: string | null;
  jobPositionName?: string | null;
}): string {
  return user.jobPositionName?.trim() || user.positionTitle?.trim() || "";
}

type Provider = (orgData?: DefaultConfigOrgData) => Record<string, unknown>;

/**
 * Конфиг журнала-реестра. Строки НЕ создаём: в реестрах (инструктажи,
 * жалобы, дератизация, прослеживаемость) строка — это случившееся
 * событие, и заранее насыпанные пустые строки означали бы записи,
 * которых не было. Подставляем только ответственного по умолчанию.
 */
function registerConfig(
  orgData?: DefaultConfigOrgData
): Record<string, unknown> {
  if (orgData?.users?.length) {
    return buildRegisterDocumentConfigFromUsers(
      orgData.users
    ) as unknown as Record<string, unknown>;
  }
  return getDefaultRegisterDocumentConfig() as unknown as Record<
    string,
    unknown
  >;
}

const PROVIDERS: Record<string, Provider> = {
  // ═══ ТЕМПЕРАТУРА ═══
  climate_control: (orgData) => {
    if (orgData?.areas && orgData.areas.length > 0) {
      return buildClimateConfigFromAreas(orgData.areas) as unknown as Record<
        string,
        unknown
      >;
    }
    return getDefaultClimateDocumentConfig() as unknown as Record<
      string,
      unknown
    >;
  },
  cold_equipment_control: (orgData) => {
    if (orgData?.equipment && orgData.equipment.length > 0) {
      return buildColdEquipmentConfigFromEquipment(
        orgData.equipment
      ) as unknown as Record<string, unknown>;
    }
    return getDefaultColdEquipmentDocumentConfig() as unknown as Record<
      string,
      unknown
    >;
  },
  intensive_cooling: (orgData) =>
    getDefaultIntensiveCoolingConfig(
      orgData?.users ?? []
    ) as unknown as Record<string, unknown>,
  fryer_oil: (orgData) => registerConfig(orgData),

  // ═══ УБОРКА ═══
  cleaning: (orgData) =>
    defaultCleaningDocumentConfig(
      orgData?.users,
      orgData?.areas
    ) as unknown as Record<string, unknown>,
  general_cleaning: (orgData) => {
    if (orgData?.areas && orgData.areas.length > 0) {
      return buildSanitationDayConfigFromAreas(
        orgData.areas
      ) as unknown as Record<string, unknown>;
    }
    return getSanitationDayDefaultConfig() as unknown as Record<string, unknown>;
  },
  cleaning_ventilation_checklist: (orgData) => {
    if (orgData?.users && orgData.users.length > 0) {
      return getDefaultCleaningVentilationConfig(
        orgData.users
      ) as unknown as Record<string, unknown>;
    }
    return getDefaultCleaningVentilationConfig() as unknown as Record<
      string,
      unknown
    >;
  },
  uv_lamp_runtime: (orgData) => registerConfig(orgData),
  disinfectant_usage: () =>
    getDisinfectantDefaultConfig() as unknown as Record<string, unknown>,
  sanitary_day_control: () =>
    defaultSdcConfig() as unknown as Record<string, unknown>,
  equipment_cleaning: () =>
    getDefaultEquipmentCleaningConfig() as unknown as Record<string, unknown>,

  // ═══ ПРИЁМКА ═══
  incoming_control: (orgData) =>
    getAcceptanceDocumentDefaultConfig(
      orgData?.users ?? []
    ) as unknown as Record<string, unknown>,
  incoming_raw_materials_control: (orgData) =>
    getAcceptanceDocumentDefaultConfig(
      orgData?.users ?? []
    ) as unknown as Record<string, unknown>,
  perishable_rejection: () =>
    getDefaultPerishableRejectionConfig() as unknown as Record<string, unknown>,
  metal_impurity: () =>
    getDefaultMetalImpurityConfig() as unknown as Record<string, unknown>,

  // ═══ ПРОИЗВОДСТВО / БРАКЕРАЖ ═══
  finished_product: (orgData) => {
    if (orgData?.users?.length) {
      return buildFinishedProductConfigFromUsers(
        orgData.users,
        (orgData.products ?? []).map((p) => p.name)
      ) as unknown as Record<string, unknown>;
    }
    return getDefaultFinishedProductDocumentConfig() as unknown as Record<
      string,
      unknown
    >;
  },
  product_writeoff: () =>
    getDefaultProductWriteoffConfig() as unknown as Record<string, unknown>,

  // ═══ ОБОРУДОВАНИЕ ═══
  equipment_calibration: (orgData) => {
    const year = new Date().getUTCFullYear();
    if (orgData?.equipment && orgData.equipment.length > 0) {
      const calibrationSource = orgData.equipment.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type ?? "",
        tempMin: e.tempMin ?? null,
        tempMax: e.tempMax ?? null,
      }));
      return buildEquipmentCalibrationConfigFromEquipment(calibrationSource, {
        year,
      }) as unknown as Record<string, unknown>;
    }
    return getDefaultEquipmentCalibrationConfig(year) as unknown as Record<
      string,
      unknown
    >;
  },
  equipment_maintenance: (orgData) => {
    const year = new Date().getUTCFullYear();
    if (orgData?.equipment && orgData.equipment.length > 0) {
      return buildEquipmentMaintenanceConfigFromEquipment(
        orgData.equipment.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type ?? null,
        })),
        year
      ) as unknown as Record<string, unknown>;
    }
    return getDefaultEquipmentMaintenanceConfig(year) as unknown as Record<
      string,
      unknown
    >;
  },
  breakdown_history: () =>
    getBreakdownHistoryDefaultConfig() as unknown as Record<string, unknown>,
  glass_items_list: (orgData) => {
    const hasData =
      (orgData?.equipment && orgData.equipment.length > 0) ||
      (orgData?.products && orgData.products.length > 0) ||
      (orgData?.areas && orgData.areas.length > 0);
    if (hasData) {
      return buildGlassListConfigFromData({
        users: orgData?.users ?? [],
        areas: orgData?.areas ?? [],
        equipment: orgData?.equipment ?? [],
        products: orgData?.products ?? [],
      }) as unknown as Record<string, unknown>;
    }
    return getDefaultGlassListConfig() as unknown as Record<string, unknown>;
  },
  glass_control: () =>
    getDefaultGlassControlConfig() as unknown as Record<string, unknown>,

  // ═══ ОБУЧЕНИЕ / ПЕРСОНАЛ ═══
  training_plan: () =>
    getTrainingPlanDefaultConfig() as unknown as Record<string, unknown>,
  staff_training: (orgData) => registerConfig(orgData),
  ppe_issuance: (orgData) =>
    getPpeIssuanceDefaultConfig(orgData?.users ?? []) as unknown as Record<
      string,
      unknown
    >,
  med_books: () =>
    getDefaultMedBookConfig() as unknown as Record<string, unknown>,

  // ═══ ИНЦИДЕНТЫ ═══
  accident_journal: () =>
    getAccidentDocumentDefaultConfig() as unknown as Record<string, unknown>,
  complaint_register: (orgData) => registerConfig(orgData),
  pest_control: (orgData) => registerConfig(orgData),

  // ═══ АУДИТЫ ═══
  audit_plan: (orgData) =>
    getAuditPlanDefaultConfig({
      organizationName: orgData?.organizationName,
      users: orgData?.users,
    }) as unknown as Record<string, unknown>,
  audit_protocol: () =>
    getDefaultAuditProtocolConfig() as unknown as Record<string, unknown>,
  audit_report: () =>
    getDefaultAuditReportConfig() as unknown as Record<string, unknown>,
  traceability_test: (orgData) => registerConfig(orgData),
};

export function getDefaultConfigForJournal(
  journalCode: string,
  orgData?: DefaultConfigOrgData
): Record<string, unknown> {
  const provider = PROVIDERS[journalCode];
  if (!provider) return {};
  try {
    return provider(orgData);
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
