/**
 * «Периодичность контроля» — редактируемый текст в бумажной шапке документа.
 *
 * Эталон (lk.haccp-online.ru) печатает под строкой «орг / СИСТЕМА ХАССП /
 * СТР. 1 ИЗ 1» отдельную строку «Периодичность контроля | <текст>».
 * Раньше у нас этот текст был захардкожен и только для гигиенического
 * журнала (`HYGIENE_REGISTER_PERIODICITY`). Теперь он:
 *
 *   • имеет дефолт на каждый из 13 обязательных журналов (см. ниже);
 *   • редактируется при создании документа и в «Настройках журнала»;
 *   • хранится в `JournalDocument.config.controlPeriodicity` (string).
 *
 * Обратная совместимость: у старых документов ключа в config нет —
 * `readControlPeriodicity()` возвращает дефолт шаблона, поэтому шапка
 * выглядит так же, как раньше, без миграции данных.
 *
 * Storage-контракт (единственное место правды):
 *   config.controlPeriodicity?: string   // "" ⇒ строку не показываем
 */

import { HYGIENE_REGISTER_PERIODICITY } from "@/lib/hygiene-document";

/** Ключ внутри `JournalDocument.config`. */
export const CONTROL_PERIODICITY_CONFIG_KEY = "controlPeriodicity";

/** Санитарный лимит — текст живёт в ячейке шапки, а не в поле «Примечание». */
export const CONTROL_PERIODICITY_MAX_LENGTH = 600;

/**
 * Дефолты по 13 обязательным журналам базового тарифа.
 * Ключ — `JournalTemplate.code`.
 */
export const DEFAULT_CONTROL_PERIODICITY: Record<string, string> = {
  hygiene: HYGIENE_REGISTER_PERIODICITY.join(" "),
  health_check:
    "Ежесменно перед началом смены — для всех сотрудников производства; при выходе после болезни — дополнительно.",
  climate_control:
    "Ежедневно, не менее двух раз в смену (в начале и в конце рабочего дня) — по каждому помещению.",
  cold_equipment_control:
    "Ежедневно, не менее двух раз в смену — по каждой единице холодильного оборудования.",
  cleaning:
    "Текущая уборка — ежедневно (ежесменно); генеральная уборка — не реже одного раза в месяц по графику.",
  general_cleaning:
    "Генеральная уборка — не реже одного раза в месяц по утверждённому графику.",
  cleaning_ventilation_checklist:
    "Очистка систем вентиляции и кондиционирования — по графику, но не реже одного раза в год; проверка состояния — ежемесячно.",
  uv_lamp_runtime:
    "При каждом включении бактерицидной установки — с фиксацией времени наработки ламп.",
  finished_product:
    "Перед каждой раздачей (реализацией) партии готовой продукции — бракеражной комиссией.",
  perishable_rejection:
    "Ежедневно — при поступлении и перед реализацией каждой партии скоропортящейся продукции.",
  incoming_control:
    "При каждой приёмке партии продовольственного сырья и пищевых продуктов.",
  fryer_oil:
    "Ежедневно — перед началом и по окончании использования фритюрного жира.",
  med_books:
    "При приёме на работу и далее по срокам периодических медицинских осмотров, установленным приказом Минздрава № 29н.",
};

/** Если шаблона нет в таблице — общий нейтральный текст. */
export const FALLBACK_CONTROL_PERIODICITY =
  "Ежесменно, перед началом работы.";

/** Дефолтный текст периодичности для шаблона журнала. */
export function getDefaultControlPeriodicity(
  templateCode?: string | null
): string {
  if (!templateCode) return FALLBACK_CONTROL_PERIODICITY;
  return DEFAULT_CONTROL_PERIODICITY[templateCode] ?? FALLBACK_CONTROL_PERIODICITY;
}

/** Обрезка/нормализация пользовательского ввода перед сохранением. */
export function sanitizeControlPeriodicity(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, CONTROL_PERIODICITY_MAX_LENGTH);
}

/**
 * Чтение периодичности из сохранённого config документа.
 *
 * Back-compat: ключа нет (старые документы) → дефолт шаблона.
 * Ключ есть, но пустая строка → пустая строка (владелец сознательно убрал
 * строку из шапки), поэтому «нет ключа» и «пустая строка» различаются.
 */
export function readControlPeriodicity(
  config: unknown,
  templateCode?: string | null
): string {
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const raw = (config as Record<string, unknown>)[CONTROL_PERIODICITY_CONFIG_KEY];
    if (typeof raw === "string") return raw.trim().slice(0, CONTROL_PERIODICITY_MAX_LENGTH);
  }
  return getDefaultControlPeriodicity(templateCode);
}
