/**
 * Каноничная классификация всех journal-template'ов по taskScope.
 * Используется как единственный источник истины при seed/migration —
 * application-код всегда читает live-значение из JournalTemplate.taskScope
 * (менеджер может override для своей организации).
 *
 * 4 паттерна заполнения:
 *
 * A. PERSONAL DAILY — каждый сотрудник 1 раз в день. taskScope=personal.
 *    Кнопка «Не требуется сегодня» отключена для критичных (health_check).
 *
 * B. PERSONAL SHIFT/SCHEDULE — один ответственный за документ, заполняет
 *    матрицу/расписание. taskScope=personal. allowNoEvents=true (если
 *    кафе закрыто — пропустить).
 *
 * C. SHARED EVENT-LOG — открытая очередь записей, доступна всем по роли.
 *    taskScope=shared. Может быть 0..N записей. allowNoEvents=true.
 *
 * D. PERSONAL SCHEDULE-CHECKPOINTS (climate, fryer_oil) — N task'ов в
 *    день для дежурного по расписанию. taskScope=personal.
 */

export type TaskScope = "personal" | "shared";

export interface TemplateScopeConfig {
  taskScope: TaskScope;
  allowNoEvents: boolean;
  /** Дополнительные причины поверх default-списка из schema. Пусто =
   *  использовать дефолты из default-значения колонки. */
  noEventsReasons?: string[];
  allowFreeTextReason?: boolean;
}

/**
 * Дефолтная классификация всех известных template-кодов.
 * Кода не из этого списка → personal, allowNoEvents=true (back-compat).
 */
export const TEMPLATE_SCOPE_DEFAULTS: Record<string, TemplateScopeConfig> = {
  // ============================================================
  // A. PERSONAL DAILY — лично сотруднику, 1 раз в день
  // ============================================================
  hygiene: {
    taskScope: "personal",
    allowNoEvents: true,
    noEventsReasons: ["Заведение закрыто", "Выходной/праздничный день"],
  },
  health_check: {
    // Здоровье — нельзя пропускать. Если сотрудник болеет — заполняет
    // соответствующий статус, но не «не требуется».
    taskScope: "personal",
    allowNoEvents: false,
  },

  // ============================================================
  // B. PERSONAL SHIFT — один ответственный заполняет за смену
  // ============================================================
  cleaning: { taskScope: "personal", allowNoEvents: true },
  general_cleaning: { taskScope: "personal", allowNoEvents: true },
  cleaning_ventilation_checklist: { taskScope: "personal", allowNoEvents: true },
  uv_lamp_runtime: { taskScope: "personal", allowNoEvents: true },
  sanitary_day_control: { taskScope: "personal", allowNoEvents: true },
  cold_equipment_control: { taskScope: "personal", allowNoEvents: true },
  pest_control: { taskScope: "personal", allowNoEvents: true },
  glass_items_list: { taskScope: "personal", allowNoEvents: true },
  glass_control: { taskScope: "personal", allowNoEvents: true },

  // ============================================================
  // C. SHARED EVENT-LOG — общая очередь записей на смену
  // ============================================================
  // Поставки — главный пример. Кладовщик/любой подходящий по роли
  // регает каждую поставку отдельно. Может быть 0, 1, 5 в день.
  acceptance: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: [
      "Поставок нет",
      "Заведение закрыто",
      "Поставщик не приехал",
    ],
  },
  incoming_control: { taskScope: "shared", allowNoEvents: true },
  incoming_raw_materials_control: { taskScope: "shared", allowNoEvents: true },

  // Производство и контроль продукции
  finished_product: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Заведение закрыто", "Производства не было"],
  },
  perishable_rejection: { taskScope: "shared", allowNoEvents: true },
  intensive_cooling: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Не было блюд для интенсивного охлаждения"],
  },
  fryer_oil: {
    // Замеры фритюра — могут быть несколько раз за смену.
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Фритюр не использовался"],
  },
  product_writeoff: { taskScope: "shared", allowNoEvents: true },
  metal_impurity: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Металлических примесей не выявлено"],
  },
  traceability: { taskScope: "shared", allowNoEvents: true },

  // Инциденты — обычно 0 в день
  accident_journal: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Несчастных случаев не было"],
  },
  complaint_register: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Жалоб не поступало"],
  },
  breakdown_history: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Поломок не было"],
  },

  // Регулярные но событийные процессы
  disinfectant_usage: { taskScope: "shared", allowNoEvents: true },
  staff_training: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Обучения не проводилось"],
  },
  ppe_issuance: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["СИЗ не выдавались"],
  },
  equipment_cleaning: { taskScope: "shared", allowNoEvents: true },
  equipment_calibration: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Поверки не было"],
  },
  equipment_maintenance: {
    taskScope: "shared",
    allowNoEvents: true,
    noEventsReasons: ["Обслуживания не было"],
  },

  // Аудиты (внутренние) — формально periodic, но de-facto event-driven
  audit_plan: { taskScope: "personal", allowNoEvents: true },
  audit_protocol: { taskScope: "shared", allowNoEvents: true },
  audit_report: { taskScope: "shared", allowNoEvents: true },
  training_plan: { taskScope: "personal", allowNoEvents: true },

  // ============================================================
  // D. PERSONAL SCHEDULE-CHECKPOINTS — N замеров в день по часам
  // ============================================================
  climate_control: {
    // Уже работает как N task-ов на день (employee × time). Оставляем
    // personal — каждая task = один контрольный замер для дежурного.
    taskScope: "personal",
    allowNoEvents: true,
    noEventsReasons: [
      "Кондиционер выключен",
      "Помещение временно не используется",
    ],
  },
};

export function getDefaultScopeForTemplate(code: string): TemplateScopeConfig {
  return (
    TEMPLATE_SCOPE_DEFAULTS[code] ?? {
      taskScope: "personal",
      allowNoEvents: true,
    }
  );
}
