import type { Prisma } from "@prisma/client";
import type { DemoPerson, DemoRoster } from "@/lib/demo-organization-roster";
import { getHygienePositionLabel } from "@/lib/hygiene-document";
import {
  createAcceptanceRow,
  normalizeAcceptanceDocumentConfig,
} from "@/lib/acceptance-document";
import {
  createFinishedProductRow,
  normalizeFinishedProductDocumentConfig,
} from "@/lib/finished-product-document";
import {
  createPerishableRejectionRow,
  normalizePerishableRejectionConfig,
} from "@/lib/perishable-rejection-document";
import {
  createProductWriteoffCommissionMember,
  createProductWriteoffRow,
  normalizeProductWriteoffConfig,
} from "@/lib/product-writeoff-document";
import {
  createMetalImpurityRow,
  normalizeMetalImpurityConfig,
} from "@/lib/metal-impurity-document";
import {
  createTraceabilityRow,
  normalizeTraceabilityDocumentConfig,
} from "@/lib/traceability-document";
import {
  emptyEquipmentCleaningRow,
  type EquipmentCleaningRowData,
} from "@/lib/equipment-cleaning-document";
import {
  MONTH_KEYS,
  createEquipmentMaintenanceRow,
  normalizeEquipmentMaintenanceConfig,
} from "@/lib/equipment-maintenance-document";
import {
  createBreakdownRow,
  normalizeBreakdownHistoryDocumentConfig,
} from "@/lib/breakdown-history-document";
import {
  createCalibrationRow,
  normalizeEquipmentCalibrationConfig,
} from "@/lib/equipment-calibration-document";
import { createGlassListRow, normalizeGlassListConfig } from "@/lib/glass-list-document";
import type { GlassControlEntryData } from "@/lib/glass-control-document";
import {
  createEmptyTrainingRow,
  normalizeTrainingPlanConfig,
} from "@/lib/training-plan-document";
import {
  TRAINING_TOPICS,
  createStaffTrainingRow,
  normalizeStaffTrainingConfig,
} from "@/lib/staff-training-document";
import { createPpeIssuanceRow, normalizePpeIssuanceConfig } from "@/lib/ppe-issuance-document";
import { normalizeAuditPlanConfig } from "@/lib/audit-plan-document";
import {
  createAuditProtocolRow,
  createAuditProtocolSection,
  createAuditProtocolSignature,
  normalizeAuditProtocolConfig,
} from "@/lib/audit-protocol-document";
import {
  createAuditReportFinding,
  createAuditReportSignature,
  normalizeAuditReportConfig,
} from "@/lib/audit-report-document";
import { createAccidentRow, normalizeAccidentDocumentConfig } from "@/lib/accident-document";
import { buildComplaintRow, normalizeComplaintConfig } from "@/lib/complaint-document";
import { normalizeSdcConfig, type SdcEntryData } from "@/lib/sanitary-day-checklist-document";
import {
  DEFAULT_EXAMINATIONS,
  DEFAULT_VACCINATIONS,
  emptyMedBookEntry,
} from "@/lib/med-book-document";
import type { PestControlEntryData } from "@/lib/pest-control-document";
import type { PaperJournal } from "@/lib/sphere-journal-rules";

/**
 * Содержимое «редких» журналов демо-организации: приёмка, бракераж,
 * акты, оборудование, персонал, аудиты, жалобы. Ежедневные (гигиена,
 * холод, климат, уборка, фритюр) живут в demo-organization.ts — здесь
 * всё, что заполняется раз в неделю/месяц/год, но должно выглядеть
 * прожитым: даты внутри окна истории, настоящие ФИО из ростера, одно-два
 * отклонения с корректирующим действием.
 *
 * Каждый builder возвращает либо `config` (журналы-таблицы, где строки
 * лежат в JournalDocument.config), либо `rows` (журналы с записями
 * JournalDocumentEntry). Null — журнал не трогаем, остаётся автосев.
 */

export type DemoStaff = DemoPerson & { id: string };

type EntryRow = Prisma.JournalDocumentEntryCreateManyInput;

export type DemoJournalContext = {
  documentId: string;
  rawConfig: unknown;
  docDateFrom: Date;
  /** Ключи дней окна истории, последний — сегодня. */
  windowKeys: string[];
  todayKey: string;
  /** Ключ дня «k дней назад» (0 = сегодня); undefined если окно короче. */
  ago: (k: number) => string | undefined;
  people: DemoStaff[];
  manager: DemoStaff;
  technologist: DemoStaff;
  chef: DemoStaff;
  cleaner: DemoStaff;
  cook: DemoStaff;
  storekeeper: DemoStaff;
  dishwasher: DemoStaff;
  roster: DemoRoster;
  organizationName: string;
};

export type DemoJournalSeed = { rows?: EntryRow[]; config?: unknown };

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** YYYY-MM-DD → сдвиг на N дней (UTC). */
export function shiftKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → DD.MM.YYYY (так печатают бумажные и «реестровые» журналы). */
export function formatDot(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

/** YYYY-MM-DD → DD-MM-YYYY (формат ячеек плана аудитов). */
function formatDash(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}-${m}-${y}`;
}

function utcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

function shortName(fullName: string): string {
  const [last, first, patronymic] = fullName.split(" ");
  const initials = [first, patronymic]
    .filter(Boolean)
    .map((part) => `${part[0]}.`)
    .join("");
  return initials ? `${last} ${initials}` : last;
}

const SUPPLIERS = {
  meat: { name: "ООО «Мясной двор»", manufacturer: "АО «Останкинский МПК»" },
  poultry: { name: "ООО «Птицепром»", manufacturer: "ЗАО «Петелинская птицефабрика»" },
  dairy: { name: "ИП Смирнов А. В.", manufacturer: "ООО «Молочный комбинат «Ополье»" },
  vegetables: { name: "ООО «Агропродукт»", manufacturer: "ООО «Агропродукт»" },
  fish: { name: "ООО «Северная рыба»", manufacturer: "ООО «Мурманский рыбокомбинат»" },
  grocery: { name: "ООО «Агропродукт»", manufacturer: "ОАО «Мелькомбинат №3»" },
} as const;

// ────────────────────────────────────────────────────────────────────
// Сырьё и продукция
// ────────────────────────────────────────────────────────────────────

function buildAcceptanceConfig(ctx: DemoJournalContext) {
  const config = normalizeAcceptanceDocumentConfig(
    ctx.rawConfig,
    ctx.people.map((p) => ({ id: p.id, role: p.role })),
  );
  const deliveries = [
    { product: "Говядина охлаждённая, лопатка", supplier: SUPPLIERS.meat, temp: "+2", shelfDays: 5, hour: 8 },
    { product: "Филе куриное охлаждённое", supplier: SUPPLIERS.poultry, temp: "+3", shelfDays: 4, hour: 9 },
    { product: "Сметана 20 %, 5 кг", supplier: SUPPLIERS.dairy, temp: "+4", shelfDays: 14, hour: 10 },
    { product: "Овощи свежие (картофель, морковь, лук)", supplier: SUPPLIERS.vegetables, temp: "+12", shelfDays: 20, hour: 11 },
    { product: "Треска филе с/м", supplier: SUPPLIERS.fish, temp: "−18", shelfDays: 120, hour: 9 },
  ];
  const rejectDay = ctx.ago(2);
  const rows = ctx.windowKeys.flatMap((dateKey, dayIndex) => {
    const picks = [deliveries[dayIndex % deliveries.length], deliveries[(dayIndex + 2) % deliveries.length]];
    return picks.map((item, i) => {
      const reject = dateKey === rejectDay && i === 0;
      return createAcceptanceRow({
        deliveryDate: dateKey,
        deliveryHour: String(item.hour + i).padStart(2, "0"),
        deliveryMinute: i === 0 ? "15" : "40",
        productName: item.product,
        manufacturer: item.supplier.manufacturer,
        supplier: item.supplier.name,
        manufacturerSupplier: `${item.supplier.manufacturer} / ${item.supplier.name}`,
        transportCondition: reject ? "unsatisfactory" : "satisfactory",
        packagingCompliance: "compliant",
        organolepticResult: reject ? "unsatisfactory" : "satisfactory",
        productTemperature: reject ? "+9" : item.temp,
        expiryDate: shiftKey(dateKey, item.shelfDays),
        shelfLifeDate: shiftKey(dateKey, item.shelfDays),
        accompanyingDocs: "ТТН, декларация о соответствии, ветсвидетельство",
        batchInfo: `Партия ${dateKey.slice(5).replace("-", "")}-${i + 1}`,
        documentCompliance: "compliant",
        acceptanceDecision: reject ? "reject" : "accept",
        correctiveActions: reject
          ? "Температура в кузове +9 °C, поверхность мяса липкая. Партия возвращена поставщику, составлен акт, заказ передублирован."
          : "",
        note: reject ? "Возврат поставщику" : "",
        responsibleTitle: ctx.storekeeper.position,
        responsibleUserId: ctx.storekeeper.id,
      });
    });
  });
  return { ...config, rows };
}

function buildFinishedProductConfig(ctx: DemoJournalContext) {
  const config = normalizeFinishedProductDocumentConfig(ctx.rawConfig);
  const dishes = ctx.roster.dishes;
  const badDay = ctx.ago(3);
  const rows = ctx.windowKeys.flatMap((dateKey, dayIndex) => {
    const perDay = dayIndex % 2 === 0 ? 3 : 2;
    return Array.from({ length: perDay }, (_, i) => {
      const dish = dishes[(dayIndex * 2 + i) % dishes.length];
      const hour = 11 + i * 2;
      const bad = dateKey === badDay && i === 1;
      return createFinishedProductRow({
        productionDateTime: `${dateKey} ${String(hour).padStart(2, "0")}:30`,
        rejectionTime: `${String(hour).padStart(2, "0")}:45`,
        productName: dish,
        organoleptic: bad
          ? "Консистенция жидкая, вкус недосолен, температура подачи ниже нормы"
          : "Внешний вид, цвет, запах и вкус соответствуют рецептуре",
        organolepticValue: bad ? "Не соответствует" : "Соответствует",
        organolepticResult: bad ? "Не соответствует" : "Соответствует",
        productTemp: bad ? "+58" : i === 0 ? "+75" : "+72",
        correctiveAction: bad
          ? "Партия снята с раздачи, доведена до кипения и повторно проверена в 14:10 — допущена."
          : "",
        releasePermissionTime: bad ? "" : `${String(hour + 1).padStart(2, "0")}:00`,
        courierTransferTime: "",
        oxygenLevel: "",
        responsiblePerson: ctx.chef.name,
        inspectorName: ctx.technologist.name,
        releaseAllowed: bad ? "no" : "yes",
      });
    });
  });
  return { ...config, rows };
}

function buildPerishableConfig(ctx: DemoJournalContext) {
  const config = normalizePerishableRejectionConfig(ctx.rawConfig);
  const items = [
    { product: "Сметана 20 %", supplier: SUPPLIERS.dairy, packaging: "Ведро ПЭТ 5 кг", qty: "2 шт.", storage: "2_6" as const, shelf: 14 },
    { product: "Творог 9 %", supplier: SUPPLIERS.dairy, packaging: "Пакет 1 кг", qty: "6 шт.", storage: "2_6" as const, shelf: 7 },
    { product: "Куриное филе охл.", supplier: SUPPLIERS.poultry, packaging: "Лоток, стретч-плёнка", qty: "12 кг", storage: "minus2_2" as const, shelf: 4 },
    { product: "Пельмени с/м", supplier: SUPPLIERS.meat, packaging: "Пакет 1 кг", qty: "10 шт.", storage: "minus18" as const, shelf: 90 },
    { product: "Салат листовой", supplier: SUPPLIERS.vegetables, packaging: "Ящик пластиковый", qty: "3 кг", storage: "2_6" as const, shelf: 5 },
  ];
  const badDay = ctx.ago(4);
  const rows = ctx.windowKeys.flatMap((dateKey, dayIndex) => {
    const count = dayIndex % 3 === 0 ? 2 : 1;
    return Array.from({ length: count }, (_, i) => {
      const item = items[(dayIndex + i * 2) % items.length];
      const bad = dateKey === badDay && i === 0;
      return createPerishableRejectionRow({
        arrivalDate: dateKey,
        arrivalTime: i === 0 ? "08:40" : "10:20",
        productName: bad ? "Сметана 20 %" : item.product,
        productionDate: shiftKey(dateKey, -2),
        manufacturer: bad ? SUPPLIERS.dairy.manufacturer : item.supplier.manufacturer,
        supplier: bad ? SUPPLIERS.dairy.name : item.supplier.name,
        packaging: bad ? "Ведро ПЭТ 5 кг" : item.packaging,
        quantity: bad ? "2 шт." : item.qty,
        documentNumber: `ТТН-${dateKey.slice(2, 4)}${dateKey.slice(5, 7)}${dateKey.slice(8)}-${i + 1}`,
        organolepticResult: bad ? "non_compliant" : "compliant",
        storageCondition: bad ? "2_6" : item.storage,
        expiryDate: shiftKey(dateKey, bad ? 12 : item.shelf),
        actualSaleDate: bad ? "" : shiftKey(dateKey, Math.min(2, item.shelf - 1)),
        actualSaleTime: bad ? "" : "18:00",
        responsiblePerson: ctx.storekeeper.name,
        note: bad
          ? "Вздутая крышка на одном ведре, кисловатый запах. Не принято, оформлен акт забраковки."
          : "",
      });
    });
  });
  return { ...config, rows };
}

function buildProductWriteoffConfig(ctx: DemoJournalContext) {
  const config = normalizeProductWriteoffConfig(ctx.rawConfig);
  const actDay = ctx.ago(4) ?? ctx.todayKey;
  return {
    ...config,
    documentName: "Акт забраковки",
    actNumber: "3",
    documentDate: actDay,
    supplierName: SUPPLIERS.dairy.name,
    comment:
      "Товар не принят на склад. Поставщик уведомлён по телефону, возврат оформлен по накладной.",
    commissionMembers: [
      { role: "Председатель комиссии", person: ctx.manager },
      { role: "Член комиссии", person: ctx.chef },
      { role: "Член комиссии", person: ctx.storekeeper },
    ].map(({ role, person }) =>
      createProductWriteoffCommissionMember({
        role,
        employeeId: person.id,
        employeeName: person.name,
      }),
    ),
    rows: [
      createProductWriteoffRow({
        productName: "Сметана 20 %, ведро ПЭТ 5 кг",
        batchNumber: `L${actDay.slice(2, 4)}${actDay.slice(5, 7)}17`,
        productionDate: shiftKey(actDay, -2),
        quantity: "1 шт. (5 кг)",
        discrepancyDescription: "Вздутая крышка, кисловатый запах — признаки нарушения холодовой цепи",
        action: "Возврат поставщику",
      }),
      createProductWriteoffRow({
        productName: "Салат листовой",
        batchNumber: `L${actDay.slice(2, 4)}${actDay.slice(5, 7)}22`,
        productionDate: shiftKey(actDay, -3),
        quantity: "1,2 кг",
        discrepancyDescription: "Увядшие листья, гниль у основания",
        action: "Утилизация",
      }),
    ],
  };
}

function buildMetalImpurityConfig(ctx: DemoJournalContext) {
  const materials = ["Мука пшеничная в/с", "Сахар-песок", "Крупа рисовая"];
  const suppliers = ["ООО «Агропродукт»", "ИП Смирнов А. В."];
  const base = normalizeMetalImpurityConfig(ctx.rawConfig, {
    users: ctx.people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
    materials,
    suppliers,
    responsibleEmployeeId: ctx.storekeeper.id,
    responsibleName: ctx.storekeeper.name,
    responsiblePosition: ctx.storekeeper.position,
  });
  const materialOptions = materials.map((name, i) => ({ id: `mat-${i + 1}`, name }));
  const supplierOptions = suppliers.map((name, i) => ({ id: `sup-${i + 1}`, name }));
  const findingDay = ctx.ago(5);
  const rows = ctx.windowKeys
    .filter((_, i) => i % 2 === 0)
    .map((dateKey, i) => {
      const found = dateKey === findingDay;
      return createMetalImpurityRow({
        date: dateKey,
        materialId: materialOptions[i % materialOptions.length].id,
        supplierId: supplierOptions[i % supplierOptions.length].id,
        consumedQuantityKg: String(25 + i * 5),
        impurityQuantityG: found ? "0,2" : "0",
        impurityCharacteristic: found ? "Металлическая стружка, 2 частицы до 1 мм" : "Не обнаружено",
        responsibleRole: ctx.storekeeper.position,
        responsibleEmployeeId: ctx.storekeeper.id,
        responsibleName: ctx.storekeeper.name,
      });
    });
  return {
    ...base,
    materials: materialOptions,
    suppliers: supplierOptions,
    responsiblePosition: ctx.storekeeper.position,
    responsibleEmployeeId: ctx.storekeeper.id,
    responsibleEmployee: ctx.storekeeper.name,
    rows,
  };
}

function buildTraceabilityConfig(ctx: DemoJournalContext) {
  const config = normalizeTraceabilityDocumentConfig(ctx.rawConfig);
  const dishes = ctx.roster.dishes;
  const samples = [
    { raw: "Говядина охлаждённая", pieces: 4, kg: 18, out: dishes[1] ?? "Бефстроганов", packs: 36, outKg: 10.8 },
    { raw: "Филе куриное охлаждённое", pieces: 6, kg: 12, out: dishes[2] ?? "Куриное филе", packs: 40, outKg: 9.6 },
    { raw: "Тыква очищенная", pieces: 2, kg: 9, out: dishes[0] ?? "Суп-пюре", packs: 30, outKg: 9 },
  ];
  const days = [ctx.ago(5), ctx.ago(3), ctx.ago(1)].filter((d): d is string => Boolean(d));
  const rows = days.map((dateKey, i) => {
    const s = samples[i % samples.length];
    return createTraceabilityRow({
      date: dateKey,
      incoming: {
        rawMaterialName: s.raw,
        batchNumber: `П-${dateKey.slice(5, 7)}${dateKey.slice(8)}-${i + 1}`,
        packagingDate: shiftKey(dateKey, -1),
        quantityPieces: s.pieces,
        quantityKg: s.kg,
      },
      outgoing: {
        productName: s.out,
        quantityPacksPieces: s.packs,
        quantityPacksKg: s.outKg,
        shockTemp: 3,
      },
      responsibleRole: ctx.technologist.position,
      responsibleEmployeeId: ctx.technologist.id,
      responsibleEmployee: ctx.technologist.name,
    });
  });
  return {
    ...config,
    defaultResponsibleRole: ctx.technologist.position,
    defaultResponsibleEmployeeId: ctx.technologist.id,
    defaultResponsibleEmployee: ctx.technologist.name,
    rows,
  };
}

// ────────────────────────────────────────────────────────────────────
// Оборудование
// ────────────────────────────────────────────────────────────────────

function buildEquipmentCleaningRows(ctx: DemoJournalContext): EntryRow[] {
  const rows: EntryRow[] = [];
  const units = [
    { name: "Мясорубка МИМ-300", washer: ctx.cook, time: "16:30", detergent: "Ника-2", conc: "0,5 %" },
    { name: "Слайсер Sirman Mirra 250", washer: ctx.dishwasher, time: "17:10", detergent: "Ника-2", conc: "0,5 %" },
  ];
  const lowTempDay = ctx.ago(3);
  for (const dateKey of ctx.windowKeys) {
    for (const unit of units) {
      const low = dateKey === lowTempDay && unit.washer.id === ctx.dishwasher.id;
      const data: EquipmentCleaningRowData = emptyEquipmentCleaningRow({
        washDate: dateKey,
        washTime: unit.time,
        equipmentName: unit.name,
        detergentName: unit.detergent,
        detergentConcentration: unit.conc,
        disinfectantName: "Абактерил-хлор",
        disinfectantConcentration: "0,1 %",
        rinseTemperature: low ? "48" : "65",
        rinseResult: low ? "non_compliant" : "compliant",
        washerPosition: unit.washer.position,
        washerName: unit.washer.name,
        washerUserId: unit.washer.id,
        controllerPosition: ctx.chef.position,
        controllerName: ctx.chef.name,
        controllerUserId: ctx.chef.id,
      });
      rows.push({
        documentId: ctx.documentId,
        employeeId: unit.washer.id,
        date: new Date(`${dateKey}T${unit.time}:00`),
        data: json(data),
      });
    }
  }
  return rows;
}

function kitchenEquipmentNames(ctx: DemoJournalContext): string[] {
  return ctx.roster.areas.flatMap((a) => a.equipment.map((e) => e.name));
}

function buildEquipmentMaintenanceConfig(ctx: DemoJournalContext) {
  const config = normalizeEquipmentMaintenanceConfig(ctx.rawConfig);
  const year = Number(ctx.todayKey.slice(0, 4));
  const monthIndex = Number(ctx.todayKey.slice(5, 7)) - 1;
  const monthly = (planDay: string, factDay: string, factFrom: number) => {
    const plan: Record<string, string> = {};
    const fact: Record<string, string> = {};
    for (const [i, key] of MONTH_KEYS.entries()) {
      plan[key] = planDay;
      fact[key] = i < monthIndex || (i === monthIndex && Number(factDay) <= Number(ctx.todayKey.slice(8)))
        ? i >= factFrom ? factDay : "-"
        : "-";
    }
    return { plan, fact };
  };
  const quarterly = (planDay: string) => {
    const plan: Record<string, string> = {};
    const fact: Record<string, string> = {};
    for (const [i, key] of MONTH_KEYS.entries()) {
      const due = i % 3 === 0;
      plan[key] = due ? planDay : "-";
      fact[key] = due && i < monthIndex ? planDay : "-";
    }
    return { plan, fact };
  };
  const rows = [
    ...kitchenEquipmentNames(ctx).map((name) =>
      createEquipmentMaintenanceRow({
        equipmentName: name,
        workType: "Проверка уплотнителей, чистка конденсатора, контроль температуры",
        maintenanceType: "B",
        ...monthly("15", "15", 0),
      }),
    ),
    createEquipmentMaintenanceRow({
      equipmentName: "Пароконвектомат Rational SCC 101",
      workType: "Удаление накипи, проверка датчиков, смазка петель",
      maintenanceType: "A",
      ...quarterly("10"),
    }),
    createEquipmentMaintenanceRow({
      equipmentName: "Посудомоечная машина Abat МПК-700К",
      workType: "Чистка фильтров, проверка дозаторов, декальцинация",
      maintenanceType: "B",
      ...monthly("20", "20", 0),
    }),
    createEquipmentMaintenanceRow({
      equipmentName: "Вытяжная вентиляция горячего цеха",
      workType: "Замена жироулавливающих фильтров, чистка воздуховодов",
      maintenanceType: "A",
      ...quarterly("05"),
    }),
  ];
  return {
    ...config,
    year,
    documentDate: `${year}-01-12`,
    approveRole: ctx.manager.position,
    approveEmployeeId: ctx.manager.id,
    approveEmployee: ctx.manager.name,
    responsibleRole: ctx.chef.position,
    responsibleEmployeeId: ctx.chef.id,
    responsibleEmployee: ctx.chef.name,
    rows,
  };
}

function buildBreakdownConfig(ctx: DemoJournalContext) {
  const config = normalizeBreakdownHistoryDocumentConfig(ctx.rawConfig);
  const first = ctx.ago(5) ?? ctx.todayKey;
  const second = ctx.ago(1) ?? ctx.todayKey;
  return {
    ...config,
    rows: [
      createBreakdownRow({
        startDate: first,
        startHour: "07",
        startMinute: "40",
        equipmentName: "Морозильный ларь №1",
        breakdownDescription: "Не выходит на режим, температура −11 °C при норме −18 °C",
        repairPerformed: "Заменено пусковое реле компрессора, проверен хладагент",
        partsReplaced: "Реле пусковое РТП-1",
        endDate: first,
        endHour: "13",
        endMinute: "20",
        downtimeHours: "5,7",
        responsiblePerson: ctx.chef.name,
      }),
      createBreakdownRow({
        startDate: second,
        startHour: "10",
        startMinute: "15",
        equipmentName: "Пароконвектомат Rational SCC 101",
        breakdownDescription: "Ошибка E12 — не работает парогенератор",
        repairPerformed: "Заявка сервисному центру, удалена накипь, заменён датчик уровня",
        partsReplaced: "Датчик уровня воды",
        endDate: second,
        endHour: "16",
        endMinute: "45",
        downtimeHours: "6,5",
        responsiblePerson: ctx.chef.name,
      }),
    ],
  };
}

function buildCalibrationConfig(ctx: DemoJournalContext) {
  const config = normalizeEquipmentCalibrationConfig(ctx.rawConfig);
  const year = Number(ctx.todayKey.slice(0, 4));
  const rows = [
    createCalibrationRow({
      equipmentName: "Термометр щуповой ТК-5.01",
      equipmentNumber: "СИ-01",
      location: "Горячий цех",
      purpose: "Контроль температуры блюд при бракераже",
      measurementRange: "−40…+250 °C",
      calibrationInterval: 12,
      lastCalibrationDate: shiftKey(ctx.todayKey, -120),
      note: "",
    }),
    createCalibrationRow({
      equipmentName: "Термометр инфракрасный Testo 805",
      equipmentNumber: "СИ-02",
      location: "Приёмка, склад",
      purpose: "Контроль температуры сырья при приёмке",
      measurementRange: "−25…+250 °C",
      calibrationInterval: 12,
      lastCalibrationDate: shiftKey(ctx.todayKey, -400),
      note: "Срок поверки истёк — сдать в поверку до конца недели",
    }),
    createCalibrationRow({
      equipmentName: "Весы настольные CAS SW-10",
      equipmentNumber: "СИ-03",
      location: "Холодный цех",
      purpose: "Взвешивание порций и полуфабрикатов",
      measurementRange: "0,04…10 кг",
      calibrationInterval: 12,
      lastCalibrationDate: shiftKey(ctx.todayKey, -200),
      note: "",
    }),
    createCalibrationRow({
      equipmentName: "Термогигрометр ИВА-6Н",
      equipmentNumber: "СИ-04",
      location: "Склад сухих продуктов",
      purpose: "Контроль температуры и влажности хранения",
      measurementRange: "−20…+60 °C; 0…98 %",
      calibrationInterval: 24,
      lastCalibrationDate: shiftKey(ctx.todayKey, -300),
      note: "",
    }),
  ];
  return {
    ...config,
    year,
    documentDate: `${year}-01-12`,
    approveRole: ctx.manager.position,
    approveEmployeeId: ctx.manager.id,
    approveEmployee: ctx.manager.name,
    rows,
  };
}

function buildGlassListConfig(ctx: DemoJournalContext) {
  const config = normalizeGlassListConfig(ctx.rawConfig);
  const rows = ctx.roster.rooms.flatMap((room) => {
    const kind = room.kind;
    const items: Array<[string, string]> =
      kind === "kitchen"
        ? [["Светильник потолочный LED (плафон)", "4"], ["Окно (стеклопакет)", "2"], ["Термометр стеклянный", "1"]]
        : kind === "wash"
          ? [["Светильник потолочный LED (плафон)", "2"], ["Окно (стеклопакет)", "1"]]
          : kind === "storage"
            ? [["Светильник потолочный LED (плафон)", "2"]]
            : kind === "guest" || kind === "bar"
              ? [["Светильник потолочный LED (плафон)", "8"], ["Окно витринное", "3"], ["Зеркало настенное", "1"], ["Бокалы и стаканы (сервировка)", "120"]]
              : [["Зеркало настенное", "1"], ["Светильник потолочный LED (плафон)", "2"]];
    return items.map(([itemName, quantity]) =>
      createGlassListRow({ location: room.name, itemName, quantity }),
    );
  });
  return {
    ...config,
    documentName: "Перечень стеклянных и хрупких изделий",
    location: ctx.organizationName,
    documentDate: shiftKey(ctx.todayKey, -45),
    responsibleTitle: ctx.manager.position,
    responsibleUserId: ctx.manager.id,
    rows,
  };
}

function buildGlassControlRows(ctx: DemoJournalContext): EntryRow[] {
  const damageDay = ctx.ago(4);
  return ctx.windowKeys.map((dateKey) => {
    const damaged = dateKey === damageDay;
    const data: GlassControlEntryData = damaged
      ? {
          damagesDetected: true,
          itemName: "Плафон светильника, горячий цех",
          quantity: "1",
          damageInfo:
            "Трещина плафона над раздачей. Продукция в радиусе 2 м снята с раздачи и утилизирована (3,5 кг), зона убрана, плафон заменён.",
        }
      : { damagesDetected: false, itemName: "", quantity: "", damageInfo: "" };
    return {
      documentId: ctx.documentId,
      employeeId: ctx.cleaner.id,
      date: utcMidnight(dateKey),
      data: json(data),
    };
  });
}

// ────────────────────────────────────────────────────────────────────
// Персонал
// ────────────────────────────────────────────────────────────────────

function buildTrainingPlanConfig(ctx: DemoJournalContext) {
  const config = normalizeTrainingPlanConfig(ctx.rawConfig);
  const year = Number(ctx.todayKey.slice(0, 4));
  const yy = String(year).slice(2);
  const topicIds = config.topics.map((t) => t.id);
  const positions = Array.from(new Set(ctx.people.map((p) => p.position)));
  const rows = positions.map((positionName, index) => {
    const row = createEmptyTrainingRow(positionName, topicIds);
    for (const [i, topicId] of topicIds.entries()) {
      const required = topicId !== "kkt" || /Официант|Бармен|Кассир|Продавец/.test(positionName);
      const month = ((index + i * 2) % 12) + 1;
      row.cells[topicId] = {
        required,
        date: required ? `${String(month).padStart(2, "0")}.${yy}` : "",
      };
    }
    return row;
  });
  return {
    ...config,
    year,
    documentDate: `${year}-01-10`,
    approveRole: ctx.manager.position,
    approveEmployeeId: ctx.manager.id,
    approveEmployee: ctx.manager.name,
    rows,
  };
}

function buildStaffTrainingConfig(ctx: DemoJournalContext) {
  const config = normalizeStaffTrainingConfig(ctx.rawConfig);
  const label = (value: (typeof TRAINING_TOPICS)[number]["value"]) =>
    TRAINING_TOPICS.find((t) => t.value === value)?.label ?? value;
  const staff = ctx.people.filter((p) => p.role !== "manager");
  const failed = staff.find((p) => p.role === "cook" && p.id !== ctx.chef.id) ?? staff[0];
  const rows = [
    ...staff.map((person, i) =>
      createStaffTrainingRow({
        date: shiftKey(ctx.todayKey, -20 - (i % 4)),
        employeeId: person.id,
        employeeName: person.name,
        employeePosition: person.position,
        topic: label("sanitation"),
        trainingType: "repeated",
        unscheduledReason: "",
        instructorName: ctx.technologist.name,
        attestationResult: person.id === failed?.id ? "failed" : "passed",
      }),
    ),
    ...(failed
      ? [
          createStaffTrainingRow({
            date: shiftKey(ctx.todayKey, -13),
            employeeId: failed.id,
            employeeName: failed.name,
            employeePosition: failed.position,
            topic: label("sanitation"),
            trainingType: "unscheduled",
            unscheduledReason: "Повторная аттестация после неудовлетворительного результата",
            instructorName: ctx.technologist.name,
            attestationResult: "passed",
          }),
        ]
      : []),
    createStaffTrainingRow({
      date: ctx.ago(6) ?? ctx.todayKey,
      employeeId: ctx.cook.id,
      employeeName: ctx.cook.name,
      employeePosition: ctx.cook.position,
      topic: label("safety"),
      trainingType: "unscheduled",
      unscheduledReason: "Ввод в эксплуатацию новой фритюрницы",
      instructorName: ctx.chef.name,
      attestationResult: "passed",
    }),
    createStaffTrainingRow({
      date: ctx.ago(2) ?? ctx.todayKey,
      employeeId: ctx.cleaner.id,
      employeeName: ctx.cleaner.name,
      employeePosition: ctx.cleaner.position,
      topic: label("fire"),
      trainingType: "repeated",
      unscheduledReason: "",
      instructorName: ctx.manager.name,
      attestationResult: "passed",
    }),
  ];
  return { ...config, rows };
}

function buildPpeIssuanceConfig(ctx: DemoJournalContext) {
  const config = normalizePpeIssuanceConfig(
    ctx.rawConfig,
    ctx.people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
  );
  const issueDay = ctx.ago(6) ?? ctx.todayKey;
  const kitchen = ctx.people.filter((p) => p.role !== "manager" && p.role !== "waiter");
  const rows = kitchen.map((person, i) =>
    createPpeIssuanceRow({
      issueDate: i % 3 === 0 ? shiftKey(issueDay, 1) : issueDay,
      maskCount: 50,
      gloveCount: 100,
      shoePairsCount: /Уборщик|Посудомойщик/.test(person.position) ? 1 : 0,
      clothingSetsCount: 2,
      capCount: 2,
      recipientUserId: person.id,
      recipientTitle: person.position,
      issuerUserId: ctx.manager.id,
      issuerTitle: ctx.manager.position,
    }),
  );
  return {
    ...config,
    showGloves: true,
    showShoes: true,
    showClothing: true,
    showCaps: true,
    defaultIssuerUserId: ctx.manager.id,
    defaultIssuerTitle: ctx.manager.position,
    rows,
  };
}

function buildMedBookRows(ctx: DemoJournalContext): EntryRow[] {
  const year = Number(ctx.todayKey.slice(0, 4));
  return ctx.people.map((person, index) => {
    const data = emptyMedBookEntry(person.position);
    const female = /а$/.test(person.name.split(" ")[0] ?? "");
    data.gender = female ? "female" : "male";
    data.birthDate = `${year - 28 - ((index * 7) % 25)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index * 3) % 27 + 1).padStart(2, "0")}`;
    data.hireDate = shiftKey(ctx.todayKey, -(90 + index * 47));
    data.medBookNumber = `МК-77-${String(4210 + index * 13).padStart(4, "0")}`;
    const examDay = shiftKey(ctx.todayKey, -(30 + (index * 23) % 200));
    for (const name of DEFAULT_EXAMINATIONS) {
      if (name === "Гинеколог" && !female) continue;
      if (name === "Маммография" && (!female || Number(data.birthDate.slice(0, 4)) > year - 40)) continue;
      let date = examDay;
      if (name === "Флюорография" && index === 2) date = shiftKey(ctx.todayKey, -350);
      if (name === "Терапевт" && index === 5) date = shiftKey(ctx.todayKey, -380);
      data.examinations[name] = { date, expiryDate: shiftKey(date, 365) };
    }
    for (const [i, name] of DEFAULT_VACCINATIONS.entries()) {
      const date = shiftKey(ctx.todayKey, -(120 + ((index + i) * 41) % 600));
      const years = name === "Грипп" || name === "Коронавирус" ? 1 : name === "Дизентерия Зонне" ? 1 : 10;
      data.vaccinations[name] =
        name === "Коронавирус" && index % 4 === 3
          ? { type: "refusal" }
          : { type: "done", dose: name === "Гепатит B" ? "3 из 3" : "", date, expiryDate: shiftKey(date, 365 * years) };
    }
    if (index === 2) data.note = "Флюорография истекает — записана на следующую неделю";
    if (index === 5) data.note = "Терапевт просрочен, направлена на осмотр";
    return {
      documentId: ctx.documentId,
      employeeId: person.id,
      date: ctx.docDateFrom,
      data: json(data),
    };
  });
}

// ────────────────────────────────────────────────────────────────────
// Санитария помещений
// ────────────────────────────────────────────────────────────────────

function buildSanitaryDayRows(ctx: DemoJournalContext): EntryRow[] {
  const config = normalizeSdcConfig(ctx.rawConfig);
  const marks: Record<string, string> = {};
  config.items.forEach((item, i) => {
    const minutes = 9 * 60 + i * 12;
    marks[item.id] = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
  const data: SdcEntryData = { marks };
  return [
    {
      documentId: ctx.documentId,
      employeeId: ctx.cleaner.id,
      date: ctx.docDateFrom,
      data: json(data),
    },
  ];
}

function buildPestControlRows(ctx: DemoJournalContext): EntryRow[] {
  const acceptedRole = getHygienePositionLabel(ctx.manager.role);
  const events = [
    {
      dateKey: ctx.ago(6) ?? ctx.todayKey,
      hour: "10",
      minute: "30",
      event: "Плановая дератизация и дезинсекция",
      area: "Все производственные помещения, склад, зона мусоросборника — 240 м²",
      product: "Ратобор (бромадиолон), гель Глобол (дезинсекция)",
      note: "Акт № 118 от подрядчика ООО «Дезцентр». Следов грызунов нет, приманочные станции обновлены.",
      performedBy: "ООО «Дезцентр», Титов С. А.",
    },
    {
      dateKey: ctx.ago(1) ?? ctx.todayKey,
      hour: "09",
      minute: "15",
      event: "Осмотр приманочных станций и клеевых ловушек",
      area: "Склад, моечная, тамбур — 8 станций",
      product: "—",
      note: "Приманка не тронута, ловушки чистые. Следующая обработка по графику через месяц.",
      performedBy: ctx.cleaner.name,
    },
  ];
  return events.map((e) => {
    const data: PestControlEntryData = {
      performedDate: e.dateKey,
      performedHour: e.hour,
      performedMinute: e.minute,
      timeSpecified: true,
      event: e.event,
      areaOrVolume: e.area,
      treatmentProduct: e.product,
      note: e.note,
      performedBy: e.performedBy,
      acceptedRole,
      acceptedEmployeeId: ctx.manager.id,
    };
    return {
      documentId: ctx.documentId,
      employeeId: ctx.manager.id,
      date: new Date(`${e.dateKey}T${e.hour}:${e.minute}:00`),
      data: json(data),
    };
  });
}

// ────────────────────────────────────────────────────────────────────
// Аудиты, аварии, жалобы
// ────────────────────────────────────────────────────────────────────

function buildAuditPlanConfig(ctx: DemoJournalContext) {
  const config = normalizeAuditPlanConfig(ctx.rawConfig, {
    organizationName: ctx.organizationName,
    users: ctx.people.map((p) => ({ id: p.id, name: p.name, role: p.role })),
  });
  const year = Number(ctx.todayKey.slice(0, 4));
  const columns = config.columns.map((column, i) => ({
    ...column,
    auditorName: i === 0 ? ctx.technologist.name : ctx.manager.name,
  }));
  // Дефолтные даты плана — из образца прошлых лет; переписываем на
  // текущий год: первая половина аудитов уже прошла (отмечены), вторая —
  // впереди.
  const rows = config.rows.map((row, index) => {
    const values: Record<string, string> = {};
    for (const [i, column] of columns.entries()) {
      const month = 2 + ((index + i * 5) % 10);
      const day = 5 + ((index * 3 + i * 7) % 20);
      const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      values[column.id] = row.values[column.id] === "X" ? "X" : formatDash(key);
    }
    const passed = Object.values(values).some((v) => v !== "X" && v.split("-").reverse().join("-") <= ctx.todayKey);
    return { ...row, values, checked: passed };
  });
  return {
    ...config,
    year,
    documentDate: `${year}-01-15`,
    approveRole: ctx.manager.position,
    approveEmployeeId: ctx.manager.id,
    approveEmployee: ctx.manager.name,
    columns,
    rows,
  };
}

function buildAuditProtocolConfig(ctx: DemoJournalContext) {
  const config = normalizeAuditProtocolConfig(ctx.rawConfig);
  const day = ctx.ago(3) ?? ctx.todayKey;
  const sections = [
    createAuditProtocolSection("Общие требования СМБПП"),
    createAuditProtocolSection("Требования к документации"),
    createAuditProtocolSection("Требования к персоналу"),
  ];
  const questions: Array<[number, string, "yes" | "no", string]> = [
    [0, "Политика в области безопасности пищевой продукции доведена до персонала", "yes", ""],
    [0, "Определены и контролируются критические контрольные точки (ККТ)", "yes", "Температура холодильного оборудования, бракераж готовых блюд"],
    [0, "Ведётся программа производственного контроля", "yes", ""],
    [1, "Журналы ведутся своевременно, без пропусков", "no", "В журнале уборки пропущена отметка за помещение «Склад» за один день"],
    [1, "Хранятся сопроводительные документы на сырьё (ТТН, декларации)", "yes", ""],
    [1, "Актуальны инструкции по мойке и дезинфекции", "yes", ""],
    [2, "Личные медицинские книжки в наличии, осмотры не просрочены", "no", "У одного сотрудника истекает срок флюорографии"],
    [2, "Персонал проходит инструктажи по санитарии в срок", "yes", ""],
    [2, "Спецодежда выдана, сменная, чистая", "yes", ""],
  ];
  return {
    ...config,
    documentDate: day,
    basisTitle: `План-программа внутренних аудитов на ${day.slice(0, 4)} год`,
    auditedObject: `${ctx.organizationName}: производственные помещения, документация СМБПП`,
    sections,
    rows: questions.map(([s, text, result, note]) =>
      createAuditProtocolRow({ sectionId: sections[s].id, text, result, note }),
    ),
    signatures: [
      createAuditProtocolSignature({ name: ctx.technologist.name, role: `Аудитор, ${ctx.technologist.position.toLowerCase()}`, signedAt: day }),
      createAuditProtocolSignature({ name: ctx.chef.name, role: `Представитель проверяемого объекта, ${ctx.chef.position.toLowerCase()}`, signedAt: day }),
    ],
  };
}

function buildAuditReportConfig(ctx: DemoJournalContext) {
  const config = normalizeAuditReportConfig(ctx.rawConfig);
  const auditDay = ctx.ago(3) ?? ctx.todayKey;
  const reportDay = ctx.ago(2) ?? ctx.todayKey;
  return {
    ...config,
    documentDate: reportDay,
    auditType: "planned" as const,
    basisTitle: `План-программа внутренних аудитов на ${reportDay.slice(0, 4)} год, протокол от ${formatDot(auditDay)}`,
    auditedObject: `${ctx.organizationName}: производственные помещения, документация СМБПП`,
    auditors: [ctx.technologist.name, ctx.manager.name],
    summary:
      "Система менеджмента безопасности пищевой продукции функционирует. Критические контрольные точки контролируются, отклонения фиксируются с корректирующими действиями. Выявлено 2 несоответствия, критических нет.",
    recommendations:
      "Закрепить контроль заполнения журнала уборки за су-шефом в конце смены. Вести реестр сроков медосмотров с напоминанием за 30 дней.",
    findings: [
      createAuditReportFinding({
        nonConformity: "Пропущена отметка об уборке помещения «Склад» за один день (журнал уборки)",
        correctionActions: "Уборка проведена, отметка внесена с комментарием",
        correctiveActions: "Ежедневная проверка журнала уборки су-шефом перед закрытием смены",
        responsibleName: ctx.chef.name,
        responsiblePosition: ctx.chef.position,
        dueDatePlan: shiftKey(reportDay, 7),
        dueDateFact: "",
      }),
      createAuditReportFinding({
        nonConformity: "У сотрудника истекает срок флюорографии (менее 2 недель)",
        correctionActions: "Сотрудник записан на обследование",
        correctiveActions: "Реестр сроков медосмотров с напоминанием за 30 дней",
        responsibleName: ctx.manager.name,
        responsiblePosition: ctx.manager.position,
        dueDatePlan: shiftKey(reportDay, 14),
        dueDateFact: "",
      }),
    ],
    signatures: [
      createAuditReportSignature({ role: "Руководитель аудита", name: ctx.technologist.name, position: ctx.technologist.position, signedAt: reportDay }),
      createAuditReportSignature({ role: "Ознакомлен", name: ctx.manager.name, position: ctx.manager.position, signedAt: reportDay }),
    ],
  };
}

function buildAccidentConfig(ctx: DemoJournalContext) {
  const config = normalizeAccidentDocumentConfig(ctx.rawConfig);
  const recent = ctx.ago(4) ?? ctx.todayKey;
  const earlier = shiftKey(ctx.todayKey, -52);
  return {
    ...config,
    rows: [
      createAccidentRow({
        accidentDate: earlier,
        accidentHour: "14",
        accidentMinute: "20",
        locationName: "Моечная",
        accidentDescription: "Засор канализации, вода на полу моечной",
        affectedProducts: "Продукция не пострадала",
        resolvedDate: earlier,
        resolvedHour: "17",
        resolvedMinute: "00",
        responsiblePeople: `${ctx.manager.name}, ${ctx.dishwasher.name}`,
        correctiveActions: "Вызвана аварийная служба, канализация прочищена, пол вымыт и продезинфицирован (Абактерил-хлор 0,1 %)",
      }),
      createAccidentRow({
        accidentDate: recent,
        accidentHour: "03",
        accidentMinute: "10",
        locationName: "Всё здание",
        accidentDescription: "Отключение электроэнергии на 2 ч 40 мин (авария на подстанции)",
        affectedProducts: "Холодильники не открывались, температура +6 °C на момент включения — продукция сохранена. Морозильный ларь −15 °C — допустимо.",
        resolvedDate: recent,
        resolvedHour: "05",
        resolvedMinute: "50",
        responsiblePeople: `${ctx.manager.name}, ${ctx.chef.name}`,
        correctiveActions: "Контрольный замер температур в 06:00 и 08:00, записи в журнале холодильного оборудования. Заявка на резервный генератор.",
      }),
    ],
  };
}

function buildComplaintConfig(ctx: DemoJournalContext) {
  const config = normalizeComplaintConfig(ctx.rawConfig);
  const first = ctx.ago(5) ?? ctx.todayKey;
  const second = ctx.ago(1) ?? ctx.todayKey;
  return {
    ...config,
    defaultResponsibleUserId: ctx.manager.id,
    defaultResponsibleTitle: ctx.manager.position,
    rows: [
      buildComplaintRow({
        receiptDate: first,
        applicantName: "Кравцова Елена",
        complaintReceiptForm: "в книге отзывов и предложений",
        applicantDetails: "+7 916 ***-**-41",
        complaintContent: "В супе-пюре из тыквы обнаружен волос. Блюдо заменили, но осадок остался.",
        decisionDate: shiftKey(first, 1),
        decisionSummary:
          "Проведена беседа с поварами, проверено ношение головных уборов (журнал гигиены). Гостье принесены извинения, подарен сертификат на 1 500 ₽.",
      }),
      buildComplaintRow({
        receiptDate: second,
        applicantName: "Игорь М.",
        complaintReceiptForm: "по электронной почте",
        applicantDetails: "igor.m***@mail.ru",
        complaintContent: "Ждали горячее 55 минут в пятницу вечером, официант не предупредил о задержке.",
        decisionDate: "",
        decisionSummary: "",
      }),
    ],
  };
}

// ────────────────────────────────────────────────────────────────────
// Диспетчер
// ────────────────────────────────────────────────────────────────────

/**
 * Что положить в документ журнала `code`. Null — журнал не из этого
 * набора (ежедневные собираются в demo-organization.ts) или для сферы
 * нет смысла его наполнять.
 */
export function buildDemoJournalSeed(code: string, ctx: DemoJournalContext): DemoJournalSeed | null {
  switch (code) {
    case "incoming_control":
    case "incoming_raw_materials_control":
      return { config: buildAcceptanceConfig(ctx) };
    case "finished_product":
      return { config: buildFinishedProductConfig(ctx) };
    case "perishable_rejection":
      return { config: buildPerishableConfig(ctx) };
    case "product_writeoff":
      return { config: buildProductWriteoffConfig(ctx) };
    case "metal_impurity":
      return { config: buildMetalImpurityConfig(ctx) };
    case "traceability_test":
      return { config: buildTraceabilityConfig(ctx) };
    case "equipment_cleaning":
      return { rows: buildEquipmentCleaningRows(ctx) };
    case "equipment_maintenance":
      return { config: buildEquipmentMaintenanceConfig(ctx) };
    case "breakdown_history":
      return { config: buildBreakdownConfig(ctx) };
    case "equipment_calibration":
      return { config: buildCalibrationConfig(ctx) };
    case "glass_items_list":
      return { config: buildGlassListConfig(ctx) };
    case "glass_control":
      return { rows: buildGlassControlRows(ctx) };
    case "training_plan":
      return { config: buildTrainingPlanConfig(ctx) };
    case "staff_training":
      return { config: buildStaffTrainingConfig(ctx) };
    case "ppe_issuance":
      return { config: buildPpeIssuanceConfig(ctx) };
    case "med_books":
      return { rows: buildMedBookRows(ctx) };
    case "sanitary_day_control":
      return { rows: buildSanitaryDayRows(ctx) };
    case "pest_control":
      return { rows: buildPestControlRows(ctx) };
    case "audit_plan":
      return { config: buildAuditPlanConfig(ctx) };
    case "audit_protocol":
      return { config: buildAuditProtocolConfig(ctx) };
    case "audit_report":
      return { config: buildAuditReportConfig(ctx) };
    case "accident_journal":
      return { config: buildAccidentConfig(ctx) };
    case "complaint_register":
      return { config: buildComplaintConfig(ctx) };
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// Бумажные журналы (PaperJournalDocument.rows — строки по колонкам).
// ────────────────────────────────────────────────────────────────────

/**
 * Строки бумажного журнала по его колонкам: подбираем значение по
 * заголовку, чтобы не зависеть от порядка колонок в справочнике.
 * Подписи оставляем пустыми — их ставят ручкой.
 */
type PaperCtx = Pick<DemoJournalContext, "people" | "manager" | "technologist" | "chef" | "todayKey" | "ago" | "roster">;

/**
 * Кто проводит инструктаж: пожарный и электро — управляющий, охрана труда —
 * технолог. Это же имя идёт в `responsible` документа, чтобы селект
 * «Кто проводит инструктаж» совпадал с колонкой в строках.
 */
export function paperJournalInstructor(journal: PaperJournal, ctx: PaperCtx): DemoJournalContext["manager"] {
  return journal.id === "fire_safety" || journal.id === "electrical_safety" ? ctx.manager : ctx.technologist;
}

export function buildPaperJournalRows(journal: PaperJournal, ctx: PaperCtx): string[][] {
  const instructor = paperJournalInstructor(journal, ctx);
  const staff = ctx.people.filter((p) => p.id !== instructor.id);

  if (journal.id === "fire_extinguishers") {
    const units = [
      ["ОП-4 №1", "Порошковый ОП-4(з)", "Горячий цех, у выхода"],
      ["ОП-4 №2", "Порошковый ОП-4(з)", "Гостевой зал, у бара"],
      ["ОУ-3 №3", "Углекислотный ОУ-3", "Электрощитовая"],
      ["ОП-5 №4", "Порошковый ОП-5(з)", "Склад"],
    ];
    const year = Number(ctx.todayKey.slice(0, 4));
    return units.map(([number, type, place], i) =>
      journal.columns.map((column) => {
        if (/Номер/i.test(column)) return number;
        if (/Тип/i.test(column)) return type;
        if (/ввода/i.test(column)) return `12.03.${year - 2 - (i % 2)}`;
        if (/Место/i.test(column)) return place;
        // «Результат осмотра» проверяем раньше «Дата осмотра» — иначе
        // в результат попадёт дата.
        if (/Результат/i.test(column)) return i === 2 ? "Пломба нарушена — заменён" : "Исправен, давление в норме";
        if (/осмотра/i.test(column)) return formatDot(ctx.ago(2) ?? ctx.todayKey);
        if (/перезарядки/i.test(column)) return `12.03.${year - (i % 2)}`;
        return "";
      }),
    );
  }

  const isElectrical = journal.id === "electrical_safety";
  const isWorkplace = journal.id === "ot_workplace";
  const isFire = journal.id === "fire_safety";
  const rows = staff.map((person, i) => {
    // Вводный — при приёме, остальные — повторные с разбегом по дням окна.
    const dateKey = journal.id === "ot_intro"
      ? shiftKey(ctx.todayKey, -(90 + i * 47))
      : ctx.ago(Math.min(6, i % 5)) ?? ctx.todayKey;
    const birthYear = Number(ctx.todayKey.slice(0, 4)) - 28 - ((i * 7) % 25);
    return journal.columns.map((column) => {
      if (/^Дата/i.test(column)) return formatDot(dateKey);
      if (/ФИО инструктируемого|ФИО работника/i.test(column)) return person.name;
      if (/Год рождения/i.test(column)) return String(birthYear);
      if (/Профессия|Должность/i.test(column)) return person.position;
      if (/Вид инструктажа/i.test(column)) {
        if (isFire) return i % 4 === 0 ? "первичный" : "повторный";
        if (isWorkplace) return i % 5 === 0 ? "внеплановый" : "повторный";
        return "повторный";
      }
      if (/Группа/i.test(column)) return isElectrical ? (/Шеф|Су-шеф|Повар/.test(person.position) ? "II" : "I") : "";
      if (/ФИО инструктирующего|ФИО проверяющего/i.test(column)) return instructor.name;
      return "";
    });
  });
  // Строки с i % 5 === 0 датированы сегодняшним днём — «бумажный» журнал
  // тоже живой на дату демо, отдельную строку добавлять не нужно.
  return rows;
}

export { shortName as demoShortName };
