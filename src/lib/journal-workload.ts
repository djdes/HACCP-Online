/**
 * Расчёт ежемесячной нагрузки сотрудников по журналам.
 *
 * Зачем: в маленькой команде без шеф-повара важно равномерно
 * распределить заполнение между поварами/уборщицами с одинаковой
 * зарплатой. Без расчёта менеджер ставит "вслепую" и кто-то
 * закономерно делает в 2 раза больше задач.
 *
 * Модель:
 *   weight_per_month(journal) =
 *       difficulty       (1..5, override per-org)
 *     × frequency_per_mo (хардкод по семантике журнала)
 *     × lines_per_entry  (хардкод; ~5 для per-equipment, ~10 для
 *                         per-employee, 1 для single)
 *
 *   user_share(journal, user) =
 *       1 / N_filler_slots   (если user в filler-слоте)
 *     | 0.3                  (если user в verifier-слоте — проверка
 *                              занимает ~30% времени заполнения)
 *     | 0                    (если не назначен)
 *
 *   user_load(user) = sum(weight_per_month(j) × user_share(j, u)) for j
 *
 * Все коэффициенты — эмпирические. Менеджер видит относительные
 * числа и может поправить difficulty чтобы сравнять нагрузку.
 */

import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import {
  getSchemaForJournal,
  VERIFIER_SLOT_ID,
} from "@/lib/journal-responsible-schemas";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Очень просто",
  2: "Просто",
  3: "Средне",
  4: "Сложно",
  5: "Очень сложно",
};

export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  1: "Одна отметка-галочка, ~10 секунд",
  2: "Одно-два поля + цифра, ~30 секунд",
  3: "Несколько полей + наблюдение, ~1-2 минуты",
  4: "Заполнение с обоснованием/комиссией, ~5 минут",
  5: "Аналитический документ / план / отчёт, ~15+ минут",
};

/**
 * Дефолтная сложность каждого журнала по семантике. Менеджер может
 * переопределить в /settings/journal-difficulty (Organization JSON).
 */
export const DEFAULT_DIFFICULTY: Record<string, Difficulty> = {
  // Уровень 1 — простая отметка-галочка
  hygiene: 1,
  health_check: 1,
  climate_control: 1,
  fryer_oil: 1,
  uv_lamp_runtime: 1,

  // Уровень 2 — стандартное заполнение с одним полем
  cold_equipment_control: 2,
  cleaning: 2,
  cleaning_ventilation_checklist: 2,
  glass_control: 2,

  // Уровень 3 — комбинированный (контроль + наблюдение)
  finished_product: 3,
  incoming_control: 3,
  incoming_raw_materials_control: 3,
  perishable_rejection: 3,
  intensive_cooling: 3,
  sanitary_day_control: 3,
  disinfectant_usage: 3,
  equipment_cleaning: 3,
  ppe_issuance: 3,

  // Уровень 4 — требует обоснования / комиссии
  general_cleaning: 4,
  product_writeoff: 4,
  equipment_maintenance: 4,
  breakdown_history: 4,
  accident_journal: 4,
  complaint_register: 4,
  traceability_test: 4,
  metal_impurity: 4,
  med_books: 4,
  glass_items_list: 4,
  pest_control: 4,

  // Уровень 5 — аналитический документ
  audit_plan: 5,
  audit_protocol: 5,
  audit_report: 5,
  training_plan: 5,
  staff_training: 5,
  equipment_calibration: 5,
};

/**
 * Сколько раз в месяц нужно делать заполнение. Эмпирические числа
 * по СанПиН и обычной практике общепита.
 */
export const FREQUENCY_PER_MONTH: Record<string, number> = {
  // Ежедневные / каждую смену
  hygiene: 30,
  health_check: 30,
  climate_control: 30,
  cold_equipment_control: 30,
  cleaning: 30,
  cleaning_ventilation_checklist: 30,
  fryer_oil: 30,
  finished_product: 30,
  perishable_rejection: 30,
  incoming_control: 22, // рабочие дни — ~5 в неделю
  incoming_raw_materials_control: 22,
  intensive_cooling: 30,
  uv_lamp_runtime: 30,

  // Еженедельные
  sanitary_day_control: 4,
  disinfectant_usage: 8, // 2 раза в неделю
  equipment_cleaning: 8,
  glass_control: 4,

  // Ежемесячные
  general_cleaning: 1,
  equipment_maintenance: 1,
  staff_training: 1,
  pest_control: 1,
  glass_items_list: 1, // обновление реестра

  // По событию — берём ~2 раза в месяц как базу
  product_writeoff: 2,
  breakdown_history: 2,
  accident_journal: 0.5, // редко (раз в 2 месяца)
  complaint_register: 2,
  metal_impurity: 2,
  traceability_test: 1, // раз в месяц по плану
  ppe_issuance: 2,
  med_books: 1, // отметка о продлении

  // Квартальные / годовые
  equipment_calibration: 0.33, // раз в 3 мес
  training_plan: 0.5, // раз в полгода
  audit_plan: 0.25, // раз в год
  audit_protocol: 1, // ежемесячный внутренний
  audit_report: 1,
};

/**
 * Сколько строк/единиц обычно заполняется за один документ. Для
 * температурных листов — холодильников, для гигиены — сотрудников и
 * т.д. Числа взяты для типичного кафе/столовой среднего размера.
 */
export const LINES_PER_ENTRY: Record<string, number> = {
  // По сотрудникам (~10 человек)
  hygiene: 10,
  health_check: 10,
  med_books: 10,
  ppe_issuance: 10,
  staff_training: 10,

  // По единицам оборудования
  cold_equipment_control: 5, // 5 холодильников/морозилок
  climate_control: 3, // 3 зоны
  uv_lamp_runtime: 2, // 2 УФ-лампы
  equipment_calibration: 5, // термометры, весы
  equipment_maintenance: 5,
  breakdown_history: 1,
  glass_control: 8,
  glass_items_list: 8,

  // По зонам
  cleaning: 5,
  cleaning_ventilation_checklist: 5,
  general_cleaning: 5,
  sanitary_day_control: 5,
  disinfectant_usage: 3,
  equipment_cleaning: 5,
  fryer_oil: 2,

  // По блюдам / партиям
  finished_product: 8, // 8 блюд бракеража
  perishable_rejection: 4,
  incoming_control: 6, // 6 поставок
  incoming_raw_materials_control: 6,
  intensive_cooling: 4,
  metal_impurity: 3,
  traceability_test: 1,

  // Single-document
  product_writeoff: 1,
  accident_journal: 1,
  complaint_register: 1,
  pest_control: 1,
  audit_plan: 1,
  audit_protocol: 1,
  audit_report: 1,
  training_plan: 1,
};

const DEFAULT_LINES = 1;

/** Verifier-share — сколько процентов от filler-нагрузки. */
const VERIFIER_SHARE = 0.3;

export function getDifficulty(
  code: string,
  override: Record<string, unknown> | null | undefined,
): Difficulty {
  const raw = override?.[code];
  if (typeof raw === "number" && raw >= 1 && raw <= 5) {
    return Math.round(raw) as Difficulty;
  }
  return DEFAULT_DIFFICULTY[code] ?? 2;
}

export function getFrequencyPerMonth(code: string): number {
  return FREQUENCY_PER_MONTH[code] ?? 1;
}

export function getLinesPerEntry(code: string): number {
  return LINES_PER_ENTRY[code] ?? DEFAULT_LINES;
}

/**
 * Месячный «вес» одного журнала. Вес — абстрактные единицы,
 * сравнивается между сотрудниками относительно. Не время в часах.
 */
export function getJournalMonthlyWeight(
  code: string,
  difficultyOverride: Record<string, unknown> | null | undefined,
): number {
  const d = getDifficulty(code, difficultyOverride);
  const f = getFrequencyPerMonth(code);
  const l = getLinesPerEntry(code);
  return d * f * l;
}

export type SlotUserMap = Record<string, string | null>;

/**
 * Для одного журнала — вернуть карту userId → доля нагрузки в этом
 * журнале (числа суммируются с verifier_share, могут быть >1 если
 * filler+verifier у одного человека).
 */
export function userSharesForJournal(
  code: string,
  slotUsers: SlotUserMap,
): Record<string, number> {
  const schema = getSchemaForJournal(code);
  const fillerSlots = schema.slots.filter((s) => s.kind !== "verifier");
  const verifierSlots = schema.slots.filter((s) => s.kind === "verifier");

  const fillerUsers: string[] = [];
  for (const slot of fillerSlots) {
    const uid = slotUsers[slot.id];
    if (uid) fillerUsers.push(uid);
  }
  const verifierUsers: string[] = [];
  for (const slot of verifierSlots) {
    const uid = slotUsers[slot.id];
    if (uid) verifierUsers.push(uid);
  }

  const result: Record<string, number> = {};
  if (fillerUsers.length > 0) {
    const share = 1 / fillerUsers.length;
    for (const uid of fillerUsers) {
      result[uid] = (result[uid] ?? 0) + share;
    }
  }
  for (const uid of verifierUsers) {
    result[uid] = (result[uid] ?? 0) + VERIFIER_SHARE;
  }
  return result;
}

export type UserWorkload = {
  userId: string;
  totalWeight: number;
  /** Журналы, в которых юзер участвует с долями. */
  journals: Array<{
    code: string;
    name: string;
    weight: number;
    role: "filler" | "verifier" | "both";
  }>;
};

/** Распределение нагрузки между сотрудниками за месяц. */
export function calculateUserWorkloads(input: {
  /** Map journalCode → SlotUserMap (как в Organization.journalResponsibleUsersJson). */
  slotUsersByJournal: Record<string, SlotUserMap>;
  /** Override сложности (Organization.journalDifficultyJson). */
  difficultyOverride: Record<string, unknown> | null | undefined;
  /** Список юзеров для построения полной карты (даже с нулевой нагрузкой). */
  userIds: string[];
}): Map<string, UserWorkload> {
  const result = new Map<string, UserWorkload>();
  for (const uid of input.userIds) {
    result.set(uid, { userId: uid, totalWeight: 0, journals: [] });
  }

  const codeToName = new Map<string, string>(
    ACTIVE_JOURNAL_CATALOG.map((j) => [j.code as string, j.name]),
  );

  for (const [code, slotUsers] of Object.entries(input.slotUsersByJournal)) {
    const journalWeight = getJournalMonthlyWeight(code, input.difficultyOverride);
    if (journalWeight === 0) continue;

    const schema = getSchemaForJournal(code);
    const fillerSlotIds = new Set(
      schema.slots.filter((s) => s.kind !== "verifier").map((s) => s.id),
    );
    const verifierSlotIds = new Set(
      schema.slots.filter((s) => s.kind === "verifier").map((s) => s.id),
    );

    const shares = userSharesForJournal(code, slotUsers);
    for (const [uid, share] of Object.entries(shares)) {
      const w = result.get(uid) ?? {
        userId: uid,
        totalWeight: 0,
        journals: [],
      };

      // Определяем роль user'а в этом журнале — он filler, verifier
      // или сразу оба.
      let isFiller = false;
      let isVerifier = false;
      for (const [slotId, suid] of Object.entries(slotUsers)) {
        if (suid !== uid) continue;
        if (fillerSlotIds.has(slotId)) isFiller = true;
        if (verifierSlotIds.has(slotId)) isVerifier = true;
      }
      const role: "filler" | "verifier" | "both" =
        isFiller && isVerifier
          ? "both"
          : isVerifier
            ? "verifier"
            : "filler";

      w.totalWeight += journalWeight * share;
      w.journals.push({
        code,
        name: codeToName.get(code) ?? code,
        weight: journalWeight * share,
        role,
      });
      result.set(uid, w);
    }
  }

  // Сортируем journals внутри каждого user'а по весу (тяжёлые первыми)
  for (const w of result.values()) {
    w.journals.sort((a, b) => b.weight - a.weight);
  }

  return result;
}

/**
 * Группировка нагрузки по должностям. Возвращает per-position суммарный
 * вес и метрики разбалансированности (max/min/avg между сотрудниками
 * одной должности).
 */
export type PositionWorkload = {
  positionId: string;
  positionName: string;
  userCount: number;
  totalWeight: number;
  /** Среднее на одного сотрудника. */
  avgPerUser: number;
  /** Минимальная нагрузка (samый недогруженный). */
  minPerUser: number;
  /** Максимальная (самый перегруженный). */
  maxPerUser: number;
  /** Имена самого недогруженного / перегруженного для подсказки. */
  minUserName: string | null;
  maxUserName: string | null;
  /** Коэф. неравномерности: (max - min) / avg. 0 = идеально, 1+ = плохо. */
  imbalance: number;
};

export function calculatePositionWorkloads(input: {
  userWorkloads: Map<string, UserWorkload>;
  /** Сотрудники с привязкой к должности. */
  users: Array<{
    id: string;
    name: string;
    jobPositionId: string | null;
  }>;
  positions: Array<{ id: string; name: string }>;
}): PositionWorkload[] {
  const positionsById = new Map(input.positions.map((p) => [p.id, p]));
  const byPosition = new Map<
    string,
    { name: string; users: Array<{ id: string; name: string; weight: number }> }
  >();

  for (const u of input.users) {
    if (!u.jobPositionId) continue;
    const pos = positionsById.get(u.jobPositionId);
    if (!pos) continue;
    const w = input.userWorkloads.get(u.id)?.totalWeight ?? 0;
    const bucket = byPosition.get(u.jobPositionId) ?? {
      name: pos.name,
      users: [],
    };
    bucket.users.push({ id: u.id, name: u.name, weight: w });
    byPosition.set(u.jobPositionId, bucket);
  }

  const result: PositionWorkload[] = [];
  for (const [positionId, bucket] of byPosition) {
    const weights = bucket.users.map((u) => u.weight);
    const total = weights.reduce((a, b) => a + b, 0);
    const avg = weights.length ? total / weights.length : 0;
    const min = weights.length ? Math.min(...weights) : 0;
    const max = weights.length ? Math.max(...weights) : 0;
    const minUser = bucket.users.find((u) => u.weight === min);
    const maxUser = bucket.users.find((u) => u.weight === max);
    const imbalance = avg > 0 ? (max - min) / avg : 0;
    result.push({
      positionId,
      positionName: bucket.name,
      userCount: bucket.users.length,
      totalWeight: total,
      avgPerUser: avg,
      minPerUser: min,
      maxPerUser: max,
      minUserName: bucket.users.length > 1 ? (minUser?.name ?? null) : null,
      maxUserName: bucket.users.length > 1 ? (maxUser?.name ?? null) : null,
      imbalance,
    });
  }

  // Сначала самые проблемные (большой imbalance) — менеджер видит
  // их сверху и может перебалансировать.
  result.sort((a, b) => b.imbalance - a.imbalance);
  return result;
}

export { VERIFIER_SLOT_ID };
