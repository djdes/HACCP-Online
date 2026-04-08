export const HYGIENE_STATUS_OPTIONS = [
  { value: "healthy", code: "Зд.", label: "Здоров" },
  { value: "day_off", code: "В", label: "Выходной / отгул" },
  { value: "sick_leave", code: "Б/л", label: "Больничный лист" },
  { value: "suspended", code: "От", label: "Отстранен от работы" },
  { value: "vacation", code: "Отп", label: "Отпуск" },
] as const;

export type HygieneStatus = (typeof HYGIENE_STATUS_OPTIONS)[number]["value"];

export type HygieneEntryData = {
  status?: HygieneStatus | null;
  temperatureAbove37?: boolean | null;
};

export const HYGIENE_REGISTER_PERIODICITY = [
  "Ежесменно перед началом смены – всех для сотрудников производства;",
  "для других сотрудников компании – при визите на производственный участок (однократно перед проходом на участок)",
];

export const HYGIENE_REGISTER_NOTES = [
  "осмотра и опроса сотрудников о состоянии здоровья (проявлениях респираторных и кишечных заболеваний и инфекций);",
  "опроса сотрудников об отсутствии заболеваний верхних дыхательных путей и гнойничковых заболеваний кожи рук и открытых поверхностей тела;",
  "опроса сотрудников о контактах с людьми, перенесшими желудочно-кишечные инфекции, с больными и вернувшимися из другой страны или субъекта РФ;",
  "осмотра рук и открытых частей тела сотрудников на наличие гнойничковых заболеваний и нарушений целостности кожного покрова.",
];

export const HYGIENE_REGISTER_LEGEND = [
  "Зд. — здоров",
  "В — выходной / отгул",
  "Б/л — больничный лист / отстранен от работы по причине болезни",
  "От — отстранен",
  "Отп — отпуск",
];

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export const HYGIENE_EXAMPLE_ORGANIZATION = 'ООО "Тест"';
export const HYGIENE_EXAMPLE_TITLE = "ГИГИЕНИЧЕСКИЙ ЖУРНАЛ";
export const HYGIENE_EXAMPLE_MONTH = "Апрель 2025 г.";
export const HYGIENE_EXAMPLE_DATE_FROM = "2025-04-01";
export const HYGIENE_EXAMPLE_DATE_TO = "2025-04-15";
export const HYGIENE_EXAMPLE_ROW_COUNT = 7;

export type HygieneRosterUser = {
  id: string;
  name: string;
  role: string;
};

export type HygieneExampleEmployee = {
  id: string;
  number: number;
  name: string | null;
  position: string | null;
};

export const HYGIENE_EXAMPLE_EMPLOYEES: HygieneExampleEmployee[] = Array.from(
  { length: HYGIENE_EXAMPLE_ROW_COUNT },
  (_, index) => ({
    id: `sample-${index + 1}`,
    number: index + 1,
    name: index === 0 ? "Иванов И.И." : null,
    position: index === 0 ? "Управляющий" : null,
  })
);

export type HygieneSampleDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  periodLabel: string;
};

export const HYGIENE_SAMPLE_DOCUMENTS: HygieneSampleDocument[] = [
  {
    id: "sample-active-1",
    title: "Гигиенический журнал",
    status: "active",
    responsibleTitle: "Управляющий",
    periodLabel: "Апрель с 1 по 15",
  },
  {
    id: "sample-closed-1",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Апрель с 16 по 30",
  },
  {
    id: "sample-closed-2",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Май с 1 по 15",
  },
  {
    id: "sample-closed-3",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Май с 16 по 31",
  },
  {
    id: "sample-closed-4",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Июнь с 1 по 15",
  },
  {
    id: "sample-closed-5",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Июнь с 16 по 30",
  },
  {
    id: "sample-closed-6",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Июль с 1 по 15",
  },
  {
    id: "sample-closed-7",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Июль с 16 по 31",
  },
  {
    id: "sample-closed-8",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Август с 1 по 15",
  },
  {
    id: "sample-closed-9",
    title: "Гигиенический журнал",
    status: "closed",
    responsibleTitle: null,
    periodLabel: "Август с 16 по 31",
  },
];

function getRoleOrder(role: string): number {
  switch (role) {
    case "owner":
      return 0;
    case "technologist":
      return 1;
    case "operator":
      return 2;
    default:
      return 3;
  }
}

export function getHygienePositionLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Управляющий";
    case "technologist":
      return "Шеф-повар";
    case "operator":
      return "Повар";
    default:
      return "Сотрудник";
  }
}

export function getHygieneDefaultResponsibleTitle(
  employees: HygieneRosterUser[]
): string {
  const owner = employees.find((employee) => employee.role === "owner");
  if (owner) return getHygienePositionLabel(owner.role);

  const technologist = employees.find(
    (employee) => employee.role === "technologist"
  );
  if (technologist) return getHygienePositionLabel(technologist.role);

  const firstEmployee = employees[0];
  return firstEmployee
    ? getHygienePositionLabel(firstEmployee.role)
    : "Управляющий";
}

export function buildHygieneExampleEmployees(
  employees: HygieneRosterUser[]
): HygieneExampleEmployee[] {
  const sortedEmployees = [...employees].sort((left, right) => {
    const roleDiff = getRoleOrder(left.role) - getRoleOrder(right.role);
    if (roleDiff !== 0) return roleDiff;
    return left.name.localeCompare(right.name, "ru");
  });

  const rows: HygieneExampleEmployee[] = sortedEmployees
    .slice(0, HYGIENE_EXAMPLE_ROW_COUNT)
    .map((employee, index) => ({
      id: employee.id,
      number: index + 1,
      name: employee.name,
      position: getHygienePositionLabel(employee.role),
    }));

  while (rows.length < HYGIENE_EXAMPLE_ROW_COUNT) {
    rows.push({
      id: `blank-${rows.length + 1}`,
      number: rows.length + 1,
      name: null,
      position: null,
    });
  }

  return rows;
}

export function coerceUtcDate(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  const parsed = new Date(value);
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
}

export function toDateKey(value: Date | string): string {
  const date = coerceUtcDate(value);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function fromDateKey(dateKey: string): Date {
  return coerceUtcDate(dateKey);
}

export function buildDateKeys(dateFrom: Date | string, dateTo: Date | string): string[] {
  const start = coerceUtcDate(dateFrom);
  const end = coerceUtcDate(dateTo);
  const dates: string[] = [];

  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dates.push(toDateKey(cursor));
  }

  return dates;
}

export function buildFixedHygieneExampleDateKeys(): string[] {
  return buildDateKeys(HYGIENE_EXAMPLE_DATE_FROM, HYGIENE_EXAMPLE_DATE_TO);
}

export function formatMonthLabel(dateFrom: Date | string, dateTo: Date | string): string {
  const start = coerceUtcDate(dateFrom);
  const end = coerceUtcDate(dateTo);

  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth()
  ) {
    return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()} г.`;
  }

  return `${toDateKey(start)} — ${toDateKey(end)}`;
}

export function getDayNumber(dateKey: string): number {
  return fromDateKey(dateKey).getUTCDate();
}

export function getWeekdayShort(dateKey: string): string {
  return WEEKDAY_SHORT[fromDateKey(dateKey).getUTCDay()] || "";
}

export function isWeekend(dateKey: string): boolean {
  const weekday = fromDateKey(dateKey).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: "Руководитель",
    technologist: "Технолог",
    operator: "Оператор",
  };

  return labels[role] || "Сотрудник";
}

export function getStatusMeta(status?: string | null) {
  return HYGIENE_STATUS_OPTIONS.find((option) => option.value === status) || null;
}

export function normalizeHygieneEntryData(data: unknown): HygieneEntryData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const record = data as Record<string, unknown>;
  const status =
    typeof record.status === "string" &&
    HYGIENE_STATUS_OPTIONS.some((option) => option.value === record.status)
      ? (record.status as HygieneStatus)
      : undefined;

  const temperatureAbove37 =
    typeof record.temperatureAbove37 === "boolean"
      ? record.temperatureAbove37
      : null;

  return {
    status,
    temperatureAbove37,
  };
}

type HygieneRowPattern = Array<{
  from: number;
  to: number;
  data: HygieneEntryData;
}>;

const HYGIENE_EXAMPLE_PATTERNS: HygieneRowPattern[] = [
  [
    { from: 1, to: 9, data: { status: "healthy", temperatureAbove37: false } },
    { from: 10, to: 11, data: { status: "day_off", temperatureAbove37: null } },
    { from: 12, to: 15, data: { status: "healthy", temperatureAbove37: false } },
  ],
  [
    { from: 1, to: 9, data: { status: "healthy", temperatureAbove37: false } },
    { from: 10, to: 10, data: { status: "day_off", temperatureAbove37: null } },
    { from: 11, to: 15, data: { status: "healthy", temperatureAbove37: false } },
  ],
  [
    { from: 1, to: 6, data: { status: "healthy", temperatureAbove37: false } },
    { from: 7, to: 8, data: { status: "day_off", temperatureAbove37: null } },
    { from: 9, to: 9, data: { status: "healthy", temperatureAbove37: false } },
    { from: 10, to: 11, data: { status: "day_off", temperatureAbove37: null } },
    { from: 12, to: 15, data: { status: "healthy", temperatureAbove37: false } },
  ],
  [
    { from: 1, to: 9, data: { status: "healthy", temperatureAbove37: false } },
    { from: 10, to: 11, data: { status: "day_off", temperatureAbove37: null } },
    { from: 12, to: 15, data: { status: "healthy", temperatureAbove37: false } },
  ],
  [
    { from: 1, to: 9, data: { status: "healthy", temperatureAbove37: false } },
    { from: 10, to: 11, data: { status: "day_off", temperatureAbove37: null } },
    { from: 12, to: 15, data: { status: "healthy", temperatureAbove37: false } },
  ],
  [
    { from: 1, to: 10, data: { status: "healthy", temperatureAbove37: false } },
    { from: 11, to: 11, data: { status: "day_off", temperatureAbove37: null } },
    { from: 12, to: 15, data: { status: "healthy", temperatureAbove37: false } },
  ],
  [
    { from: 1, to: 9, data: { status: "healthy", temperatureAbove37: false } },
    { from: 10, to: 11, data: { status: "day_off", temperatureAbove37: null } },
    { from: 12, to: 15, data: { status: "healthy", temperatureAbove37: false } },
  ],
];

export function buildExampleHygieneEntryMap(
  employeeIds: string[] = HYGIENE_EXAMPLE_EMPLOYEES.map((employee) => employee.id)
): Record<string, HygieneEntryData> {
  const dateKeys = buildFixedHygieneExampleDateKeys();
  const map: Record<string, HygieneEntryData> = {};

  function setEntry(
    employeeId: string,
    dayNumber: number,
    data: HygieneEntryData
  ) {
    const dateKey = dateKeys[dayNumber - 1];
    if (!dateKey) return;
    map[`${employeeId}:${dateKey}`] = data;
  }

  function fillRange(
    employeeId: string,
    from: number,
    to: number,
    data: HygieneEntryData
  ) {
    for (let day = from; day <= to; day += 1) {
      setEntry(employeeId, day, data);
    }
  }

  employeeIds.slice(0, HYGIENE_EXAMPLE_PATTERNS.length).forEach((employeeId, index) => {
    const pattern = HYGIENE_EXAMPLE_PATTERNS[index];
    if (!pattern) return;

    pattern.forEach((segment) => {
      fillRange(employeeId, segment.from, segment.to, segment.data);
    });
  });

  return map;
}
