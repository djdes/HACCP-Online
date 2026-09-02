/**
 * Capability-карта ежедневного автозаполнения журналов.
 *
 * Одно место, которое знает, КАКИЕ журналы автозаполнение вообще умеет
 * обслуживать и КАКИМ механизмом. Файл чистый (без Prisma/next) —
 * импортируется и сервером (движок `journal-autofill.ts`, cron'ы,
 * PUT `/api/organizations/auto-journals`), и клиентом (тумблеры на
 * странице журнала).
 *
 * Механики:
 *   • "staff"         — строка на сотрудника × день (гигиена, здоровье):
 *                       `applyStaffJournalAutoFill` + графики
 *                       выходных/отпусков/больничных.
 *   • "per-day"       — одна строка на день: значения строятся из config
 *                       документа (нормы климата, спецификация УФ,
 *                       расписание процедур, смена фритюра) либо
 *                       copy-forward из последнего заполненного дня.
 *   • "config-matrix" — журнал уборки: заполняется не entries, а matrix
 *                       в config (план Т/Г по маскам помещений, «/» на
 *                       прошедшие пустые дни, авто-подписи `auto:С1`).
 *
 * СОЗНАТЕЛЬНО ИСКЛЮЧЕНЫ событийные/плановые журналы — заполнять их
 * автоматически значит выдумывать события, которых не было:
 *   • disinfectant_usage — UI читает только config.receipts, заполнение
 *     entries бессмысленно;
 *   • finished_product / perishable_rejection / intensive_cooling —
 *     записи появляются по факту приёмки/бракеража/охлаждения;
 *   • accident / complaint / pest_control / breakdown_history /
 *     audit_* / equipment_* / med_books / training / ppe / traceability /
 *     metal_impurity / glass_items_list — событийные и плановые.
 */

export type AutofillCapability = "staff" | "per-day" | "config-matrix";

export const AUTOFILL_CAPABILITIES: Record<string, AutofillCapability> = {
  hygiene: "staff",
  health_check: "staff",
  climate_control: "per-day",
  cold_equipment_control: "per-day",
  uv_lamp_runtime: "per-day",
  cleaning_ventilation_checklist: "per-day",
  glass_control: "per-day",
  fryer_oil: "per-day",
  cleaning: "config-matrix",
};

/** Все коды, для которых автозаполнение поддерживается (отсортированы). */
export const AUTOFILL_SUPPORTED_CODES: readonly string[] = Object.keys(
  AUTOFILL_CAPABILITIES
).sort();

/** Механика автозаполнения журнала или null, если он не поддерживается. */
export function getAutofillCapability(
  code: string
): AutofillCapability | null {
  return AUTOFILL_CAPABILITIES[code] ?? null;
}
