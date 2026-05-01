/**
 * Phase D — per-org per-journal режимы раздачи и проверки задач.
 *
 * Каждая организация независимо настраивает каждый журнал в
 * /settings/journal-task-mode. Хранится в Organization.journalTaskModesJson
 * как карта { [code]: TaskMode }. Если код не задан — действует
 * `getDefaultTaskMode(code)` (sensible default по типу журнала).
 *
 * UI — отдельная страница со списком журналов и dropdown'ами на каждый.
 *
 * Семантика TaskDistributionMode (раздача задач сотрудникам):
 *
 *   • "per-employee" — каждому активному сотруднику, попадающему в
 *     должности-исполнители, создаётся отдельная задача. Дефолт для
 *     гигиены/здоровья (там row = user).
 *
 *   • "per-area" — на КАЖДОЕ помещение (Area) создаётся задача. Дефолт
 *     для уборки и сан.дня — там фактически N помещений × 1 задача.
 *     Адаптер выберет первого подходящего сотрудника-исполнителя
 *     (round-robin или старший по уборке) для каждого помещения.
 *
 *   • "per-batch" — на каждую партию приёма (входной контроль): одна
 *     задача на (поставщик + продукт + дата + lot). Дефолт для
 *     incoming_control / perishable_rejection.
 *
 *   • "per-shift" — одна задача на смену. Дефолт для бракеража смены,
 *     where shift = WorkShift.
 *
 *   • "by-rota" — по графику дежурств. Адаптер выбирает кто сегодня
 *     дежурный по этому журналу из WorkShift и создаёт ему 1 задачу.
 *     Полезно когда у журнала строгая ротация (например медкнижки —
 *     сегодня админ, завтра кадровик).
 *
 *   • "one-summary" — ОДНА задача-сводка на ВЕСЬ журнал, назначается
 *     primary-исполнителю. Самый простой режим, default для journal'ов
 *     где не нужно раздавать на N человек.
 *
 *   • "one-per-filler" — одна задача КАЖДОМУ из назначенных filler-
 *     слотов. Если filler'ов 3, создастся 3 задачи (тот же template,
 *     разные workerId). Полезно для аудит-комиссий.
 *
 * Семантика TaskVerificationMode (как verifier проверяет):
 *
 *   • "summary-task" — одна сводная задача verifier'у когда ВСЕ
 *     filler-задачи выполнены. Verifier открывает специальный view
 *     документа в WeSetup и одобряет/отклоняет целиком ИЛИ помечает
 *     отдельные ячейки как rejected (см. Phase E).
 *
 *   • "per-cell" — на каждое заполнение от сотрудника верификатор
 *     получает отдельную задачу проверки. Полезно для критичных
 *     журналов (бракераж готовой продукции — каждое блюдо отдельно).
 *
 *   • "none" — без проверки. Заполнил → done.
 *
 * Доп. флаги:
 *   • siblingVisibility — показывать ли «Сделано Иваном» на
 *     siblings-задачах (Phase F). По умолчанию true для team-fan-out
 *     журналов, false для остальных.
 */

export const TASK_DISTRIBUTION_MODES = [
  "per-employee",
  "per-area",
  "per-batch",
  "per-shift",
  "by-rota",
  "one-summary",
  "one-per-filler",
  "rolling",
] as const;

export type TaskDistributionMode = (typeof TASK_DISTRIBUTION_MODES)[number];

export const TASK_VERIFICATION_MODES = [
  "summary-task",
  "per-cell",
  "none",
] as const;

export type TaskVerificationMode = (typeof TASK_VERIFICATION_MODES)[number];

export type TaskMode = {
  distribution: TaskDistributionMode;
  verification: TaskVerificationMode;
  /** Phase F: показывать ли уборщице 2/3 что «помещение А уже убрал
   *  Иван» рядом со своей задачей. Default зависит от distribution
   *  (team-режимы — true, personal — false). */
  siblingVisibility?: boolean;
};

/** Подписи для UI-dropdown'ов и tooltip'ов. */
export const DISTRIBUTION_LABELS: Record<TaskDistributionMode, string> = {
  "per-employee": "На каждого сотрудника",
  "per-area": "На каждое помещение",
  "per-batch": "На каждую партию приёма",
  "per-shift": "На каждую смену",
  "by-rota": "По графику дежурств",
  "one-summary": "Одна сводная задача",
  "one-per-filler": "По задаче каждому ответственному",
  rolling: "Цикл «пока не нажмёт Готово»",
};

export const DISTRIBUTION_HINTS: Record<TaskDistributionMode, string> = {
  "per-employee":
    "Каждый сотрудник получает свою задачу. Подходит для гигиены и медосмотра.",
  "per-area":
    "По одной задаче на каждое помещение из настроек цехов. Подходит для уборки и санитарного дня.",
  "per-batch":
    "По одной задаче на каждую партию приёма (поставщик + продукт + дата + лот). Пока работает как одна сводная — задача создаётся при заведении партии в журнале.",
  "per-shift":
    "Одна задача на каждую смену из графика. Подходит для бракеража смены.",
  "by-rota":
    "Дежурный по графику получает задачу — каждый день назначается новый ответственный.",
  "one-summary":
    "Одна задача-сводка primary-исполнителю. Самый простой режим, без размножения.",
  "one-per-filler":
    "Каждый назначенный исполнитель получает свою копию задачи (для комиссий).",
  rolling:
    "Сотрудник заполняет журнал столько раз, сколько нужно за смену. После каждой записи приходит новая задача автоматически — пока он не нажмёт «Готово на сегодня». Для бракеража готовых блюд (5-50 раз/смену), интенсивного охлаждения партий, проверки фритюра.",
};

export const VERIFICATION_LABELS: Record<TaskVerificationMode, string> = {
  "summary-task": "Сводная проверка журнала",
  "per-cell": "Проверка каждой ячейки отдельно",
  none: "Без проверки",
};

export const VERIFICATION_HINTS: Record<TaskVerificationMode, string> = {
  "summary-task":
    "Проверяющий получает одну задачу «Проверить журнал X» когда все исполнители заполнили. Может одобрить целиком или ткнуть в отдельные ячейки и отклонить с причиной.",
  "per-cell":
    "На каждое заполнение от сотрудника проверяющему создаётся отдельная задача. Подходит для критичных контролей (бракераж готовой продукции).",
  none: "Заполнил → готово, без двойной проверки.",
};

/** Дефолт для журнала по его коду. Возвращается когда у org нет
 *  override в journalTaskModesJson. */
export function getDefaultTaskMode(journalCode: string): TaskMode {
  // Personnel-журналы — заполняются заведующей/менеджером ОДНОЙ
  // сводной записью на всех сотрудников, не каждым по отдельности.
  // По СанПиН 2.3/2.4.3590-20 п. 2.22:
  //   • hygiene / health_check — утренний осмотр сотрудников проводит
  //     заведующая (или шеф-повар) — это её ответственность, а не
  //     каждого сотрудника. Один документ-список со всем составом.
  //   • ppe_issuance — товаровед/заведующая выдаёт СИЗ и записывает в
  //     реестр. Не каждый сотрудник.
  //   • staff_training — менеджер по обучению или шеф проводит инструктаж
  //     и расписывается в журнале за всех. Один документ.
  if (
    journalCode === "hygiene" ||
    journalCode === "health_check" ||
    journalCode === "ppe_issuance" ||
    journalCode === "staff_training"
  ) {
    return {
      distribution: "one-summary",
      verification: "summary-task",
      siblingVisibility: false,
    };
  }
  if (
    journalCode === "cleaning" ||
    journalCode === "general_cleaning" ||
    journalCode === "sanitary_day_checklist" ||
    journalCode === "equipment_cleaning" ||
    journalCode === "cleaning_ventilation_checklist"
  ) {
    return {
      distribution: "per-area",
      verification: "summary-task",
      siblingVisibility: true,
    };
  }
  if (
    journalCode === "incoming_control" ||
    journalCode === "perishable_rejection" ||
    journalCode === "metal_impurity"
  ) {
    return {
      distribution: "per-batch",
      verification: "summary-task",
      siblingVisibility: false,
    };
  }
  // Rolling по умолчанию для журналов где количество заполнений за
  // смену заранее неизвестно и зависит от количества готовых блюд /
  // партий охлаждения / включений фритюра. См. journal-specs.ts.
  if (
    journalCode === "finished_product" ||
    journalCode === "intensive_cooling" ||
    journalCode === "fryer_oil" ||
    journalCode === "disinfectant_usage"
  ) {
    return {
      distribution: "rolling",
      verification: "per-cell",
      siblingVisibility: false,
    };
  }
  if (journalCode === "product_writeoff") {
    return {
      distribution: "one-per-filler",
      verification: "per-cell",
      siblingVisibility: false,
    };
  }
  if (
    journalCode === "med_books" ||
    journalCode === "audit_plan" ||
    journalCode === "audit_protocol" ||
    journalCode === "audit_report" ||
    journalCode === "training_plan" ||
    journalCode === "traceability_test" ||
    journalCode === "glass_items_list"
  ) {
    return {
      distribution: "one-summary",
      verification: "none", // admin-сам-себе-проверяет
      siblingVisibility: false,
    };
  }
  // Default fallback — sensible для большинства неизвестных:
  return {
    distribution: "one-summary",
    verification: "summary-task",
    siblingVisibility: false,
  };
}

/** Парсер json-карты с защитой от мусора. */
export function parseTaskModesJson(
  raw: unknown,
): Record<string, Partial<TaskMode>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, Partial<TaskMode>> = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    const partial: Partial<TaskMode> = {};
    if (
      typeof v.distribution === "string" &&
      (TASK_DISTRIBUTION_MODES as readonly string[]).includes(v.distribution)
    ) {
      partial.distribution = v.distribution as TaskDistributionMode;
    }
    if (
      typeof v.verification === "string" &&
      (TASK_VERIFICATION_MODES as readonly string[]).includes(v.verification)
    ) {
      partial.verification = v.verification as TaskVerificationMode;
    }
    if (typeof v.siblingVisibility === "boolean") {
      partial.siblingVisibility = v.siblingVisibility;
    }
    out[code] = partial;
  }
  return out;
}

/** Get effective mode = override-from-org + dafault. */
export function getEffectiveTaskMode(
  journalCode: string,
  raw: unknown,
): TaskMode {
  const overrides = parseTaskModesJson(raw);
  const override = overrides[journalCode] ?? {};
  const def = getDefaultTaskMode(journalCode);
  return {
    distribution: override.distribution ?? def.distribution,
    verification: override.verification ?? def.verification,
    siblingVisibility:
      override.siblingVisibility ?? def.siblingVisibility ?? false,
  };
}
