// СанПиН 2.3/2.4.3590-20, ГОСТ Р 51705.1-2024, ТР ТС 021/2011
// Справочник нормативов для пищевых производств

export interface SanPinNorm {
  id: string;
  title: string;
  document: string;
  section: string;
  category: string;
  description: string;
  values?: string;
  penalty?: string;
}

export const SANPIN_NORMS: SanPinNorm[] = [
  // === ТЕМПЕРАТУРНЫЕ РЕЖИМЫ ===
  {
    id: "temp_fridge",
    title: "Температура в холодильных камерах",
    document: "СанПиН 2.3/2.4.3590-20, п. 3.5.1",
    section: "Температурный режим",
    category: "temperature",
    description: "Хранение скоропортящихся продуктов должно осуществляться при температуре +2...+6°C",
    values: "+2...+6°C",
  },
  {
    id: "temp_freezer",
    title: "Температура в морозильных камерах",
    document: "СанПиН 2.3/2.4.3590-20, п. 3.5.2",
    section: "Температурный режим",
    category: "temperature",
    description: "Хранение замороженных продуктов при температуре не выше -18°C",
    values: "≤ -18°C",
  },
  {
    id: "temp_hot_food",
    title: "Температура горячих блюд при раздаче",
    document: "СанПиН 2.3/2.4.3590-20, п. 8.7.2",
    section: "Температурный режим",
    category: "temperature",
    description: "Температура горячих блюд при раздаче должна быть не ниже +65°C",
    values: "≥ +65°C",
  },
  {
    id: "temp_cold_food",
    title: "Температура холодных блюд при раздаче",
    document: "СанПиН 2.3/2.4.3590-20, п. 8.7.2",
    section: "Температурный режим",
    category: "temperature",
    description: "Температура холодных блюд и закусок при раздаче не выше +15°C",
    values: "≤ +15°C",
  },
  {
    id: "temp_cooking_meat",
    title: "Температура в толще мясных изделий",
    document: "СанПиН 2.3/2.4.3590-20, п. 8.5",
    section: "Термическая обработка",
    category: "temperature",
    description: "Температура в толще мяса и мясных изделий при тепловой обработке должна быть не ниже +85°C",
    values: "≥ +85°C (в центре продукта)",
  },
  {
    id: "temp_cooking_poultry",
    title: "Температура в толще птицы",
    document: "СанПиН 2.3/2.4.3590-20, п. 8.5",
    section: "Термическая обработка",
    category: "temperature",
    description: "Температура в толще тушки птицы не ниже +85°C",
    values: "≥ +85°C (в центре)",
  },
  {
    id: "temp_pasteurization",
    title: "Пастеризация молока",
    document: "ТР ТС 033/2013, п. 36",
    section: "Термическая обработка",
    category: "temperature",
    description: "Пастеризация при +72...+76°C с выдержкой 15-20 секунд, или при +63°C — 30 минут",
    values: "+72...+76°C / 15-20 сек",
  },
  {
    id: "temp_transport",
    title: "Температура при транспортировке",
    document: "СанПиН 2.3/2.4.3590-20, п. 3.3",
    section: "Транспортировка",
    category: "temperature",
    description: "Скоропортящиеся продукты перевозятся охлаждаемым транспортом при +2...+6°C",
    values: "+2...+6°C",
  },

  // === СРОКИ ГОДНОСТИ ===
  {
    id: "shelf_salads",
    title: "Срок хранения салатов",
    document: "СанПиН 2.3/2.4.3590-20, Прил. 1",
    section: "Сроки годности",
    category: "shelf_life",
    description: "Салаты заправленные — не более 1 часа, незаправленные — не более 6 часов при +2...+6°C",
    values: "1 ч (заправленные) / 6 ч (незаправленные)",
  },
  {
    id: "shelf_cooked_meat",
    title: "Срок хранения готового мяса",
    document: "СанПиН 2.3/2.4.3590-20, Прил. 1",
    section: "Сроки годности",
    category: "shelf_life",
    description: "Мясо отварное, жареное — не более 24 часов при +2...+6°C",
    values: "24 ч при +2...+6°C",
  },
  {
    id: "shelf_dairy",
    title: "Срок хранения молочной продукции",
    document: "ТР ТС 033/2013",
    section: "Сроки годности",
    category: "shelf_life",
    description: "Пастеризованное молоко — до 10 суток, творог — до 72 часов при +2...+6°C",
    values: "Молоко 10 сут / Творог 72 ч",
  },

  // === ВХОДНОЙ КОНТРОЛЬ ===
  {
    id: "incoming_docs",
    title: "Документы при приёмке",
    document: "ТР ТС 021/2011, ст. 5",
    section: "Входной контроль",
    category: "incoming",
    description: "При приёмке продукции необходимо проверить: товарно-транспортную накладную, декларацию/сертификат соответствия, ветеринарное свидетельство (для продукции животного происхождения в ФГИС «Меркурий»)",
  },
  {
    id: "incoming_packaging",
    title: "Контроль упаковки",
    document: "СанПиН 2.3/2.4.3590-20, п. 3.2",
    section: "Входной контроль",
    category: "incoming",
    description: "Не допускается приёмка продукции с нарушенной упаковкой, без маркировки, с истёкшим сроком годности, при несоблюдении температурного режима",
  },
  {
    id: "incoming_temp_check",
    title: "Замер температуры при приёмке",
    document: "СанПиН 2.3/2.4.3590-20, п. 3.2.3",
    section: "Входной контроль",
    category: "incoming",
    description: "При приёмке скоропортящейся продукции обязателен замер температуры: мясо ≤ +4°C, рыба ≤ -18°C, молочная ≤ +6°C",
    values: "Мясо ≤+4°C, рыба ≤-18°C, молоко ≤+6°C",
  },

  // === ГИГИЕНА ПЕРСОНАЛА ===
  {
    id: "hygiene_medbook",
    title: "Личная медицинская книжка",
    document: "Приказ Минздрава РФ №29н от 28.01.2021",
    section: "Гигиена персонала",
    category: "hygiene",
    description: "Все работники пищевого производства обязаны иметь личную медицинскую книжку с отметками о прохождении медосмотра и гигиенического обучения",
  },
  {
    id: "hygiene_daily_check",
    title: "Ежедневный осмотр перед сменой",
    document: "СанПиН 2.3/2.4.3590-20, п. 2.3",
    section: "Гигиена персонала",
    category: "hygiene",
    description: "Перед началом работы — осмотр на наличие гнойничковых заболеваний кожи рук, ОРЗ, кишечных инфекций. Лица с признаками заболеваний к работе не допускаются",
  },
  {
    id: "hygiene_hands",
    title: "Мытьё рук",
    document: "СанПиН 2.3/2.4.3590-20, п. 2.5",
    section: "Гигиена персонала",
    category: "hygiene",
    description: "Мытьё рук обязательно: при входе в производственный цех, после посещения туалета, после работы с сырыми продуктами, при переходе от одной операции к другой",
  },

  // === УБОРКА И ДЕЗИНФЕКЦИЯ ===
  {
    id: "cleaning_routine",
    title: "Текущая уборка",
    document: "СанПиН 2.3/2.4.3590-20, п. 2.11",
    section: "Уборка и дезинфекция",
    category: "cleaning",
    description: "Текущая влажная уборка производственных помещений — не менее 2 раз в смену. Полы — по мере загрязнения, стены и оборудование — ежедневно",
  },
  {
    id: "cleaning_general",
    title: "Генеральная уборка",
    document: "СанПиН 2.3/2.4.3590-20, п. 2.12",
    section: "Уборка и дезинфекция",
    category: "cleaning",
    description: "Генеральная уборка всех помещений — не реже 1 раза в месяц с применением моющих и дезинфицирующих средств",
  },
  {
    id: "cleaning_equipment",
    title: "Санитарная обработка оборудования",
    document: "СанПиН 2.3/2.4.3590-20, п. 2.13",
    section: "Уборка и дезинфекция",
    category: "cleaning",
    description: "Производственное оборудование, инвентарь, тара подлежат мойке с применением моющих средств после каждой производственной операции",
  },

  // === ККТ / ХАССП ===
  {
    id: "haccp_plan",
    title: "Обязательность плана ХАССП",
    document: "ТР ТС 021/2011, ст. 10",
    section: "ХАССП",
    category: "haccp",
    description: "Все предприятия, осуществляющие производство пищевой продукции, обязаны разработать, внедрить и поддерживать процедуры, основанные на принципах ХАССП",
    penalty: "Штраф до 300 000 руб, приостановка деятельности до 90 суток (ст. 14.43 КоАП РФ)",
  },
  {
    id: "haccp_ccp",
    title: "Критические контрольные точки",
    document: "ГОСТ Р 51705.1-2024, п. 4.4",
    section: "ХАССП",
    category: "haccp",
    description: "ККТ — этап, на котором может быть применена мера контроля для предотвращения, устранения или снижения до приемлемого уровня опасного фактора безопасности пищевых продуктов",
  },
  {
    id: "haccp_monitoring",
    title: "Мониторинг ККТ",
    document: "ГОСТ Р 51705.1-2024, п. 4.5",
    section: "ХАССП",
    category: "haccp",
    description: "Для каждой ККТ должна быть установлена система мониторинга: что контролируется, как, кем, с какой периодичностью",
  },
  {
    id: "haccp_corrective",
    title: "Корректирующие действия",
    document: "ГОСТ Р 51705.1-2024, п. 4.6",
    section: "ХАССП",
    category: "haccp",
    description: "При отклонении от критических пределов необходимо: изолировать партию, определить дальнейшее назначение, выявить причину, провести повторный мониторинг",
  },

  // === ПОВЕРКА ОБОРУДОВАНИЯ ===
  {
    id: "calibration_frequency",
    title: "Периодичность поверки термометров",
    document: "Приказ Минпромторга №2386",
    section: "Поверка оборудования",
    category: "calibration",
    description: "Термометры жидкостные — 1 раз в год, электронные — 1 раз в 2 года. Весы — 1 раз в год",
    values: "Термометры: 1-2 года, Весы: 1 год",
  },

  // === ДЕЗИНСЕКЦИЯ / ДЕРАТИЗАЦИЯ ===
  {
    id: "pest_frequency",
    title: "Периодичность дезинсекции/дератизации",
    document: "СанПиН 3.5.2.3472-17",
    section: "Дезинсекция и дератизация",
    category: "pest_control",
    description: "Профилактическая дератизация — не реже 1 раза в месяц, дезинсекция — по мере необходимости, но не реже 1 раза в месяц в тёплое время года",
    values: "≥ 1 раз/мес",
  },

  // === СПИСАНИЕ ===
  {
    id: "writeoff_procedure",
    title: "Порядок списания",
    document: "СанПиН 2.3/2.4.3590-20, п. 3.8",
    section: "Списание продукции",
    category: "writeoff",
    description: "Продукция с истёкшим сроком годности или явными признаками порчи подлежит немедленному изъятию из оборота и утилизации. Списание оформляется актом с указанием причины и способа утилизации",
  },

  // === ЭЛЕКТРОННЫЕ ЖУРНАЛЫ ===
  {
    id: "electronic_journals",
    title: "Допустимость электронных журналов",
    document: "СанПиН 2.3/2.4.3590-20, изменения от 01.03.2025",
    section: "Документация",
    category: "general",
    description: "С 1 марта 2025 года официально разрешено ведение электронных журналов производственного контроля при условии обеспечения идентификации лица, вносящего записи, и невозможности несанкционированного изменения данных",
  },
];

// Подсказки для полей журналов
export interface FieldHint {
  fieldKey: string;
  templateCode: string;
  hint: string;
  norm?: string;
  warnBelow?: number;
  warnAbove?: number;
}

export const FIELD_HINTS: FieldHint[] = [
  // temp_control
  { fieldKey: "temperature", templateCode: "temp_control", hint: "Холодильник: +2...+6°C, Морозильник: ≤ -18°C. Замер термометром из центра камеры.", norm: "СанПиН 2.3/2.4.3590-20, п. 3.5" },

  // incoming_control
  { fieldKey: "productName", templateCode: "incoming_control", hint: "Указывайте полное наименование из накладной или маркировки", norm: "ТР ТС 021/2011, ст. 5" },
  { fieldKey: "supplier", templateCode: "incoming_control", hint: "Название организации-поставщика из товарно-транспортной накладной" },
  { fieldKey: "manufactureDate", templateCode: "incoming_control", hint: "Дата изготовления с маркировки. Проверьте читаемость!" },
  { fieldKey: "expiryDate", templateCode: "incoming_control", hint: "Срок годности с маркировки. Не принимайте продукцию, если до истечения срока осталось менее 1/3 от общего срока", norm: "СанПиН 2.3/2.4.3590-20, п. 3.2" },
  { fieldKey: "temperatureOnArrival", templateCode: "incoming_control", hint: "Мясо ≤ +4°C, рыба ≤ -18°C, молоко ≤ +6°C, овощи +2...+10°C", norm: "СанПиН 2.3/2.4.3590-20, п. 3.2.3" },
  { fieldKey: "packagingCondition", templateCode: "incoming_control", hint: "Повреждённая упаковка = основание для отказа в приёмке", norm: "СанПиН 2.3/2.4.3590-20, п. 3.2" },
  { fieldKey: "decision", templateCode: "incoming_control", hint: "Отклонить при: нарушенной упаковке, превышении температуры, отсутствии маркировки/документов, истёкшем сроке" },

  // finished_product
  { fieldKey: "appearance", templateCode: "finished_product", hint: "Оцените: цвет, форму, поверхность, наличие дефектов", norm: "ГОСТ 31986-2012" },
  { fieldKey: "taste", templateCode: "finished_product", hint: "Оцените вкус, послевкусие, наличие посторонних привкусов" },
  { fieldKey: "smell", templateCode: "finished_product", hint: "Оцените запах — должен быть характерным для данного продукта, без посторонних запахов" },
  { fieldKey: "consistency", templateCode: "finished_product", hint: "Оцените текстуру, однородность, плотность" },
  { fieldKey: "servingTemperature", templateCode: "finished_product", hint: "Горячие блюда ≥ +65°C, холодные ≤ +15°C", norm: "СанПиН 2.3/2.4.3590-20, п. 8.7.2", warnBelow: 65 },

  // hygiene
  { fieldKey: "noRespiratorySymptoms", templateCode: "hygiene", hint: "Проверить: кашель, насморк, боль в горле, повышенная температура", norm: "СанПиН 2.3/2.4.3590-20, п. 2.3" },
  { fieldKey: "noSkinDiseases", templateCode: "hygiene", hint: "Осмотреть руки, лицо на наличие гнойничковых заболеваний, порезов, ожогов", norm: "СанПиН 2.3/2.4.3590-20, п. 2.3" },
  { fieldKey: "noGastrointestinalIssues", templateCode: "hygiene", hint: "Опросить: боли в животе, диарея, рвота. При наличии — не допускать к работе" },
  { fieldKey: "cleanUniform", templateCode: "hygiene", hint: "Чистая спецодежда, головной убор, нескользящая обувь. Личные вещи в шкафчике" },

  // cleaning
  { fieldKey: "detergent", templateCode: "cleaning", hint: "Используйте только сертифицированные средства. Укажите название и производителя" },
  { fieldKey: "concentration", templateCode: "cleaning", hint: "Концентрация по инструкции к средству. Обычно 0.1-0.5% для текущей, 1-3% для генеральной" },
  { fieldKey: "exposureTime", templateCode: "cleaning", hint: "Время воздействия согласно инструкции. Обычно 15-30 минут для дезинфекции" },

  // cooking_temp
  { fieldKey: "targetTemp", templateCode: "cooking_temp", hint: "Мясо: +85°C, птица: +85°C, рыба: +80°C, овощи: +80°C", norm: "СанПиН 2.3/2.4.3590-20, п. 8.5" },
  { fieldKey: "actualTemp", templateCode: "cooking_temp", hint: "Замерьте фактическую температуру термощупом", norm: "СанПиН 2.3/2.4.3590-20, п. 8.5" },
  { fieldKey: "coreTemp", templateCode: "cooking_temp", hint: "Температура в толще (центре) продукта. Для мяса ≥ +85°C", norm: "СанПиН 2.3/2.4.3590-20, п. 8.5", warnBelow: 85 },
  { fieldKey: "duration", templateCode: "cooking_temp", hint: "Минимальное время: варка мяса — 1.5 ч, жарка — до готовности (не менее 10 мин порционно)" },

  // shipment
  { fieldKey: "vehicleTemp", templateCode: "shipment", hint: "Скоропортящиеся: +2...+6°C. Замороженные: ≤ -18°C", norm: "СанПиН 2.3/2.4.3590-20, п. 3.3" },
  { fieldKey: "vehicleCondition", templateCode: "shipment", hint: "Проверить: чистоту кузова, наличие санитарного паспорта, работу холодильной установки" },

  // equipment_calibration
  { fieldKey: "nextCalibrationDate", templateCode: "equipment_calibration", hint: "Термометры: 1-2 года, весы: 1 год. Просроченное оборудование — нельзя использовать!" },

  // ccp_monitoring
  { fieldKey: "criticalLimit", templateCode: "ccp_monitoring", hint: "Критический предел — максимально/минимально допустимое значение параметра, при котором обеспечивается безопасность", norm: "ГОСТ Р 51705.1-2024, п. 4.4" },
  { fieldKey: "correctiveAction", templateCode: "ccp_monitoring", hint: "При отклонении: 1) Изолировать партию 2) Определить причину 3) Устранить 4) Повторить контроль", norm: "ГОСТ Р 51705.1-2024, п. 4.6" },

  // product_writeoff
  { fieldKey: "reason", templateCode: "product_writeoff", hint: "Укажите точную причину. При нарушении температуры — приложите данные из журнала температурного режима" },
  { fieldKey: "disposalMethod", templateCode: "product_writeoff", hint: "Утилизация с оформлением акта. Возврат — при наличии договора. Переработка — только если допускается технологией", norm: "СанПиН 2.3/2.4.3590-20, п. 3.8" },
];

// Получить подсказку для конкретного поля и шаблона
export function getFieldHint(templateCode: string, fieldKey: string): FieldHint | undefined {
  return FIELD_HINTS.find((h) => h.templateCode === templateCode && h.fieldKey === fieldKey);
}

// Получить все нормы для категории
export function getNormsByCategory(category: string): SanPinNorm[] {
  return SANPIN_NORMS.filter((n) => n.category === category);
}

// Получить нормы, релевантные для шаблона журнала
export function getNormsForTemplate(templateCode: string): SanPinNorm[] {
  const categoryMap: Record<string, string[]> = {
    temp_control: ["temperature"],
    incoming_control: ["incoming", "shelf_life", "temperature"],
    finished_product: ["temperature", "shelf_life"],
    hygiene: ["hygiene"],
    ccp_monitoring: ["haccp"],
    cleaning: ["cleaning"],
    pest_control: ["pest_control"],
    equipment_calibration: ["calibration"],
    product_writeoff: ["writeoff", "shelf_life"],
    cooking_temp: ["temperature"],
    shipment: ["temperature"],
  };

  const categories = categoryMap[templateCode] || [];
  return SANPIN_NORMS.filter((n) => categories.includes(n.category));
}
