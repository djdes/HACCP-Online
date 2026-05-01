/**
 * Правила определения «отклонения от нормы» для каждого журнала.
 * Используется в:
 *   • DynamicForm (client) — раскрыть условно-обязательные поля и
 *     показать жёлтый alert «Внимание, отклонение нормы».
 *   • api/journals/route.ts (server) — алерты в Telegram + строгая
 *     валидация (server-side trust ничего).
 *
 * Каждое правило — функция (data) → boolean. Возвращает true если данные
 * сигнализируют об отклонении. Тогда поля из spec.conditionalRequiredOnDeviation
 * становятся обязательными.
 */

export type DeviationCheck = (data: Record<string, unknown>) => boolean;

const RULES: Record<string, DeviationCheck> = {
  // Гигиена — не допущен к работе.
  hygiene: (d) => d.admitted === false || d.allowed === false,
  health_check: (d) => d.admitted === false || d.allowed === false,

  // Бракераж готовой продукции — не разрешён к выпуску или неудовл.
  finished_product: (d) => {
    if (d.approvedForRelease === false) return true;
    if (d.decision === "rejected" || d.decision === "rework") return true;
    const ratings = [d.appearance, d.taste, d.smell, d.consistency];
    return ratings.some((r) => r === "unsatisfactory");
  },

  // Скоропорт — забракован.
  perishable_rejection: (d) => {
    if (d.decision === "rejected" || d.decision === "return") return true;
    if (d.organolepticOk === false) return true;
    return false;
  },

  // Входной контроль — забракован.
  incoming_control: (d) =>
    d.result === "rejected" ||
    d.decision === "rejected" ||
    d.documentationOk === false,
  incoming_raw_materials_control: (d) =>
    d.result === "rejected" || d.documentationOk === false,

  // Металлопримеси — найдены.
  metal_impurity: (d) => d.foundImpurity === true || d.found === true,

  // Холодильник / климат — out of range.
  cold_equipment_control: (d) => d.normRespected === false || d.outOfRange === true,
  climate_control: (d) => d.normRespected === false || d.outOfRange === true,

  // Интенсивное охлаждение — норма не соблюдена.
  intensive_cooling: (d) => {
    if (d.normRespected === false) return true;
    // Также: длительность > 2ч (по СанПиН п. 4.4)
    if (typeof d.durationMinutes === "number" && d.durationMinutes > 120) {
      return true;
    }
    return false;
  },

  // Фритюр — нужна замена.
  fryer_oil: (d) => d.decision === "replace" || d.shouldReplace === true,

  // CCP мониторинг.
  ccp_monitoring: (d) => d.withinLimit === false,

  // Списание — всегда отклонение по определению.
  product_writeoff: () => true,

  // Аварии — всегда отклонение.
  accident_journal: () => true,

  // Жалобы — всегда отклонение.
  complaint_register: () => true,

  // Контроль стекла — нашли разбитое.
  glass_control: (d) => d.allInPlace === false || d.broken === true,
};

/**
 * Проверяет, есть ли в форме отклонение от нормы.
 * Если для журнала нет правила — возвращаем false (нет отклонения).
 */
export function isFormInDeviation(
  journalCode: string,
  data: Record<string, unknown>,
): boolean {
  const rule = RULES[journalCode];
  if (!rule) return false;
  try {
    return rule(data);
  } catch {
    return false;
  }
}

/**
 * Описание для UI: что именно сигнализирует об отклонении (для tooltip'а).
 */
export const DEVIATION_HINTS: Record<string, string> = {
  hygiene: "Сотрудник не допущен — обязательно опиши причину и принятые меры.",
  health_check: "Сотрудник не допущен — обязательно опиши причину и принятые меры.",
  finished_product:
    "Блюдо не прошло бракераж — обязательно опиши причину отклонения и решение.",
  perishable_rejection:
    "Партия забракована или не прошла осмотр — опиши причину.",
  incoming_control:
    "Партия забракована или документы не в порядке — опиши причину возврата.",
  incoming_raw_materials_control:
    "Партия забракована или документы не в порядке — опиши причину возврата.",
  metal_impurity: "Найдены металлопримеси — опиши что и какие меры приняты.",
  cold_equipment_control:
    "Температура вне нормы — опиши причину и какие меры приняты.",
  climate_control:
    "Температура/влажность вне нормы — опиши причину и принятые меры.",
  intensive_cooling:
    "Норма охлаждения не соблюдена — опиши причину и принятое решение.",
  fryer_oil: "Масло требует замены — опиши почему и когда заменили.",
  ccp_monitoring: "ККТ вне предела — критическое отклонение, опиши решение.",
  product_writeoff: "Списание — опиши причину и способ утилизации.",
  accident_journal: "ЧП — опиши обстоятельства и принятые меры.",
  complaint_register: "Жалоба — опиши решение и компенсацию.",
  glass_control:
    "Найдено разбитое — опиши что и предприми меры по поиску осколков.",
};

export function getDeviationHint(journalCode: string): string | null {
  return DEVIATION_HINTS[journalCode] ?? null;
}
