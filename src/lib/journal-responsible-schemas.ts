/**
 * Per-journal схема «слотов ответственных». Разные журналы требуют
 * разное количество и разные роли:
 *   - Большинство — 1 слот (главный ответственный).
 *   - Бракераж готовой продукции / Акт забраковки — 3 слота (комиссия).
 *   - Уборка / Генеральная уборка — 2 слота (старший + контролёр).
 *
 * UI на /settings/journal-responsibles рендерит N полей выбора
 * сотрудника по этой схеме — чтобы админ не выбирал «одного» там,
 * где журналу нужно трое.
 *
 * Сохраняется в Organization.journalResponsibleUsersJson:
 *   { [journalCode]: { [slotId]: userId } }
 *
 * Каскадно: первый (или slot.primary=true) попадает в
 * JournalDocument.responsibleUserId. Остальные — в config.responsibles.
 */

export type ResponsibleSlot = {
  id: string;
  label: string;
  /** Подсказка под лейблом — кратко роль слота. */
  hint?: string;
  /** Этот слот идёт в JournalDocument.responsibleUserId (по умолчанию — первый). */
  primary?: boolean;
  /** Override journal-level keywords для фильтра должностей этого слота. */
  positionKeywords?: readonly string[];
};

export type JournalResponsibleSchema = {
  code: string;
  slots: readonly ResponsibleSlot[];
};

const DEFAULT_SLOTS: readonly ResponsibleSlot[] = [
  {
    id: "main",
    label: "Главный ответственный",
    hint: "Идёт в шапку документа и в TasksFlow-задачи",
    primary: true,
  },
];

/**
 * Журналы с нестандартной структурой ответственных.
 * Для journals не из этой карты — DEFAULT_SLOTS (1 слот).
 */
const SCHEMA_OVERRIDES: Record<string, readonly ResponsibleSlot[]> = {
  // ═══ КОМИССИИ ИЗ 3 ЧЕЛОВЕК ═══
  finished_product: [
    {
      id: "chef",
      label: "Председатель — шеф-повар",
      hint: "Главный по бракеражу, обычно шеф или су-шеф",
      primary: true,
      positionKeywords: ["шеф", "су-шеф"],
    },
    {
      id: "member1",
      label: "Член комиссии — повар",
      hint: "Второй дегустатор",
      positionKeywords: ["повар", "технолог"],
    },
    {
      id: "member2",
      label: "Член комиссии — администрация",
      hint: "Менеджер или администратор",
      positionKeywords: ["менеджер", "управляющ", "администратор"],
    },
  ],
  product_writeoff: [
    {
      id: "chef",
      label: "Шеф-повар",
      hint: "Подтверждает технологическое решение",
      primary: true,
      positionKeywords: ["шеф", "повар"],
    },
    {
      id: "storekeeper",
      label: "Товаровед / кладовщик",
      hint: "Подтверждает остатки и документацию",
      positionKeywords: ["товаровед", "кладов", "снабж"],
    },
    {
      id: "manager",
      label: "Управляющий",
      hint: "Финансово-распорядительная подпись",
      positionKeywords: ["менеджер", "управляющ", "директор"],
    },
  ],

  // ═══ ПАРЫ «ИСПОЛНИТЕЛЬ + КОНТРОЛЁР» ═══
  cleaning: [
    {
      id: "supervisor",
      label: "Старший по уборке",
      hint: "Кто отвечает за факт проведения",
      primary: true,
      positionKeywords: ["уборщ", "клинер", "старш"],
    },
    {
      id: "controller",
      label: "Контролёр",
      hint: "Кто принимает результат — менеджер или технолог",
      positionKeywords: ["менеджер", "управляющ", "технолог"],
    },
  ],
  general_cleaning: [
    {
      id: "supervisor",
      label: "Старший бригады",
      hint: "Возглавляет генеральную уборку",
      primary: true,
      positionKeywords: ["уборщ", "клинер", "старш"],
    },
    {
      id: "manager",
      label: "Контроль (менеджер)",
      hint: "Подписывает акт",
      positionKeywords: ["менеджер", "управляющ"],
    },
  ],
  cleaning_ventilation_checklist: [
    {
      id: "main",
      label: "Дежурный по смене",
      hint: "Открывает и закрывает помещение",
      primary: true,
    },
  ],

  // ═══ ОДИНОЧНЫЕ С УТОЧНЁННЫМИ KEYWORDS ═══
  hygiene: [
    {
      id: "main",
      label: "Кто проводит осмотр",
      hint: "Шеф / заведующая утром перед сменой",
      primary: true,
      positionKeywords: ["шеф", "заведующ", "управляющ", "менеджер"],
    },
  ],
  health_check: [
    {
      id: "main",
      label: "Кто проводит осмотр",
      hint: "То же лицо что и для гигиенического — на практике слиты",
      primary: true,
      positionKeywords: ["шеф", "заведующ", "управляющ", "менеджер"],
    },
  ],
  med_books: [
    {
      id: "main",
      label: "Ответственный за реестр",
      hint: "Менеджер / отдел кадров",
      primary: true,
      positionKeywords: ["менеджер", "управляющ", "директор", "кадр"],
    },
  ],
  finished_product_old_unused: [], // placeholder — не используется
  perishable_rejection: [
    {
      id: "main",
      label: "Бракеровщик",
      hint: "Шеф-повар или товаровед — принимает скоропорт",
      primary: true,
      positionKeywords: ["шеф", "повар", "товаровед"],
    },
  ],
  incoming_control: [
    {
      id: "main",
      label: "Приёмщик",
      hint: "Товаровед / кладовщик",
      primary: true,
      positionKeywords: ["товаровед", "кладов", "снабж"],
    },
  ],
  incoming_raw_materials_control: [
    {
      id: "main",
      label: "Приёмщик",
      hint: "Товаровед / кладовщик",
      primary: true,
      positionKeywords: ["товаровед", "кладов", "снабж"],
    },
  ],
  metal_impurity: [
    {
      id: "main",
      label: "Технолог",
      hint: "Тот, кто пропускает сырьё через магнит/детектор",
      primary: true,
      positionKeywords: ["технолог", "товаровед"],
    },
  ],
  traceability_test: [
    {
      id: "main",
      label: "Аудитор прослеживаемости",
      hint: "Технолог или менеджер качества",
      primary: true,
      positionKeywords: ["технолог", "менеджер", "управляющ"],
    },
  ],
  equipment_calibration: [
    {
      id: "main",
      label: "Технолог по поверке",
      hint: "Ведёт график поверки термометров и весов",
      primary: true,
      positionKeywords: ["технолог", "инженер"],
    },
  ],
  equipment_maintenance: [
    {
      id: "main",
      label: "Инженер / техник",
      hint: "Делает ТО оборудования",
      primary: true,
      positionKeywords: ["инженер", "техник", "механик"],
    },
  ],
  breakdown_history: [
    {
      id: "main",
      label: "Инженер / техник",
      hint: "Фиксирует поломки и ремонты",
      primary: true,
      positionKeywords: ["инженер", "техник", "механик"],
    },
  ],
  glass_items_list: [
    {
      id: "main",
      label: "Менеджер",
      hint: "Заводит реестр стеклянных предметов",
      primary: true,
      positionKeywords: ["менеджер", "управляющ", "директор"],
    },
  ],
  training_plan: [
    {
      id: "main",
      label: "Ответственный за обучение",
      hint: "Менеджер / технолог — составляет план",
      primary: true,
      positionKeywords: ["менеджер", "управляющ", "технолог", "директор"],
    },
  ],
  staff_training: [
    {
      id: "main",
      label: "Проводит инструктажи",
      hint: "Менеджер по работе с персоналом",
      primary: true,
      positionKeywords: ["менеджер", "управляющ", "директор", "кадр"],
    },
  ],
  ppe_issuance: [
    {
      id: "main",
      label: "Выдаёт СИЗ",
      hint: "Товаровед или менеджер",
      primary: true,
      positionKeywords: ["товаровед", "кладов", "менеджер"],
    },
  ],
  accident_journal: [
    {
      id: "main",
      label: "Управляющий / директор",
      hint: "Регистрирует ЧП и принимает меры",
      primary: true,
      positionKeywords: ["менеджер", "управляющ", "директор"],
    },
  ],
  complaint_register: [
    {
      id: "main",
      label: "Администратор зала",
      hint: "Принимает жалобы от гостей",
      primary: true,
      positionKeywords: ["администратор", "менеджер", "управляющ"],
    },
  ],
  pest_control: [
    {
      id: "main",
      label: "Менеджер",
      hint: "Контактирует с подрядчиком СЭС",
      primary: true,
      positionKeywords: ["менеджер", "управляющ", "директор"],
    },
  ],
  audit_plan: [
    {
      id: "main",
      label: "Аудитор",
      hint: "Технолог или менеджер качества",
      primary: true,
      positionKeywords: ["технолог", "менеджер", "управляющ"],
    },
  ],
  audit_protocol: [
    {
      id: "main",
      label: "Аудитор",
      hint: "Тот же что и в плане",
      primary: true,
      positionKeywords: ["технолог", "менеджер", "управляющ"],
    },
  ],
  audit_report: [
    {
      id: "main",
      label: "Аудитор",
      hint: "Тот же что и в плане",
      primary: true,
      positionKeywords: ["технолог", "менеджер", "управляющ"],
    },
  ],
};

// Удаляем placeholder
delete (SCHEMA_OVERRIDES as Record<string, unknown>).finished_product_old_unused;

export function getSchemaForJournal(code: string): JournalResponsibleSchema {
  return {
    code,
    slots: SCHEMA_OVERRIDES[code] ?? DEFAULT_SLOTS,
  };
}

export function getPrimarySlotId(code: string): string {
  const schema = getSchemaForJournal(code);
  const primary = schema.slots.find((s) => s.primary);
  return (primary ?? schema.slots[0]).id;
}

export type ResponsibleAssignment = {
  /** Map slotId → userId. */
  users: Record<string, string | null>;
};
