/**
 * Автоматизация журналов: «автосоздание документов + ежедневное
 * автозаполнение».
 *
 * Почему отдельный helper. Раньше автосоздание жило в плоском списке
 * `Organization.autoJournalCodes`, а автозаполнение — в поле каждого
 * ДОКУМЕНТА (`JournalDocument.autoFill`), которое управляющая включала
 * руками на каждом новом документе. В результате автосозданный документ
 * никогда не автозаполнялся: cron автосоздания ставил `autoFill:false`,
 * а cron автозаполнения смотрел только на `autoFill:true`.
 *
 * Теперь обе половинки лежат в одном месте — `Organization.journalAutomationJson`:
 *   { [journalCode]: { autoCreate: boolean, autoFill: boolean } }
 *
 * Одна галочка в UI пишет оба флага сразу; раздельные флаги оставлены
 * под будущий «продвинутый» режим (например, создавать документы, но
 * заполнять руками).
 */

export type JournalAutomation = {
  /** Cron 06:00 заводит документ на текущий период, если его нет. */
  autoCreate: boolean;
  /** Cron 06:00 заполняет сегодняшний день по графику сотрудников. */
  autoFill: boolean;
};

export type JournalAutomationMap = Record<string, JournalAutomation>;

/** Форма организации, которой достаточно для чтения настройки. */
export type JournalAutomationOrg = {
  journalAutomationJson?: unknown;
  autoJournalCodes?: unknown;
};

/**
 * Журналы, у которых автоматика включена «из коробки» у новых
 * организаций. Гигиенический и журнал здоровья — самые частые
 * ежедневные, и механика у них одна: строка на сотрудника × день.
 */
export const AUTOMATION_DEFAULT_ON_CODES = ["hygiene", "health_check"] as const;

/**
 * Журналы, которые автоматика вообще умеет обслуживать (для остальных
 * тумблер не показываем: у них нет поштучного «сегодняшнего дня»).
 */
export const AUTOMATION_SUPPORTED_CODES = ["hygiene", "health_check"] as const;

export function isAutomationSupported(code: string): boolean {
  return (AUTOMATION_SUPPORTED_CODES as readonly string[]).includes(code);
}

/** Включена ли автоматика по умолчанию для этого кода журнала. */
export function isAutomationDefaultOn(code: string): boolean {
  return (AUTOMATION_DEFAULT_ON_CODES as readonly string[]).includes(code);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Разбирает JSON-поле в типизированную карту, молча выкидывая мусор. */
export function parseJournalAutomationJson(value: unknown): JournalAutomationMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const map: JournalAutomationMap = {};
  for (const [code, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    map[code] = {
      autoCreate: row.autoCreate === true,
      autoFill: row.autoFill === true,
    };
  }
  return map;
}

/**
 * Настройка автоматики для журнала.
 *
 * Fallback обязателен: организации, настроившие автосоздание ДО
 * появления `journalAutomationJson`, держат список в `autoJournalCodes`.
 * Молча потерять его нельзя — иначе после деплоя у них перестанут
 * создаваться документы.
 */
export function getJournalAutomation(
  org: JournalAutomationOrg | null | undefined,
  code: string
): JournalAutomation {
  const map = parseJournalAutomationJson(org?.journalAutomationJson);
  const explicit = map[code];
  if (explicit) return explicit;
  return {
    autoCreate: toStringArray(org?.autoJournalCodes).includes(code),
    autoFill: false,
  };
}

/** Тумблер «одной галочкой»: журнал ведётся автоматикой целиком. */
export function isJournalAutomationEnabled(
  org: JournalAutomationOrg | null | undefined,
  code: string
): boolean {
  const value = getJournalAutomation(org, code);
  return value.autoCreate && value.autoFill;
}

/**
 * Чистое обновление карты. Возвращает НОВЫЙ объект — вызывающий сам
 * решает, писать его в БД или показать превью.
 */
export function withJournalAutomation(
  current: unknown,
  code: string,
  value: JournalAutomation
): JournalAutomationMap {
  const map = parseJournalAutomationJson(current);
  return { ...map, [code]: { autoCreate: value.autoCreate, autoFill: value.autoFill } };
}

/**
 * Дефолт новой организации. Гигиенический журнал ведётся сам с первого
 * дня — иначе новая компания месяц не подозревает, что автоматика есть.
 */
export function defaultJournalAutomationJson(): JournalAutomationMap {
  const map: JournalAutomationMap = {};
  for (const code of AUTOMATION_DEFAULT_ON_CODES) {
    map[code] = { autoCreate: true, autoFill: true };
  }
  return map;
}

/**
 * Все коды, которые нужно обслужить cron'у автоматизации: у кого
 * `autoCreate` включён явно ЛИБО через легаси-список.
 */
export function listAutomationCodes(
  org: JournalAutomationOrg | null | undefined
): { code: string; automation: JournalAutomation }[] {
  const map = parseJournalAutomationJson(org?.journalAutomationJson);
  const codes = new Set<string>([
    ...Object.keys(map),
    ...toStringArray(org?.autoJournalCodes),
  ]);
  return [...codes]
    .sort()
    .map((code) => ({ code, automation: getJournalAutomation(org, code) }))
    .filter((row) => row.automation.autoCreate || row.automation.autoFill);
}

/**
 * Коды, которые ежедневный cron автоматизации обслуживает ПОЛНОСТЬЮ.
 * Старые cron'ы (04:00 auto-create, 05:00 auto-fill) их пропускают,
 * чтобы не делать ту же работу дважды и не путать логи.
 */
export function listAutomationOwnedCodes(
  org: JournalAutomationOrg | null | undefined
): string[] {
  const map = parseJournalAutomationJson(org?.journalAutomationJson);
  return Object.entries(map)
    .filter(([, value]) => value.autoCreate && value.autoFill)
    .map(([code]) => code)
    .sort();
}

/** Человеческая подпись тумблера — один текст на UI, tooltip и гайд. */
export const AUTOMATION_TOGGLE_LABEL =
  "Автосоздание новых журналов и ежедневное автозаполнение";

export const AUTOMATION_TOGGLE_HINT =
  "Каждый день в 06:00 · все сотрудники без выходного — «Зд.», t < 37";

/** Буллеты модалки включения — они же в tooltip и в PageGuide журнала. */
export const AUTOMATION_ENABLE_BULLETS = [
  "Каждый день в 06:00 сайт создаст журнал на текущий период, если его нет, и добавит всех сотрудников, у кого не выходной.",
  "Каждому проставит «Здоров» и «температура ниже 37».",
  "Выходные, отпуска и больничные отметятся сами («В», «Отп», «Б/л»).",
  "Если у сотрудника температура, болезнь или отстранение — изменения вносятся день в день. Прошлые дни редактировать нельзя.",
] as const;
