/**
 * Per-journal metadata + smart-preset rules. Каждый журнал ХАССП/СанПиН
 * имеет свой паттерн заполнения — некоторые ведутся всей бригадой
 * (уборка, гигиена сотрудников), некоторые — одним конкретным
 * человеком (бракераж готовой продукции, аудит). Этот файл описывает,
 * КТО на практике заполняет каждый журнал, и используется и на сервере
 * (apply-presets API), и в UI (подсказки на карточке журнала).
 *
 * Источники: реальная практика общепита по СП 2.3/2.4.3590-20,
 * ТР ТС 021/2011, методические рекомендации Роспотребнадзора по ХАССП.
 *
 * Структура:
 *   - `who`: одна фраза «кто заполняет» — показываем юзеру.
 *   - `keywords`: подстроки, по которым матчим имена должностей в орге.
 *     Lowercase. Если ни одна не подошла — журнал останется без
 *     назначения (не дефолтим в «всем»).
 *   - `mode`: подсказка про fillMode шаблона (per-employee / shared /
 *     single). UI показывает label вверху карточки.
 *   - `category`: для группировки в UI и в списке пресетов.
 */

export type ResponsibilityMode =
  | "per-employee" // строка-на-сотрудника (гигиена, здоровье, медкнижки)
  | "shared" // одна запись на смену, может заполнять любой из набора (уборка, климат)
  | "single"; // конкретный «ответственный» (шеф-повар на бракераж, директор на аварии)

export type JournalCategory =
  | "cleaning"
  | "temperature"
  | "intake"
  | "health"
  | "equipment"
  | "training"
  | "incidents"
  | "audit"
  | "production"
  | "other";

export type JournalResponsibilityMeta = {
  code: string;
  who: string;
  keywords: readonly string[];
  mode: ResponsibilityMode;
  category: JournalCategory;
  /**
   * `true` если на практике это «один назначенный человек» (а не «любой
   * из должности»). UI подсказывает выбрать конкретного сотрудника как
   * defaultAssignee, а не просто положить должность.
   */
  preferNamedPerson?: boolean;
};

/**
 * Универсальный набор «должностей-управленцев». Многие компании
 * именуют свои management-роли «Админ», «Заведующая», «Руководитель»,
 * «Начальник» — это синонимы для «Менеджер/Управляющий/Директор».
 * Используем общую константу чтобы умный пресет не лажал когда у org'и
 * нет конкретно «Менеджера», но есть «Админ» или «Заведующая».
 *
 * Подстроки lowercase. Включаем варианты словоформ через короткие
 * корни ("завед" покрывает "Заведующая/Заведующий/Заведующие/...").
 */
const MGMT_KEYWORDS = [
  "менеджер",
  "управляющ",
  "директор",
  "руководит",
  "началь",   // начальник, начальница
  "админ",    // админ, администратор
  "завед",    // заведующий, заведующая
  "владелец", // микро-кафе где владелец-же-управляющий
  "шеф",      // шеф/шеф-повар часто делает работу управленца
] as const;

/**
 * Per-journal exhaustive map. Если код добавлен в ACTIVE_JOURNAL_CATALOG,
 * добавляйте его и сюда — иначе UI «Умный пресет» для него не сработает.
 */
export const JOURNAL_RESPONSIBILITY_META: readonly JournalResponsibilityMeta[] = [
  // ═══ HEALTH & HYGIENE ═══
  {
    code: "hygiene",
    who: "Шеф-повар или дежурный заведующий перед сменой осматривает каждого сотрудника (чистая форма, отсутствие порезов, маникюр в норме) и ставит «допущен/не допущен».",
    keywords: ["повар", ...MGMT_KEYWORDS],
    mode: "per-employee",
    category: "health",
  },
  {
    code: "health_check",
    who: "То же что гигиенический журнал — ХАССП на практике объединяет «здоровье» и «гигиену» в одну ежедневную проверку.",
    keywords: ["повар", ...MGMT_KEYWORDS],
    mode: "per-employee",
    category: "health",
  },
  {
    code: "med_books",
    who: "Менеджер / отдел кадров ведёт реестр сроков годности медкнижек всех сотрудников.",
    keywords: ["кадр", ...MGMT_KEYWORDS],
    mode: "single",
    category: "health",
    preferNamedPerson: true,
  },

  // ═══ TEMPERATURE / CLIMATE ═══
  {
    code: "climate_control",
    who: "Дежурный повар или товаровед измеряет температуру и влажность в производственных и складских помещениях 2–3 раза в смену.",
    keywords: ["повар", "технолог", "товаровед", "кладов", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "temperature",
  },
  {
    code: "cold_equipment_control",
    who: "Дежурный повар утром и вечером записывает температуру каждой холодильной/морозильной камеры. На крупных кухнях — отдельный сотрудник на цех.",
    keywords: ["повар", "су-шеф", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "temperature",
  },
  {
    code: "intensive_cooling",
    who: "Повар, который готовит горячее блюдо, фиксирует время и температуру при охлаждении (CCP по ХАССП — критическая контрольная точка).",
    keywords: ["повар", "су-шеф", "технолог", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "temperature",
  },
  {
    code: "fryer_oil",
    who: "Повар горячего цеха ежедневно проверяет качество фритюрного жира (цвет, запах, тестер на полярные соединения) и записывает замену.",
    keywords: ["повар", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "temperature",
  },

  // ═══ CLEANING ═══
  {
    code: "cleaning",
    who: "Уборщица или клинер по итогам уборки помещения ставит подпись + указывает использованное средство.",
    keywords: ["уборщ", "клинер", "клининг", "санитар", "технич", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "cleaning",
  },
  {
    code: "general_cleaning",
    who: "Бригада уборки + менеджер. Раз в месяц генеральная уборка по графику, акт подписывают уборщицы и контролирует управляющий.",
    keywords: ["уборщ", "клинер", "клининг", "санитар", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "cleaning",
  },
  {
    code: "cleaning_ventilation_checklist",
    who: "Дежурный по смене (уборщица или повар) перед открытием/закрытием помещения проветривает и проверяет санитарное состояние по чек-листу.",
    keywords: ["уборщ", "клинер", "повар", "технич", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "cleaning",
  },
  {
    code: "uv_lamp_runtime",
    who: "Тот, кто включает/выключает бактерицидную лампу (обычно уборщица или дежурный повар) — фиксирует время старта и стопа.",
    keywords: ["уборщ", "клинер", "повар", "технич", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "cleaning",
  },
  {
    code: "disinfectant_usage",
    who: "Старшая уборщица или клининг-менеджер записывает приход/расход дезсредств и концентрации рабочих растворов.",
    keywords: ["уборщ", "клинер", "клининг", "технолог", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "cleaning",
  },
  {
    code: "sanitary_day_control",
    who: "Бригада уборки делает санитарный день раз в месяц по чек-листу, контролирует менеджер.",
    keywords: ["уборщ", "клинер", "санитар", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "cleaning",
  },
  {
    code: "equipment_cleaning",
    who: "Повар или уборщица после смены моет оборудование (миксер, слайсер, мясорубку), записывает дату и средство.",
    keywords: ["уборщ", "клинер", "повар", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "cleaning",
  },

  // ═══ INTAKE / RECEIVING ═══
  {
    code: "incoming_control",
    who: "Товаровед или зав.складом принимает поставку, сверяет с накладной, проверяет температурный режим, целостность упаковки.",
    keywords: ["товаровед", "кладов", "снабж", "приём", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "intake",
  },
  {
    code: "incoming_raw_materials_control",
    who: "То же что «приёмка» — слитый журнал входного контроля.",
    keywords: ["товаровед", "кладов", "снабж", "приём", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "intake",
  },
  {
    code: "perishable_rejection",
    who: "Шеф-повар или товаровед при приёмке отбраковывает скоропорт (мясо, рыбу, молочку) с истекшим сроком или признаками порчи.",
    keywords: ["повар", "товаровед", "технолог", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "intake",
  },
  {
    code: "metal_impurity",
    who: "Технолог / товаровед пропускает сырьё через металлодетектор или магнит-ловушку и записывает результат.",
    keywords: ["технолог", "товаровед", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "intake",
  },
  {
    code: "traceability_test",
    who: "Технолог или менеджер качества раз в квартал проводит учения по прослеживаемости — отслеживает партию по цепочке от поставщика до тарелки.",
    keywords: ["технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "intake",
    preferNamedPerson: true,
  },

  // ═══ PRODUCTION ═══
  {
    code: "finished_product",
    who: "Бракеражная комиссия (минимум 3 человека, обычно шеф-повар + су-шеф + менеджер) пробует и оценивает каждое блюдо перед выдачей. CCP по ХАССП.",
    keywords: ["повар", "технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "production",
    preferNamedPerson: true,
  },
  {
    code: "product_writeoff",
    who: "Акт забраковки: подписывают шеф-повар, товаровед и управляющий — комиссия из 3 человек.",
    keywords: ["повар", "товаровед", ...MGMT_KEYWORDS],
    mode: "single",
    category: "production",
    preferNamedPerson: true,
  },

  // ═══ EQUIPMENT ═══
  {
    code: "equipment_calibration",
    who: "Технолог или назначенный инженер ведёт график поверки термометров, весов, психрометров (раз в год обычно).",
    keywords: ["технолог", "инженер", "техник", "механик", ...MGMT_KEYWORDS],
    mode: "single",
    category: "equipment",
    preferNamedPerson: true,
  },
  {
    code: "equipment_maintenance",
    who: "Инженер или техник по графику делает ТО оборудования (печи, холодильники, посудомойки).",
    keywords: ["инженер", "техник", "механик", "слесар", ...MGMT_KEYWORDS],
    mode: "single",
    category: "equipment",
    preferNamedPerson: true,
  },
  {
    code: "breakdown_history",
    who: "Тот же инженер фиксирует поломки и проведённый ремонт по карточке оборудования.",
    keywords: ["инженер", "техник", "механик", "слесар", ...MGMT_KEYWORDS],
    mode: "single",
    category: "equipment",
    preferNamedPerson: true,
  },
  {
    code: "glass_items_list",
    who: "Менеджер один раз заводит перечень стеклянных и хрупких предметов (лампы, бокалы, графины).",
    keywords: ["технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "equipment",
    preferNamedPerson: true,
  },
  {
    code: "glass_control",
    who: "Дежурный по смене (повар или уборщица) проверяет целостность стеклянных предметов из перечня и фиксирует «всё цело» / «бой».",
    keywords: ["повар", "уборщ", "клинер", ...MGMT_KEYWORDS],
    mode: "shared",
    category: "equipment",
  },

  // ═══ TRAINING ═══
  {
    code: "training_plan",
    who: "Менеджер или технолог раз в год составляет план обучения и инструктажей для всех сотрудников.",
    keywords: ["технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "training",
    preferNamedPerson: true,
  },
  {
    code: "staff_training",
    who: "Менеджер ведёт журнал, сотрудник расписывается в прохождении инструктажа (вводный, первичный, повторный, внеплановый).",
    keywords: ["технолог", "кадр", ...MGMT_KEYWORDS],
    mode: "per-employee",
    category: "training",
  },
  {
    code: "ppe_issuance",
    who: "Товаровед или менеджер фиксирует выдачу СИЗ (перчатки, фартуки, маски) под подпись сотрудника.",
    keywords: ["товаровед", "кладов", ...MGMT_KEYWORDS],
    mode: "per-employee",
    category: "training",
  },

  // ═══ INCIDENTS ═══
  {
    code: "accident_journal",
    who: "Управляющий или директор регистрирует ЧП — пожар, травма, отравление, отключение электричества — и принятые меры.",
    keywords: [...MGMT_KEYWORDS],
    mode: "single",
    category: "incidents",
    preferNamedPerson: true,
  },
  {
    code: "complaint_register",
    who: "Менеджер зала или администратор записывает жалобы гостей и предпринятые действия.",
    keywords: [...MGMT_KEYWORDS],
    mode: "single",
    category: "incidents",
    preferNamedPerson: true,
  },
  {
    code: "pest_control",
    who: "Менеджер или директор отмечает визиты подрядчика (СЭС/договор на дезинсекцию) и собственные осмотры на наличие следов грызунов/насекомых.",
    keywords: ["технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "incidents",
    preferNamedPerson: true,
  },

  // ═══ AUDIT ═══
  {
    code: "audit_plan",
    who: "Технолог или менеджер качества составляет годовой план внутренних аудитов.",
    keywords: ["технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "audit",
    preferNamedPerson: true,
  },
  {
    code: "audit_protocol",
    who: "Аудитор (обычно технолог или внешний эксперт) фиксирует результаты проверок по чек-листу.",
    keywords: ["технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "audit",
    preferNamedPerson: true,
  },
  {
    code: "audit_report",
    who: "Тот же аудитор пишет отчёт по итогам аудита с CAPA (корректирующими действиями).",
    keywords: ["технолог", ...MGMT_KEYWORDS],
    mode: "single",
    category: "audit",
    preferNamedPerson: true,
  },
];

const META_BY_CODE = new Map<string, JournalResponsibilityMeta>(
  JOURNAL_RESPONSIBILITY_META.map((m) => [m.code, m])
);

export function getJournalResponsibilityMeta(
  code: string
): JournalResponsibilityMeta | null {
  return META_BY_CODE.get(code) ?? null;
}

export const CATEGORY_LABELS: Record<JournalCategory, string> = {
  cleaning: "Уборка и санитария",
  temperature: "Температура и холод",
  intake: "Приёмка и сырьё",
  health: "Гигиена сотрудников",
  equipment: "Оборудование",
  training: "Обучение и СИЗ",
  incidents: "Инциденты и ЧП",
  audit: "Аудиты и контроль",
  production: "Бракераж и выпуск",
  other: "Прочее",
};

export const MODE_LABELS: Record<ResponsibilityMode, string> = {
  "per-employee": "На каждого сотрудника",
  shared: "Общая запись на смену",
  single: "Один ответственный",
};

/**
 * Подобрать должности из орги под keywords конкретного журнала.
 * Возвращает ids подходящих должностей. Если ни одна не подошла —
 * пустой массив (на клиенте показываем подсказку «нет подходящих
 * должностей, заведите/переименуйте»).
 *
 * Защитный fallback: если матчей нет, но журнал имеет mode "single"
 * или включает management-keywords — берём любую management-должность
 * из org по MGMT_KEYWORDS. Это покрывает реальный случай: маленькая
 * компания с одной должностью «Админ»/«Заведующая», которая делает
 * всю управленческую работу. Раньше пресет ругался «нет подходящих
 * должностей», хотя «Админ» — это и есть «менеджер» в этой компании.
 */
export function matchPositionsForJournal(
  code: string,
  positions: ReadonlyArray<{ id: string; name: string }>
): string[] {
  const meta = getJournalResponsibilityMeta(code);
  if (!meta) return [];
  if (meta.keywords.length === 0) return positions.map((p) => p.id);
  const matched: string[] = [];
  for (const p of positions) {
    const lower = p.name.toLowerCase();
    if (meta.keywords.some((kw) => lower.includes(kw))) {
      matched.push(p.id);
    }
  }
  if (matched.length > 0) return matched;
  // Fallback: management-должность как универсальный ответственный.
  const mgmtFallback: string[] = [];
  for (const p of positions) {
    const lower = p.name.toLowerCase();
    if (MGMT_KEYWORDS.some((kw) => lower.includes(kw))) {
      mgmtFallback.push(p.id);
    }
  }
  return mgmtFallback;
}

/**
 * Применить умные пресеты для всех журналов из meta-каталога.
 * Возвращает Map<code, Set<positionId>> — что класть в БД.
 */
export function computePresetAssignments(
  positions: ReadonlyArray<{ id: string; name: string }>
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const meta of JOURNAL_RESPONSIBILITY_META) {
    const ids = matchPositionsForJournal(meta.code, positions);
    if (ids.length === 0) continue;
    result.set(meta.code, new Set(ids));
  }
  return result;
}

// Back-compat: старый API экспортировал RESPONSIBLE_PRESETS как массив.
// Оставляем алиас, генерируя группы из category — для UI который
// показывает «Применить уборку», «Применить температуру» и т.д.
export type ResponsiblePreset = {
  id: string;
  label: string;
  description: string;
  journalCodes: readonly string[];
  positionKeywords: readonly string[];
};
