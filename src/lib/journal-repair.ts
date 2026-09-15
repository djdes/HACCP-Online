/**
 * Чистые правила для `scripts/repair-journal-responsibles.ts`: что считать
 * «не тем человеком» в документе и какие данные в конфиге — фикстуры из
 * старых дефолтов, а не данные организации.
 *
 * БД здесь нет — только решения. Скрипт читает организацию, прогоняет
 * документы через эти функции и печатает/применяет результат.
 */

import { createColdEquipmentConfigItem } from "@/lib/cold-equipment-document";
import { isPlaceholderStaffUser } from "@/lib/journal-roster";

export type RepairUser = {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  isActive: boolean;
  archivedAt: Date | null;
  isRoot: boolean;
};

export type UserRefProblem = "missing" | "foreign" | "root" | "archived" | "placeholder";

export const USER_REF_PROBLEM_LABELS: Record<UserRefProblem, string> = {
  missing: "пользователь удалён",
  foreign: "из другой организации",
  root: "ROOT",
  archived: "уволен / неактивен",
  placeholder: "аккаунт-заглушка (имя = почта)",
};

/**
 * Что не так со ссылкой на пользователя. `placeholder` проблемой считается,
 * только если в организации есть живые сотрудники, которых можно поставить
 * вместо него (`hasRealStaff`).
 */
export function classifyUserRef(
  userId: string | null | undefined,
  organizationId: string,
  usersById: ReadonlyMap<string, RepairUser>,
  hasRealStaff: boolean
): UserRefProblem | null {
  if (!userId) return null;
  const user = usersById.get(userId);
  if (!user) return "missing";
  if (user.isRoot) return "root";
  if (user.organizationId !== organizationId) return "foreign";
  if (!user.isActive || user.archivedAt) return "archived";
  if (hasRealStaff && isPlaceholderStaffUser(user)) return "placeholder";
  return null;
}

/** Ключи верхнего уровня конфига, в которых лежит id сотрудника. */
export const CONFIG_USER_REF_KEYS = [
  "responsibleUserId",
  "defaultResponsibleUserId",
  "responsibleEmployeeId",
  "defaultResponsibleEmployeeId",
  "approveEmployeeId",
  "washerUserId",
  "controllerUserId",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Обнуляет в конфиге ссылки на людей, которых там быть не должно
 * (`isBad(id) === true`): верхний уровень и комиссия. Имена рядом не
 * трогаем — их правит человек, а печать без id берёт имя как есть.
 */
export function stripBadConfigUserRefs(
  config: unknown,
  isBad: (userId: string) => boolean
): { config: Record<string, unknown> | null; removed: string[] } {
  const record = asRecord(config);
  if (!record) return { config: null, removed: [] };
  const next: Record<string, unknown> = { ...record };
  const removed: string[] = [];

  for (const key of CONFIG_USER_REF_KEYS) {
    const value = next[key];
    if (typeof value === "string" && value && isBad(value)) {
      next[key] = null;
      removed.push(key);
    }
  }

  const commission = asRecord(next.commission);
  if (commission) {
    const nextCommission: Record<string, unknown> = { ...commission };
    for (const [key, value] of Object.entries(commission)) {
      if (typeof value === "string" && value && isBad(value)) {
        nextCommission[key] = null;
        removed.push(`commission.${key}`);
      }
    }
    if (removed.some((key) => key.startsWith("commission."))) {
      next.commission = nextCommission;
    }
  }

  return { config: removed.length > 0 ? next : null, removed };
}

// ─── Фикстуры старых дефолтов ───────────────────────────────────────────

const PERISHABLE_FIXTURE_MANUFACTURERS = new Set(['ООО "Ромашка"']);
const PERISHABLE_FIXTURE_SUPPLIERS = new Set(["ИП Бубнов Б.Б."]);
const PERISHABLE_FIXTURE_ITEMS = new Set(["Пельмени"]);
const DISINFECTANT_FIXTURE_NAME = "Ph средство дезинфицирующее";
const DISINFECTANT_FIXTURE_ROW_IDS = new Set(["sub-1", "sub-2", "sub-3", "rec-1", "rec-2", "con-1"]);
const TRACEABILITY_FIXTURE_RAW = ["Мука"];
const TRACEABILITY_FIXTURE_PRODUCTS = ["Пельмени"];
export const COLD_EQUIPMENT_FIXTURE_ID_PREFIX = "cold-equipment-default-";

function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export type FixtureFix = {
  /** Что нашли — для отчёта. */
  findings: string[];
  /** Исправленный конфиг, если есть что безопасно исправить. */
  config: Record<string, unknown> | null;
};

export type FixtureContext = {
  /** Названия изделий, которые реально встречаются в строках документа. */
  usedValues?: ReadonlySet<string>;
  /** id позиций холодильного журнала, у которых в записях есть показания. */
  equipmentIdsWithReadings?: ReadonlySet<string>;
  /** Холодильники организации — ими заменяются стоковые позиции. */
  orgColdEquipment?: Array<{
    sourceEquipmentId: string;
    name: string;
    min: number | null;
    max: number | null;
  }>;
};

/**
 * Находит в конфиге данные из старых дефолтов и возвращает исправленную
 * версию. Правило «не навредить»: убираем только значения, совпадающие с
 * фикстурой дословно и нигде не использованные в строках документа.
 */
export function detectConfigFixtures(
  templateCode: string,
  config: unknown,
  context: FixtureContext = {}
): FixtureFix {
  const record = asRecord(config);
  if (!record) return { findings: [], config: null };
  const used = context.usedValues ?? new Set<string>();
  const findings: string[] = [];
  const next: Record<string, unknown> = { ...record };
  let changed = false;

  if (templateCode === "perishable_rejection") {
    const manufacturers = textList(record.manufacturers);
    const suppliers = textList(record.suppliers);
    const fixtureManufacturers = manufacturers.filter((item) => PERISHABLE_FIXTURE_MANUFACTURERS.has(item));
    const fixtureSuppliers = suppliers.filter((item) => PERISHABLE_FIXTURE_SUPPLIERS.has(item));
    if (fixtureManufacturers.length > 0 || fixtureSuppliers.length > 0) {
      findings.push(`справочники: ${[...fixtureManufacturers, ...fixtureSuppliers].join(", ")}`);
      next.manufacturers = manufacturers.filter(
        (item) => !PERISHABLE_FIXTURE_MANUFACTURERS.has(item) || used.has(item)
      );
      next.suppliers = suppliers.filter(
        (item) => !PERISHABLE_FIXTURE_SUPPLIERS.has(item) || used.has(item)
      );
      changed = true;
    }
    if (Array.isArray(record.productLists)) {
      let listChanged = false;
      const lists = (record.productLists as unknown[]).map((list) => {
        const listRecord = asRecord(list);
        if (!listRecord) return list;
        const items = textList(listRecord.items);
        const cleaned = items.filter((item) => !PERISHABLE_FIXTURE_ITEMS.has(item) || used.has(item));
        if (cleaned.length !== items.length) {
          listChanged = true;
          return { ...listRecord, items: cleaned };
        }
        return list;
      });
      if (listChanged) {
        findings.push("изделие «Пельмени» из образца");
        next.productLists = lists;
        changed = true;
      }
    }
  }

  if (templateCode === "disinfectant_usage") {
    for (const key of ["subdivisions", "receipts", "consumptions"] as const) {
      if (!Array.isArray(record[key])) continue;
      const rows = record[key] as unknown[];
      const kept = rows.filter((row) => {
        const rowRecord = asRecord(row);
        if (!rowRecord) return true;
        const isFixture =
          typeof rowRecord.id === "string" &&
          DISINFECTANT_FIXTURE_ROW_IDS.has(rowRecord.id) &&
          rowRecord.disinfectantName === DISINFECTANT_FIXTURE_NAME;
        return !isFixture;
      });
      if (kept.length !== rows.length) {
        findings.push(`${key}: ${rows.length - kept.length} строк(и) образца «${DISINFECTANT_FIXTURE_NAME}»`);
        next[key] = kept;
        changed = true;
      }
    }
  }

  if (templateCode === "traceability_test") {
    const raw = textList(record.rawMaterialList);
    const products = textList(record.productList);
    if (sameList(raw, TRACEABILITY_FIXTURE_RAW) && !used.has(raw[0])) {
      findings.push("сырьё «Мука» из образца");
      next.rawMaterialList = [];
      changed = true;
    }
    if (sameList(products, TRACEABILITY_FIXTURE_PRODUCTS) && !used.has(products[0])) {
      findings.push("продукция «Пельмени» из образца");
      next.productList = [];
      changed = true;
    }
  }

  if (templateCode === "cold_equipment_control" && Array.isArray(record.equipment)) {
    const items = record.equipment as unknown[];
    const fixtureItems = items.filter((item) => {
      const itemRecord = asRecord(item);
      return (
        typeof itemRecord?.id === "string" &&
        itemRecord.id.startsWith(COLD_EQUIPMENT_FIXTURE_ID_PREFIX) &&
        !itemRecord.sourceEquipmentId
      );
    });
    if (fixtureItems.length > 0) {
      const withReadings = fixtureItems.filter((item) =>
        context.equipmentIdsWithReadings?.has(String(asRecord(item)?.id))
      );
      if (withReadings.length > 0) {
        findings.push(
          `стоковые холодильники: ${fixtureItems.length}, по ${withReadings.length} есть показания — оставлены`
        );
      } else {
        findings.push(`стоковые холодильники: ${fixtureItems.length}`);
        const realItems = items.filter((item) => !fixtureItems.includes(item));
        const existingSources = new Set(
          realItems
            .map((item) => asRecord(item)?.sourceEquipmentId)
            .filter((id): id is string => typeof id === "string")
        );
        const fromDirectory = (context.orgColdEquipment ?? [])
          .filter((equipment) => !existingSources.has(equipment.sourceEquipmentId))
          .map((equipment) =>
            createColdEquipmentConfigItem({
              sourceEquipmentId: equipment.sourceEquipmentId,
              name: equipment.name,
              min: equipment.min,
              max: equipment.max,
            })
          );
        next.equipment = [...realItems, ...fromDirectory];
        changed = true;
      }
    }
  }

  if (templateCode === "finished_product" && Array.isArray(record.rows)) {
    // Пустая строка по умолчанию, в которую дефолт вписал первых двух
    // сотрудников по алфавиту: всё пусто, кроме имён.
    let stamped = 0;
    const rows = (record.rows as unknown[]).map((row) => {
      const rowRecord = asRecord(row);
      if (!rowRecord) return row;
      const hasNames =
        (typeof rowRecord.responsiblePerson === "string" && rowRecord.responsiblePerson.trim() !== "") ||
        (typeof rowRecord.inspectorName === "string" && rowRecord.inspectorName.trim() !== "");
      const contentKeys = [
        "productName",
        "productionDateTime",
        "rejectionTime",
        "organoleptic",
        "productTemp",
        "correctiveAction",
        "releasePermissionTime",
        "courierTransferTime",
        "oxygenLevel",
        "organolepticValue",
        "organolepticResult",
      ];
      const isEmpty = contentKeys.every(
        (key) => typeof rowRecord[key] !== "string" || (rowRecord[key] as string).trim() === ""
      );
      if (!hasNames || !isEmpty || rowRecord.sourceRowKey) return row;
      stamped += 1;
      return { ...rowRecord, responsiblePerson: "", inspectorName: "" };
    });
    if (stamped > 0) {
      findings.push(`пустых строк с вписанными именами: ${stamped}`);
      next.rows = rows;
      changed = true;
    }
  }

  return { findings, config: changed ? next : null };
}
