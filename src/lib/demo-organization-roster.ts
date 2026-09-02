/**
 * Ростер демо-организации: люди, цеха с холодильниками и помещения для
 * журнала уборки. Чистые данные без Prisma — чтобы seeder читался как
 * сценарий, а тесты могли проверить ростер без БД.
 *
 * Принципы:
 *   • ФИО — как в реальном штатном расписании, а не «Тест Тестов».
 *   • Должности — только те, что есть в пресете сферы
 *     (`getOnboardingPreset(type).positions`), иначе сотрудник не
 *     получит доступа к журналам и выпадет из гигиенического ростера.
 *   • Команда разнородная: управляющий, технолог, повара, зал, уборщик,
 *     кладовщик — чтобы гигиенический журнал и ответственные выглядели
 *     как в живом заведении, а не «12 поваров».
 *   • Выходные по недельному правилу (0=Пн … 6=Вс) — в журналах
 *     появятся «В», а не сплошные «Зд.».
 */

export type DemoRole = "manager" | "head_chef" | "cook" | "waiter";

export type DemoPerson = {
  name: string;
  position: string;
  role: DemoRole;
  phone: string;
  /** 0=Пн … 6=Вс. */
  weeklyDaysOff: number[];
};

export type DemoEquipment = {
  name: string;
  type: "refrigerator" | "freezer";
  tempMin: number;
  tempMax: number;
};

export type DemoArea = { name: string; equipment: DemoEquipment[] };

export type DemoRoom = {
  name: string;
  kind: "kitchen" | "wash" | "storage" | "guest" | "bar" | "other";
  detergent: string;
  currentScope: string[];
  generalScope: string[];
  /** Битовая маска дней текущей уборки, bit0=Пн … bit6=Вс. */
  currentDays: number;
  /** Битовая маска дней генеральной уборки. */
  generalDays: number;
};

export type DemoRoster = {
  people: DemoPerson[];
  areas: DemoArea[];
  rooms: DemoRoom[];
  /** Блюда для журнала интенсивного охлаждения. */
  dishes: string[];
};

const EVERY_DAY = 127;
const WEEKDAYS = 0b0011111;
const SATURDAY = 1 << 5;
const FRIDAY = 1 << 4;

function person(
  name: string,
  position: string,
  role: DemoRole,
  phone: string,
  weeklyDaysOff: number[] = [5, 6]
): DemoPerson {
  return { name, position, role, phone, weeklyDaysOff };
}

const KITCHEN_ROOMS: DemoRoom[] = [
  {
    name: "Горячий цех",
    kind: "kitchen",
    detergent: "Ника-2, 0,5 %",
    currentScope: ["Столы и рабочие поверхности", "Плиты и вытяжка", "Пол"],
    generalScope: ["Стены и плитка", "Полки и стеллажи", "Вытяжной зонт изнутри"],
    currentDays: EVERY_DAY,
    generalDays: SATURDAY,
  },
  {
    name: "Холодный цех",
    kind: "kitchen",
    detergent: "Ника-2, 0,5 %",
    currentScope: ["Столы и разделочные доски", "Ручки холодильников", "Пол"],
    generalScope: ["Стены и плитка", "Холодильники изнутри", "Полки"],
    currentDays: EVERY_DAY,
    generalDays: SATURDAY,
  },
  {
    name: "Моечная",
    kind: "wash",
    detergent: "Абактерил-хлор, 0,1 %",
    currentScope: ["Мойки и краны", "Стеллажи для сушки", "Пол и сливы"],
    generalScope: ["Стены и плитка", "Посудомоечная машина изнутри"],
    currentDays: EVERY_DAY,
    generalDays: SATURDAY,
  },
  {
    name: "Склад сухих продуктов",
    kind: "storage",
    detergent: "Ника-2, 0,5 %",
    currentScope: ["Пол", "Полки нижнего яруса"],
    generalScope: ["Все стеллажи", "Стены", "Проверка сроков годности"],
    currentDays: WEEKDAYS,
    generalDays: FRIDAY,
  },
];

const HALL_ROOMS: DemoRoom[] = [
  {
    name: "Гостевой зал",
    kind: "guest",
    detergent: "Ника-2, 0,5 %",
    currentScope: ["Столы и стулья", "Пол", "Дверные ручки"],
    generalScope: ["Окна и подоконники", "Светильники", "Мебель мыльным раствором"],
    currentDays: EVERY_DAY,
    generalDays: SATURDAY,
  },
  {
    name: "Санузел для гостей",
    kind: "other",
    detergent: "Абактерил-хлор, 0,1 %",
    currentScope: ["Унитазы и раковины", "Пол", "Дозаторы и урны"],
    generalScope: ["Стены и плитка", "Вентиляционные решётки"],
    currentDays: EVERY_DAY,
    generalDays: SATURDAY,
  },
];

const RESTAURANT: DemoRoster = {
  people: [
    person("Соколова Ирина Владимировна", "Управляющий", "manager", "+7 916 204-18-35", [6]),
    person("Кузнецов Андрей Михайлович", "Шеф-повар", "head_chef", "+7 903 771-42-10", [0]),
    person("Морозова Елена Сергеевна", "Су-шеф", "head_chef", "+7 926 340-77-19", [1]),
    person("Волкова Наталья Петровна", "Технолог", "head_chef", "+7 915 618-90-24"),
    person("Лебедев Дмитрий Игоревич", "Повар горячего цеха", "cook", "+7 985 233-51-08", [2]),
    person("Новикова Ольга Александровна", "Повар холодного цеха", "cook", "+7 916 872-64-31", [3]),
    person("Павлов Максим Юрьевич", "Повар", "cook", "+7 977 415-29-60", [0, 1]),
    person("Фёдорова Анна Николаевна", "Официант", "waiter", "+7 925 106-38-72", [0]),
    person("Григорьев Артём Олегович", "Бармен", "waiter", "+7 903 588-14-93", [1]),
    person("Захарова Татьяна Ивановна", "Уборщик", "cook", "+7 916 447-25-81", [6]),
    person("Степанов Виктор Алексеевич", "Посудомойщик", "cook", "+7 926 731-09-46", [2]),
    person("Белова Светлана Геннадьевна", "Кладовщик", "cook", "+7 915 962-83-17"),
  ],
  areas: [
    {
      name: "Горячий цех",
      equipment: [
        { name: "Холодильник №1 (мясо, птица)", type: "refrigerator", tempMin: 0, tempMax: 4 },
        { name: "Морозильный ларь №1", type: "freezer", tempMin: -24, tempMax: -18 },
      ],
    },
    {
      name: "Холодный цех",
      equipment: [
        { name: "Холодильник №2 (молочная продукция)", type: "refrigerator", tempMin: 2, tempMax: 6 },
        { name: "Холодильник №3 (овощи, зелень)", type: "refrigerator", tempMin: 2, tempMax: 8 },
      ],
    },
    { name: "Моечная", equipment: [] },
    { name: "Склад сухих продуктов", equipment: [] },
  ],
  rooms: [...KITCHEN_ROOMS, ...HALL_ROOMS],
  dishes: [
    "Суп-пюре из тыквы",
    "Бефстроганов с грибами",
    "Куриное филе в сливочном соусе",
    "Рагу овощное",
    "Борщ с говядиной",
    "Плов с бараниной",
  ],
};

const BAKERY: DemoRoster = {
  people: [
    person("Соколова Ирина Владимировна", "Управляющий", "manager", "+7 916 204-18-35", [6]),
    person("Волкова Наталья Петровна", "Технолог", "head_chef", "+7 915 618-90-24"),
    person("Кузнецов Андрей Михайлович", "Пекарь", "cook", "+7 903 771-42-10", [0]),
    person("Новикова Ольга Александровна", "Пекарь", "cook", "+7 916 872-64-31", [3]),
    person("Павлов Максим Юрьевич", "Пекарь", "cook", "+7 977 415-29-60", [1, 2]),
    person("Захарова Татьяна Ивановна", "Уборщик", "cook", "+7 916 447-25-81", [6]),
  ],
  areas: [
    {
      name: "Пекарский цех",
      equipment: [
        { name: "Холодильник №1 (сырьё)", type: "refrigerator", tempMin: 2, tempMax: 6 },
        { name: "Морозильный ларь №1 (заготовки)", type: "freezer", tempMin: -24, tempMax: -18 },
      ],
    },
    { name: "Склад муки", equipment: [] },
  ],
  rooms: [
    { ...KITCHEN_ROOMS[0], name: "Пекарский цех" },
    { ...KITCHEN_ROOMS[3], name: "Склад муки" },
    KITCHEN_ROOMS[2],
    { ...HALL_ROOMS[0], name: "Торговый зал" },
  ],
  dishes: ["Пирожки с капустой", "Кулебяка с рыбой", "Расстегаи с мясом"],
};

const MEAT: DemoRoster = {
  people: [
    person("Соколова Ирина Владимировна", "Директор производства", "manager", "+7 916 204-18-35", [6]),
    person("Волкова Наталья Петровна", "Технолог", "head_chef", "+7 915 618-90-24"),
    person("Лебедев Дмитрий Игоревич", "Оператор линии", "cook", "+7 985 233-51-08", [2]),
    person("Павлов Максим Юрьевич", "Оператор линии", "cook", "+7 977 415-29-60", [0, 1]),
    person("Степанов Виктор Алексеевич", "Оператор линии", "cook", "+7 926 731-09-46", [3]),
    person("Белова Светлана Геннадьевна", "Кладовщик", "cook", "+7 915 962-83-17"),
    person("Захарова Татьяна Ивановна", "Уборщик", "cook", "+7 916 447-25-81", [6]),
  ],
  areas: [
    {
      name: "Сырьевой цех",
      equipment: [
        { name: "Камера охлаждения №1 (сырьё)", type: "refrigerator", tempMin: 0, tempMax: 4 },
        { name: "Камера заморозки №1", type: "freezer", tempMin: -24, tempMax: -18 },
      ],
    },
    {
      name: "Цех готовой продукции",
      equipment: [
        { name: "Камера охлаждения №2 (готовая продукция)", type: "refrigerator", tempMin: 0, tempMax: 6 },
      ],
    },
  ],
  rooms: [
    { ...KITCHEN_ROOMS[0], name: "Сырьевой цех" },
    { ...KITCHEN_ROOMS[1], name: "Цех готовой продукции" },
    KITCHEN_ROOMS[2],
    { ...KITCHEN_ROOMS[3], name: "Склад специй и упаковки" },
  ],
  dishes: ["Котлеты домашние", "Голубцы", "Фарш говяжий"],
};

const OTHER: DemoRoster = {
  people: [
    person("Соколова Ирина Владимировна", "Управляющий", "manager", "+7 916 204-18-35", [6]),
    person("Кузнецов Андрей Михайлович", "Сотрудник", "cook", "+7 903 771-42-10", [0]),
    person("Новикова Ольга Александровна", "Сотрудник", "cook", "+7 916 872-64-31", [3]),
    person("Фёдорова Анна Николаевна", "Сотрудник", "waiter", "+7 925 106-38-72", [1]),
    person("Захарова Татьяна Ивановна", "Уборщик", "cook", "+7 916 447-25-81", [6]),
  ],
  areas: [
    {
      name: "Производственная зона",
      equipment: [
        { name: "Холодильник №1", type: "refrigerator", tempMin: 2, tempMax: 6 },
        { name: "Морозильная камера №1", type: "freezer", tempMin: -24, tempMax: -18 },
      ],
    },
    { name: "Склад", equipment: [] },
  ],
  rooms: [
    { ...KITCHEN_ROOMS[0], name: "Производственная зона" },
    KITCHEN_ROOMS[2],
    { ...KITCHEN_ROOMS[3], name: "Склад" },
    HALL_ROOMS[0],
  ],
  dishes: ["Суп куриный", "Гуляш", "Рагу овощное"],
};

/** Ростер по типу пресета (`sphereToPreset()`): restaurant | bakery | meat | other. */
export function getDemoRoster(presetType: string): DemoRoster {
  switch (presetType) {
    case "bakery":
      return BAKERY;
    case "meat":
      return MEAT;
    case "restaurant":
      return RESTAURANT;
    default:
      return OTHER;
  }
}
