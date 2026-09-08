/**
 * ВСД → строка журнала приёмки.
 *
 * Самый ответственный чистый модуль интеграции. Правило, которое он
 * реализует, простое и не обсуждается:
 *
 *   из Меркурия берётся только то, что Меркурий ЗНАЕТ (что за продукт,
 *   от кого, сколько, до какого числа годен, по каким документам);
 *   всё, что можно узнать ТОЛЬКО потрогав товар — температура,
 *   органолептика, состояние упаковки и транспорта, решение о
 *   приёмке — остаётся ПУСТЫМ и вводится человеком.
 *
 * Иначе журнал входного контроля превращается в пересказ электронного
 * документа, а не в свидетельство того, что приёмку реально проводили —
 * и теряет смысл и для ХАССП, и для проверки.
 */
import { createAcceptanceRow, type AcceptanceRow } from "@/lib/acceptance-document";

import type { VetDocument } from "./types";

export type VsdToRowInput = {
  vsd: VetDocument;
  /** Должность и id ответственного из настроек документа. */
  responsibleTitle?: string | null;
  responsibleUserId?: string | null;
};

/** «42.5 кг, партия П-0908-1, изгот. 06.09.2026» — колонка «Объём, партия». */
export function buildBatchInfo(vsd: VetDocument): string {
  const parts: string[] = [];
  if (vsd.volume !== null && vsd.volume !== undefined) {
    parts.push(`${vsd.volume}${vsd.unit ? ` ${vsd.unit}` : ""}`);
  }
  if (vsd.batchNumber) parts.push(`партия ${vsd.batchNumber}`);
  if (vsd.productionDate) parts.push(`изгот. ${formatRu(vsd.productionDate)}`);
  return parts.join(", ");
}

/** «ВСД № 2600000001 (Меркурий); ТТН №260908-1» */
export function buildAccompanyingDocs(vsd: VetDocument): string {
  const parts: string[] = [];
  parts.push(
    vsd.number
      ? `ВСД № ${vsd.number} (Меркурий)`
      : `ВСД ${vsd.uuid.slice(0, 8)} (Меркурий)`,
  );
  if (vsd.accompanyingDocs) parts.push(vsd.accompanyingDocs);
  return parts.join("; ");
}

function formatRu(dateKey: string): string {
  const [y, m, d] = dateKey.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : dateKey;
}

function manufacturerSupplier(vsd: VetDocument): string {
  const manufacturer = vsd.manufacturerName?.trim();
  const supplier = vsd.consignorName?.trim();
  if (manufacturer && supplier && manufacturer !== supplier) {
    return `${manufacturer} / ${supplier}`;
  }
  return manufacturer || supplier || "";
}

/**
 * Строка журнала, заполненная данными ВСД.
 *
 * Физический контроль (`transportCondition`, `packagingCompliance`,
 * `organolepticResult`, `productTemperature`, `acceptanceDecision`)
 * НАМЕРЕННО остаётся значениями по умолчанию: их проставляет человек в
 * форме приёмки, и на это есть тест.
 */
export function vsdToAcceptanceRow(input: VsdToRowInput): AcceptanceRow {
  const { vsd } = input;
  const deliveryDate = (vsd.deliveryDate ?? vsd.issueDate ?? "").slice(0, 10);

  return createAcceptanceRow({
    deliveryDate,
    // Час и минуты приёмки Меркурий не знает — их ставит приёмщик.
    deliveryHour: "",
    deliveryMinute: "",
    productName: vsd.productName ?? "",
    manufacturer: vsd.manufacturerName ?? "",
    supplier: vsd.consignorName ?? "",
    manufacturerSupplier: manufacturerSupplier(vsd),
    accompanyingDocs: buildAccompanyingDocs(vsd),
    batchInfo: buildBatchInfo(vsd),
    shelfLifeDate: vsd.expiryDate ?? "",
    expiryDate: vsd.expiryDate ?? "",
    responsibleTitle: input.responsibleTitle ?? "",
    responsibleUserId: input.responsibleUserId ?? "",
    mercuryVsdUuid: vsd.uuid,
    mercuryVsdNumber: vsd.number ?? "",
  });
}

/**
 * Дополнить строку данными физического контроля из формы приёмки.
 *
 * Отдельным шагом, а не параметрами `vsdToAcceptanceRow`, чтобы в коде
 * было видно границу: до этого вызова в строке нет ни одного факта,
 * который кто-то наблюдал своими глазами.
 */
export function applyPhysicalCheck(
  row: AcceptanceRow,
  check: {
    deliveryHour?: string;
    deliveryMinute?: string;
    transportConditionOk: boolean;
    packagingOk: boolean;
    organolepticOk: boolean;
    documentsOk: boolean;
    productTemperature?: string;
    decision: "accept" | "reject";
    correctiveActions?: string;
    note?: string;
  },
): AcceptanceRow {
  return {
    ...row,
    deliveryHour: check.deliveryHour ?? row.deliveryHour,
    deliveryMinute: check.deliveryMinute ?? row.deliveryMinute,
    transportCondition: check.transportConditionOk ? "satisfactory" : "unsatisfactory",
    packagingCompliance: check.packagingOk ? "compliant" : "non_compliant",
    organolepticResult: check.organolepticOk ? "satisfactory" : "unsatisfactory",
    documentCompliance: check.documentsOk ? "Соответствует" : "Не соответствует",
    productTemperature: check.productTemperature ?? row.productTemperature,
    acceptanceDecision: check.decision,
    correctiveActions: check.correctiveActions ?? row.correctiveActions,
    note: check.note ?? row.note,
  };
}
