import { ALL_JOURNAL_CODES } from "@/lib/onboarding-presets";
import type { OrgSphere } from "@/lib/org-profile";

/**
 * Какие журналы нужны заведению в зависимости от сферы деятельности.
 *
 * Раньше новая организация получала все 35 журналов включёнными, и на
 * дашборде висело «0/35» — человек видел объём, который в реальности к
 * нему не относится, и не понимал, с чего начать. Отсюда одна таблица
 * правды: обязательный минимум по сфере включаем, рекомендованное
 * предлагаем, остальное прячем — включить можно в любой момент.
 *
 * Отдельная категория — журналы, которые по закону ведутся ТОЛЬКО на
 * бумаге с живой подписью инструктируемого (охрана труда, пожарная
 * безопасность). Электронная форма для них не принимается, поэтому в
 * набор журналов они не попадают: мы даём бланк для печати.
 *
 * ВНИМАНИЕ: содержимое таблицы — юридическое. Перед релизом сверяется
 * владельцем (СанПиН 2.3/2.4.3590-20, ТР ТС 021/2011, приказ Минтруда
 * 776н, ППР № 1479).
 */

export type LawRef = { label: string; url: string };

export type ElectronicRule = {
  /** Код JournalTemplate. */
  code: string;
  /**
   * Условие применимости — «при наличии фритюра». Такой журнал считается
   * обязательным, но выключается без предупреждения: у заведения может
   * просто не быть оборудования.
   */
  condition?: string;
};

export type PaperJournal = {
  id: string;
  name: string;
  /** Одна строка «за что штраф» — человеку нужно понимать цену вопроса. */
  why: string;
  law: LawRef;
  fineHint: string;
  /** Колонки бланка — из них строится PDF для печати. */
  columns: string[];
};

export type SphereRules = {
  sphere: OrgSphere;
  intro: string;
  introLaw: LawRef;
  electronicRequired: ElectronicRule[];
  electronicRecommended: string[];
  paperRequired: string[];
};

const KOAP_66: LawRef = {
  label: "ст. 6.6 КоАП РФ",
  url: "https://www.consultant.ru/document/cons_doc_LAW_34661/f6a3b4f04d0e2b1b0e2e3ec8bbbd0a9bd6ba5c0c/",
};

/**
 * Бумажные журналы. Электронная форма не принимается: инспектор смотрит
 * подпись инструктируемого от руки, поэтому наша задача — дать готовый
 * бланк с шапкой организации.
 */
export const PAPER_JOURNALS: PaperJournal[] = [
  {
    id: "ot_intro",
    name: "Журнал вводного инструктажа по охране труда",
    why: "Инспектор ГИТ проверяет его первым: без подписи работника инструктаж считается непроведённым.",
    law: {
      label: "ст. 5.27.1 КоАП РФ",
      url: "https://www.consultant.ru/document/cons_doc_LAW_34661/8f4b0b4c0e4b6f0cba0e7a7e0f22b7a7e33a3fef/",
    },
    fineHint: "до 130 000 ₽",
    columns: [
      "Дата",
      "ФИО инструктируемого",
      "Год рождения",
      "Профессия, должность",
      "ФИО инструктирующего",
      "Подпись инструктирующего",
      "Подпись инструктируемого",
    ],
  },
  {
    id: "ot_workplace",
    name: "Журнал инструктажа на рабочем месте",
    why: "Первичный, повторный и внеплановый инструктажи — тоже только с живой подписью.",
    law: {
      label: "ст. 5.27.1 КоАП РФ",
      url: "https://www.consultant.ru/document/cons_doc_LAW_34661/8f4b0b4c0e4b6f0cba0e7a7e0f22b7a7e33a3fef/",
    },
    fineHint: "до 130 000 ₽",
    columns: [
      "Дата",
      "ФИО инструктируемого",
      "Профессия, должность",
      "Вид инструктажа",
      "ФИО инструктирующего",
      "Подпись инструктирующего",
      "Подпись инструктируемого",
    ],
  },
  {
    id: "fire_safety",
    name: "Журнал инструктажа по пожарной безопасности",
    why: "Ведётся отдельно от охраны труда, проверяется при любой пожарной проверке.",
    law: {
      label: "ст. 20.4 КоАП РФ",
      url: "https://www.consultant.ru/document/cons_doc_LAW_34661/6a4e94a4a7f8b3b0b0d4e2e4b1a1f7e2b4a4d0e9/",
    },
    fineHint: "до 400 000 ₽",
    columns: [
      "Дата",
      "ФИО инструктируемого",
      "Должность",
      "Вид инструктажа",
      "ФИО инструктирующего",
      "Подпись инструктирующего",
      "Подпись инструктируемого",
    ],
  },
  {
    id: "fire_extinguishers",
    name: "Журнал учёта огнетушителей",
    why: "На каждый огнетушитель — своя строка с датой осмотра и перезарядки.",
    law: {
      label: "ППР № 1479, п. 60",
      url: "https://www.consultant.ru/document/cons_doc_LAW_361082/",
    },
    fineHint: "до 400 000 ₽",
    columns: [
      "Номер огнетушителя",
      "Тип, марка",
      "Дата ввода в эксплуатацию",
      "Место установки",
      "Дата осмотра",
      "Результат осмотра",
      "Дата перезарядки",
      "Подпись ответственного",
    ],
  },
  {
    id: "electrical_safety",
    name: "Журнал присвоения I группы по электробезопасности",
    why: "Нужен неэлектротехническому персоналу, который работает с электрооборудованием.",
    law: {
      label: "Приказ Минтруда № 903н, п. 2.3",
      url: "https://www.consultant.ru/document/cons_doc_LAW_371625/",
    },
    fineHint: "до 130 000 ₽",
    columns: [
      "Дата",
      "ФИО работника",
      "Должность",
      "Группа по электробезопасности",
      "ФИО проверяющего",
      "Подпись проверяющего",
      "Подпись работника",
    ],
  },
];

const PAPER_BASE = ["ot_intro", "ot_workplace", "fire_safety"];
const PAPER_FULL = [...PAPER_BASE, "fire_extinguishers"];

function intro(sphereLabel: string): string {
  return `Для сферы «${sphereLabel}» Роспотребнадзор требует минимальный базовый набор журналов. Их мы включили сразу — остальное вы решаете сами. За отсутствие обязательного журнала штрафуют по ст. 6.6 КоАП РФ: до 50 000 ₽ или приостановка деятельности до 90 суток.`;
}

export const SPHERE_RULES: Record<OrgSphere, SphereRules> = {
  restaurant: {
    sphere: "restaurant",
    intro: intro("Ресторан"),
    introLaw: KOAP_66,
    electronicRequired: [
      { code: "hygiene" },
      { code: "cold_equipment_control" },
      { code: "climate_control" },
      { code: "fryer_oil", condition: "нужен при наличии фритюра" },
    ],
    electronicRecommended: [
      "cleaning",
      "health_check",
      "finished_product",
      "perishable_rejection",
      "incoming_control",
      "med_books",
    ],
    paperRequired: PAPER_FULL,
  },
  cafe: {
    sphere: "cafe",
    intro: intro("Кафе / Бар / Столовая"),
    introLaw: KOAP_66,
    electronicRequired: [
      { code: "hygiene" },
      { code: "cold_equipment_control" },
      { code: "climate_control" },
    ],
    electronicRecommended: [
      "cleaning",
      "health_check",
      "perishable_rejection",
      "incoming_control",
    ],
    paperRequired: PAPER_BASE,
  },
  fastfood: {
    sphere: "fastfood",
    intro: intro("Фастфуд"),
    introLaw: KOAP_66,
    electronicRequired: [
      { code: "hygiene" },
      { code: "cold_equipment_control" },
      { code: "climate_control" },
      { code: "fryer_oil", condition: "нужен при наличии фритюра" },
      { code: "finished_product" },
      { code: "perishable_rejection" },
    ],
    electronicRecommended: [
      "cleaning",
      "health_check",
      "incoming_control",
      "disinfectant_usage",
      "uv_lamp_runtime",
    ],
    paperRequired: PAPER_FULL,
  },
  education: {
    sphere: "education",
    intro: intro("Школа / Детсад / Институт"),
    introLaw: KOAP_66,
    electronicRequired: [
      { code: "hygiene" },
      { code: "health_check" },
      { code: "cold_equipment_control" },
      { code: "climate_control" },
      { code: "finished_product" },
      { code: "perishable_rejection" },
      { code: "incoming_control" },
    ],
    electronicRecommended: [
      "cleaning",
      "general_cleaning",
      "med_books",
      "uv_lamp_runtime",
    ],
    paperRequired: PAPER_FULL,
  },
  bakery: {
    sphere: "bakery",
    intro: intro("Пекарня"),
    introLaw: KOAP_66,
    electronicRequired: [
      { code: "hygiene" },
      { code: "cold_equipment_control" },
      { code: "climate_control" },
      { code: "incoming_raw_materials_control" },
    ],
    electronicRecommended: [
      "cleaning",
      "health_check",
      "pest_control",
      "metal_impurity",
    ],
    paperRequired: PAPER_FULL,
  },
  production: {
    sphere: "production",
    intro: intro("Производство"),
    introLaw: KOAP_66,
    electronicRequired: [
      { code: "hygiene" },
      { code: "cold_equipment_control" },
      { code: "climate_control" },
      { code: "incoming_raw_materials_control" },
      { code: "traceability_test" },
      { code: "metal_impurity" },
      { code: "finished_product" },
    ],
    electronicRecommended: [
      "cleaning",
      "equipment_cleaning",
      "pest_control",
      "audit_plan",
    ],
    paperRequired: [...PAPER_FULL, "electrical_safety"],
  },
  other: {
    sphere: "other",
    intro: intro("Другое"),
    introLaw: KOAP_66,
    electronicRequired: [
      { code: "hygiene" },
      { code: "cold_equipment_control" },
      { code: "climate_control" },
    ],
    electronicRecommended: ["cleaning", "health_check"],
    paperRequired: PAPER_BASE,
  },
};

export function rulesFor(sphere: OrgSphere): SphereRules {
  return SPHERE_RULES[sphere] ?? SPHERE_RULES.other;
}

/** Коды журналов, которые должны быть включены у этой сферы. */
export function requiredCodesFor(sphere: OrgSphere): string[] {
  return rulesFor(sphere).electronicRequired.map((rule) => rule.code);
}

/**
 * Что записать в `Organization.disabledJournalCodes` для новой
 * организации: всё, кроме обязательного минимума. Хранилище негативное
 * («всё, кроме»), поэтому набор считается вычитанием.
 */
export function defaultDisabledCodesFor(sphere: OrgSphere): string[] {
  const required = new Set(requiredCodesFor(sphere));
  return ALL_JOURNAL_CODES.filter((code) => !required.has(code));
}

/** Бумажные журналы сферы — в том порядке, в каком они перечислены. */
export function paperJournalsFor(sphere: OrgSphere): PaperJournal[] {
  const ids = rulesFor(sphere).paperRequired;
  return ids
    .map((id) => PAPER_JOURNALS.find((journal) => journal.id === id))
    .filter((journal): journal is PaperJournal => Boolean(journal));
}

export function paperJournalById(id: string): PaperJournal | null {
  return PAPER_JOURNALS.find((journal) => journal.id === id) ?? null;
}
