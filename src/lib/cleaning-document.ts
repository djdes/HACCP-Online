import { buildDateKeys, coerceUtcDate, formatMonthLabel, isWeekend, toDateKey } from "@/lib/hygiene-document";
import {
  getUserRoleLabel,
  pickPrimaryManager,
  pickPrimaryStaff,
} from "@/lib/user-roles";

export const CLEANING_DOCUMENT_TEMPLATE_CODE = "cleaning";
export const CLEANING_PAGE_TITLE = "Журнал уборки";
export const CLEANING_DOCUMENT_TITLE = CLEANING_PAGE_TITLE;

export type CleaningActivityType = "disinfection" | "ventilation" | "wetCleaning";

export type CleaningScheduleItem = {
  times: string[];
  responsibleUserId: string | null;
};

export type CleaningProcedure = {
  surfaces: string;
  ventilationRooms: string;
  wetCleaningRooms: string;
  detergent: string;
};

export type CleaningResponsiblePerson = {
  userId: string;
  title: string;
};

export type CleaningActivityEntry = {
  type: CleaningActivityType;
  times: string[];
  responsibleName: string;
};

export type CleaningEntryData = {
  activities: CleaningActivityEntry[];
};

export type CleaningResponsibleKind = "cleaning" | "control";

export type CleaningResponsible = {
  id: string;
  kind: CleaningResponsibleKind;
  title: string;
  userId: string;
  userName: string;
  code: string;
};

export type CleaningRoomItem = {
  id: string;
  areaId: string | null;
  name: string;
  detergent: string;
  currentScope: string[];
  generalScope: string[];
  /// Bitmask дней недели когда проводится ТЕКУЩАЯ уборка.
  /// bit 0 = Пн, ... bit 6 = Вс. См. src/lib/weekday-mask.ts.
  /// По умолчанию 127 (ежедневно).
  currentDays?: number;
  /// Bitmask дней недели когда проводится ГЕНЕРАЛЬНАЯ уборка.
  /// По умолчанию 0 (не запланировано — задаётся вручную в матрице).
  generalDays?: number;
};

export type CleaningMatrixValue = string;
export type CleaningMatrixMap = Record<string, Record<string, CleaningMatrixValue>>;

export type CleaningResponsiblePair = {
  id: string;
  cleaningTitle: string;
  cleaningUserId: string | null;
  cleaningUserName: string;
  controlTitle: string;
  controlUserId: string | null;
  controlUserName: string;
};

export type CleaningReferenceRow = {
  id: string;
  roomId: string;
  name: string;
  detergent: string;
  currentScope: string[];
  generalScope: string[];
};

export type CleaningDocumentSettings = {
  autoFillEnabled: boolean;
  skipWeekends: boolean;
  fillUntilToday: boolean;
};

export type CleaningAutoFillSettings = {
  enabled: boolean;
  skipWeekends: boolean;
  fillUntilToday: boolean;
  defaultRoomMark: CleaningMatrixValue;
};

export type CleaningDocumentConfig = {
  title: string;
  documentTitle: string;
  settings: CleaningDocumentSettings;
  autoFill: CleaningAutoFillSettings;
  responsiblePairs: CleaningResponsiblePair[];
  rooms: CleaningRoomItem[];
  legend: string[];
  referenceTable: CleaningReferenceRow[];
  matrix: CleaningMatrixMap;
  ventilationEnabled: boolean;
  skipWeekends: boolean;
  schedule: {
    disinfection: CleaningScheduleItem;
    ventilation: CleaningScheduleItem;
    wetCleaning: CleaningScheduleItem;
  };
  procedure: CleaningProcedure;
  responsiblePersons: CleaningResponsiblePerson[];
  periodicity: {
    disinfectionPerDay: number;
    ventilationPerDay: number;
    wetCleaningPerDay: number;
  };
  cleaningResponsibles: CleaningResponsible[];
  controlResponsibles: CleaningResponsible[];
  marks: CleaningMatrixMap;
  /// Режим раздачи задач:
  ///   "pairs"  — старый: 1 задача на пару (cleaner+control), на день.
  ///   "rooms"  — новый: 1 race-задача на каждое помещение в день,
  ///              которую может закрыть любой из selectedCleanerUserIds.
  ///              Контролёр получает один agg-таск в конце дня.
  /// По умолчанию "pairs" — старые документы продолжают работать.
  cleaningMode?: "pairs" | "rooms";
  /// IDs зарегистрированных Room (см. /settings/buildings) которые
  /// участвуют в этом журнале. Используются только при cleaningMode="rooms".
  selectedRoomIds?: string[];
  /// IDs User-ов, которые могут забирать задачи на уборку (race).
  /// Только для cleaningMode="rooms".
  selectedCleanerUserIds?: string[];
  /// Режим распределения уборщиков по комнатам (только rooms-mode):
  ///   • false (default) — round-robin: на каждую комнату ровно ОДИН
  ///     уборщик (cleaners[i % cleaners.length]). Маркова делает 0,2,4,
  ///     Захаров делает 1,3,5. Каждый знает свой набор.
  ///   • true — race: на каждую комнату создаётся task для КАЖДОГО
  ///     выбранного уборщика. Кто первый закроет — у остальных задача
  ///     уходит в «выполнено другим». Подходит для гибких смен где
  ///     уборщица сама выбирает что делать.
  ///
  /// Технически: при true адаптер генерирует rooms × cleaners rows,
  /// все с rowKey 'room::<roomId>::cleaner::<uid>'. selectRowsForBulkAssign
  /// сохраняет все (Pass 1 dedupe by rowKey не userId), TF создаёт
  /// task на каждого. claimedByWorkerId отметит «занято» у остальных.
  roomsRaceMode?: boolean;
  /// Per-room контролёры — разные supervisor'ы для разных комнат.
  /// Map roomId → userId. Если для комнаты нет записи — fallback на
  /// document-wide controlUserId. Используется в rooms-mode когда
  /// например, кухню проверяет шеф, а гостевую зону — заведующая.
  ///
  /// Технически при bulk-assign cleaning адаптер прокидывает
  /// verifierUserId per-row через AdapterRow.verifierUserId, и
  /// bulk-assign создаёт supervisor-task на этого юзера вместо
  /// document-wide.
  verifierByRoomId?: Record<string, string>;
  /// User-id ответственного за контроль. В rooms-режиме он получает
  /// одну сводную задачу в конце дня. Используется как fallback если
  /// для конкретной комнаты нет записи в verifierByRoomId.
  controlUserId?: string | null;
  /// Режим pipeline'а (подзадач в TasksFlow):
  ///   "perRoom" (default) — у каждого помещения свой список шагов
  ///                          (currentScope/generalScope в CleaningRoomItem).
  ///                          Используется когда уборка разная по цехам.
  ///   "global"            — один общий список для ВСЕХ помещений
  ///                          (`globalSubtasks` ниже). Используется когда
  ///                          протокол одинаковый для каждой комнаты.
  ///   "legacy"            — без подзадач, сотрудник просто отмечает
  ///                          «выполнено» в TasksFlow без чек-листа.
  cleaningSubtaskMode?: "perRoom" | "global" | "legacy";
  /// Общий список подзадач (для cleaningSubtaskMode === "global").
  /// Если режим другой — поле игнорируется. По умолчанию пустое.
  globalSubtasks?: {
    current: string[];
    general: string[];
  };
};

type UserLike = {
  id: string;
  name: string;
  role: string;
};

type AreaLike = {
  id: string;
  name: string;
};

type NormalizationContext = {
  users?: UserLike[];
  areas?: AreaLike[];
};

type LegacyResponsibleDefaults = {
  responsibleCleaningUserId?: string | null;
  responsibleControlUserId?: string | null;
};

// DEFAULT_ROOM_BLUEPRINTS — стартовые помещения для нового журнала уборки.
// currentScope/generalScope ПУСТЫЕ — менеджер заполняет вручную через
// диалог редактирования помещения (или подгружает из шаблона по умолчанию).
// Раньше тут были hard-coded шаги «Пол / Стеллажи / Полки», но это путало
// пользователей с другим типом производства (пекарня, бар, мясокомбинат)
// и не отражало их реальные процедуры — теперь стартуем с чистого листа.
// Если орга сохранила свой шаблон через «Сохранить как шаблон» — он
// подменит этот fallback (см. journal-documents/route.ts).
const DEFAULT_ROOM_BLUEPRINTS = [
  {
    name: "гостевая зона",
    detergent: "",
    currentScope: [] as string[],
    generalScope: [] as string[],
  },
  {
    name: "помещение мойки",
    detergent: "",
    currentScope: [] as string[],
    generalScope: [] as string[],
  },
  {
    name: "горячий цех/кухня",
    detergent: "",
    currentScope: [] as string[],
    generalScope: [] as string[],
  },
  {
    name: "Бар",
    detergent: "",
    currentScope: [] as string[],
    generalScope: [] as string[],
  },
] as const;

export const CLEANING_SCOPE_OPTIONS = Array.from(
  new Set(DEFAULT_ROOM_BLUEPRINTS.flatMap((item) => [...item.currentScope, ...item.generalScope]))
);

export const CLEANING_LEGEND = [
  "/ - Уборка не проводилась",
  "T - Текущая",
  "G - Генеральная; при генеральной уборке выполняется уборка поверхностей, указанных в текущей уборке, а также промываются стены за оборудованием, вентиляционные зонты при наличии и т.д.",
] as const;

export const CLEANING_MARK_OPTIONS = [
  { value: "" as CleaningMatrixValue, code: "", label: "Пусто" },
  { value: "T" as CleaningMatrixValue, code: "T", label: "Текущая" },
  { value: "G" as CleaningMatrixValue, code: "G", label: "Генеральная" },
  { value: "/" as CleaningMatrixValue, code: "/", label: "Не проводилась" },
] as const;

export const ACTIVITY_LABELS: Record<CleaningActivityType, string> = {
  disinfection: "Дезинфекция",
  ventilation: "Проветривание",
  wetCleaning: "Влажная уборка",
};

function createId(prefix: string) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDateKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function normalizeMatrixValue(value: unknown): CleaningMatrixValue {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cloneMatrix(value: CleaningMatrixMap): CleaningMatrixMap {
  const next: CleaningMatrixMap = {};
  for (const [rowId, row] of Object.entries(value)) {
    next[rowId] = { ...row };
  }
  return next;
}

function normalizeRoomLike(value: unknown, fallback: CleaningRoomItem): CleaningRoomItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...fallback };
  const record = value as Record<string, unknown>;
  // Weekday-mask: 0..127 integer; fallback на defaults (текущая=ежедневно, генеральная=не запланировано).
  const normalizeDayMask = (raw: unknown, fb: number) => {
    if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 127) return raw;
    return fb;
  };
  return {
    id: normalizeText(record.id, fallback.id),
    areaId: normalizeText(record.areaId) || fallback.areaId,
    name: normalizeText(record.name ?? record.roomName, fallback.name),
    detergent: normalizeText(record.detergent, fallback.detergent),
    currentScope: normalizeStringArray(record.currentScope).length
      ? normalizeStringArray(record.currentScope)
      : [...fallback.currentScope],
    generalScope: normalizeStringArray(record.generalScope).length
      ? normalizeStringArray(record.generalScope)
      : [...fallback.generalScope],
    currentDays: normalizeDayMask(record.currentDays, fallback.currentDays ?? 127),
    generalDays: normalizeDayMask(record.generalDays, fallback.generalDays ?? 0),
  };
}

function buildDefaultRooms(areas?: AreaLike[]): CleaningRoomItem[] {
  if (!areas || areas.length === 0) {
    return DEFAULT_ROOM_BLUEPRINTS.map((blueprint, index) => ({
      id: createId(`cleaning-room-${index + 1}`),
      areaId: null,
      name: blueprint.name,
      detergent: blueprint.detergent,
      currentScope: [...blueprint.currentScope],
      generalScope: [...blueprint.generalScope],
      currentDays: 127, // ежедневно
      generalDays: 0,   // не запланировано (задаётся вручную в матрице)
    }));
  }

  return areas.map((area, index) => {
    const blueprint = DEFAULT_ROOM_BLUEPRINTS[index % DEFAULT_ROOM_BLUEPRINTS.length];
    return {
      id: createId(`cleaning-room-${index + 1}`),
      areaId: area.id,
      name: area.name,
      detergent: blueprint.detergent,
      currentScope: [...blueprint.currentScope],
      generalScope: [...blueprint.generalScope],
      currentDays: 127,
      generalDays: 0,
    };
  });
}

function getPrimaryCleaningUser(users?: UserLike[]) {
  if (!users || users.length === 0) return null;
  return pickPrimaryStaff(users);
}

function getPrimaryControlUser(users?: UserLike[], excludeUserId?: string | null) {
  if (!users || users.length === 0) return null;
  const availableUsers = users.filter((user) => user.id !== excludeUserId);
  return pickPrimaryManager(availableUsers) || availableUsers[0] || users[0];
}

function getRoleTitle(role: string, fallback: string) {
  return normalizeText(getUserRoleLabel(role), fallback) || fallback;
}

function buildDefaultCleaningResponsible(
  user: UserLike | null,
  index: number,
  fallbackTitle: string
): CleaningResponsible {
  return {
    id: createId("cleaning-cleaning"),
    kind: "cleaning",
    title: user ? getRoleTitle(user.role, fallbackTitle) : fallbackTitle,
    userId: user?.id || "",
    userName: user?.name || "",
    code: `C${index + 1}`,
  };
}

function buildDefaultControlResponsible(
  user: UserLike | null,
  index: number,
  fallbackTitle: string
): CleaningResponsible {
  return {
    id: createId("cleaning-control"),
    kind: "control",
    title: user ? getRoleTitle(user.role, fallbackTitle) : fallbackTitle,
    userId: user?.id || "",
    userName: user?.name || "",
    code: `C${index + 1}`,
  };
}

function reindexResponsibles(items: CleaningResponsible[]) {
  return items.map((item, index) => ({
    ...item,
    code: `C${index + 1}`,
  }));
}

function normalizeResponsibleArray(
  kind: CleaningResponsibleKind,
  value: unknown,
  users?: UserLike[],
  fallbackTitle?: string
): CleaningResponsible[] {
  if (!Array.isArray(value)) return [];

  const fallback = fallbackTitle || (kind === "control" ? "Ответственный за контроль" : "Ответственный за уборку");
  const items = value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item)
    )
    .map((item, index) => {
      const userId = normalizeText(item.userId);
      const user = users?.find((candidate) => candidate.id === userId) || null;
      return {
        id: normalizeText(item.id, createId(`cleaning-${kind}`)),
        kind,
        title: normalizeText(item.title, fallback),
        userId,
        userName: normalizeText(item.userName, user?.name || ""),
        code: normalizeText(item.code, `C${index + 1}`),
      };
    })
    .filter((item) => item.userId || item.userName || item.title);

  return reindexResponsibles(items);
}

function buildDefaultSchedule(cleaningResponsibles: CleaningResponsible[], controlResponsibles: CleaningResponsible[]) {
  const cleaningUserId = cleaningResponsibles[0]?.userId || null;
  const controlUserId = controlResponsibles[0]?.userId || cleaningUserId;

  return {
    disinfection: {
      times: ["14:00", "12:00", "23:00"],
      responsibleUserId: cleaningUserId,
    },
    ventilation: {
      times: ["12:00", "10:00", "23:00"],
      responsibleUserId: controlUserId,
    },
    wetCleaning: {
      times: ["12:00", "18:00"],
      responsibleUserId: cleaningUserId,
    },
  };
}

function buildCompatibilityProcedure(rooms: CleaningRoomItem[]): CleaningProcedure {
  return {
    surfaces: rooms.flatMap((room) => room.currentScope).slice(0, 6).join(", "),
    ventilationRooms: rooms.map((room) => room.name).join(", "),
    wetCleaningRooms: rooms.map((room) => room.name).join(", "),
    detergent: rooms
      .map((room) => room.detergent)
      .filter(Boolean)
      .join("; "),
  };
}

function buildCompatibilityResponsiblePersons(config: {
  cleaningResponsibles: CleaningResponsible[];
  controlResponsibles: CleaningResponsible[];
}) {
  return [...config.cleaningResponsibles, ...config.controlResponsibles]
    .filter((item) => item.userId || item.userName)
    .map((item) => ({
      userId: item.userId,
      title: item.title,
    }));
}

function buildReferenceTable(rooms: CleaningRoomItem[]): CleaningReferenceRow[] {
  return rooms.map((room) => ({
    id: createId("cleaning-reference"),
    roomId: room.id,
    name: room.name,
    detergent: room.detergent,
    currentScope: [...room.currentScope],
    generalScope: [...room.generalScope],
  }));
}

function buildResponsiblePairs(
  cleaningResponsibles: CleaningResponsible[],
  controlResponsibles: CleaningResponsible[]
): CleaningResponsiblePair[] {
  const max = Math.max(cleaningResponsibles.length, controlResponsibles.length, 1);
  const pairs: CleaningResponsiblePair[] = [];

  for (let index = 0; index < max; index += 1) {
    const cleaning = cleaningResponsibles[index] || cleaningResponsibles[0] || null;
    const control = controlResponsibles[index] || controlResponsibles[0] || null;

    pairs.push({
      id: createId("cleaning-pair"),
      cleaningTitle: cleaning?.title || "Ответственный за уборку",
      cleaningUserId: cleaning?.userId || null,
      cleaningUserName: cleaning?.userName || "",
      controlTitle: control?.title || "Ответственный за контроль",
      controlUserId: control?.userId || null,
      controlUserName: control?.userName || "",
    });
  }

  return pairs;
}

function normalizeLegend(value: unknown): string[] {
  if (!Array.isArray(value)) return [...CLEANING_LEGEND];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeMatrix(value: unknown): CleaningMatrixMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: CleaningMatrixMap = {};
  for (const [rowId, rowValue] of Object.entries(value as Record<string, unknown>)) {
    if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) continue;

    const normalizedRow: Record<string, CleaningMatrixValue> = {};
    for (const [dateKey, cellValue] of Object.entries(rowValue as Record<string, unknown>)) {
      const safeDateKey = normalizeDateKey(dateKey);
      if (!safeDateKey) continue;
      normalizedRow[safeDateKey] = normalizeMatrixValue(cellValue);
    }

    result[rowId] = normalizedRow;
  }

  return result;
}

function normalizeRooms(value: unknown, areas?: AreaLike[]) {
  const defaults = buildDefaultRooms(areas);
  if (!Array.isArray(value) || value.length === 0) return defaults;

  const rooms = value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item)
    )
    .map((item, index) => normalizeRoomLike(item, defaults[index % defaults.length] || defaults[0]))
    .filter((room) => room.name);

  return rooms.length > 0 ? rooms : defaults;
}

function buildBaseConfig(users?: UserLike[], areas?: AreaLike[]): CleaningDocumentConfig {
  const rooms = buildDefaultRooms(areas);
  const primaryCleaning = getPrimaryCleaningUser(users);
  const primaryControl = getPrimaryControlUser(users, primaryCleaning?.id || null);

  const cleaningResponsibles = reindexResponsibles([
    buildDefaultCleaningResponsible(primaryCleaning, 0, "Ответственный за уборку"),
  ]);
  const controlResponsibles = reindexResponsibles([
    buildDefaultControlResponsible(primaryControl, 0, "Ответственный за контроль"),
  ]);
  const referenceTable = buildReferenceTable(rooms);
  const responsiblePairs = buildResponsiblePairs(cleaningResponsibles, controlResponsibles);

  return {
    title: CLEANING_PAGE_TITLE,
    documentTitle: CLEANING_PAGE_TITLE,
    settings: {
      // Автозаполнение по умолчанию выключено: новый документ
      // создаётся «чистым», менеджер сам включает автозаполнение
      // когда убедился что responsibles и расписание настроены.
      autoFillEnabled: false,
      skipWeekends: false,
      fillUntilToday: true,
    },
    autoFill: {
      enabled: false,
      skipWeekends: false,
      fillUntilToday: true,
      defaultRoomMark: "T",
    },
    responsiblePairs,
    rooms,
    legend: [...CLEANING_LEGEND],
    referenceTable,
    matrix: {},
    ventilationEnabled: true,
    skipWeekends: false,
    schedule: buildDefaultSchedule(cleaningResponsibles, controlResponsibles),
    procedure: buildCompatibilityProcedure(rooms),
    responsiblePersons: buildCompatibilityResponsiblePersons({
      cleaningResponsibles,
      controlResponsibles,
    }),
    periodicity: {
      disinfectionPerDay: 3,
      ventilationPerDay: 3,
      wetCleaningPerDay: 2,
    },
    cleaningResponsibles,
    controlResponsibles,
    marks: {},
  };
}

function syncCompatibilityFields(config: CleaningDocumentConfig): CleaningDocumentConfig {
  const title = normalizeText(config.title || config.documentTitle, CLEANING_PAGE_TITLE) || CLEANING_PAGE_TITLE;
  const rooms = config.rooms.length > 0 ? config.rooms : buildDefaultRooms();
  const cleaningResponsibles =
    config.cleaningResponsibles.length > 0
      ? reindexResponsibles(config.cleaningResponsibles)
      : reindexResponsibles([buildDefaultCleaningResponsible(null, 0, "Ответственный за уборку")]);
  const controlResponsibles =
    config.controlResponsibles.length > 0
      ? reindexResponsibles(config.controlResponsibles)
      : reindexResponsibles([buildDefaultControlResponsible(null, 0, "Ответственный за контроль")]);
  const matrix = cloneMatrix(config.matrix || config.marks || {});
  const settings = {
    autoFillEnabled:
      config.settings?.autoFillEnabled ??
      config.autoFill?.enabled ??
      config.ventilationEnabled ??
      true,
    skipWeekends:
      config.settings?.skipWeekends ??
      config.autoFill?.skipWeekends ??
      config.skipWeekends ??
      false,
    fillUntilToday:
      config.settings?.fillUntilToday ?? config.autoFill?.fillUntilToday ?? true,
  };
  const autoFill = {
    enabled: config.autoFill?.enabled ?? settings.autoFillEnabled,
    skipWeekends: config.autoFill?.skipWeekends ?? settings.skipWeekends,
    fillUntilToday: config.autoFill?.fillUntilToday ?? settings.fillUntilToday,
    defaultRoomMark: normalizeMatrixValue(config.autoFill?.defaultRoomMark || "T") || "T",
  };
  const referenceTable = config.referenceTable.length > 0 ? config.referenceTable : buildReferenceTable(rooms);
  const responsiblePairs =
    config.responsiblePairs.length > 0
      ? config.responsiblePairs.map((pair, index) => ({
          id: normalizeText(pair.id, createId("cleaning-pair")),
          cleaningTitle: normalizeText(pair.cleaningTitle, cleaningResponsibles[index]?.title || "Ответственный за уборку"),
          cleaningUserId: pair.cleaningUserId || cleaningResponsibles[index]?.userId || null,
          cleaningUserName: normalizeText(pair.cleaningUserName, cleaningResponsibles[index]?.userName || ""),
          controlTitle: normalizeText(pair.controlTitle, controlResponsibles[index]?.title || "Ответственный за контроль"),
          controlUserId: pair.controlUserId || controlResponsibles[index]?.userId || null,
          controlUserName: normalizeText(pair.controlUserName, controlResponsibles[index]?.userName || ""),
        }))
      : buildResponsiblePairs(cleaningResponsibles, controlResponsibles);
  const schedule = config.schedule || buildDefaultSchedule(cleaningResponsibles, controlResponsibles);
  const procedure = config.procedure || buildCompatibilityProcedure(rooms);
  const responsiblePersons =
    config.responsiblePersons.length > 0
      ? config.responsiblePersons
      : buildCompatibilityResponsiblePersons({ cleaningResponsibles, controlResponsibles });
  const periodicity =
    config.periodicity || {
      disinfectionPerDay: 3,
      ventilationPerDay: 3,
      wetCleaningPerDay: 2,
    };
  const legend = config.legend.length > 0 ? [...config.legend] : [...CLEANING_LEGEND];

  return {
    ...config,
    title,
    documentTitle: title,
    settings,
    autoFill,
    responsiblePairs,
    rooms,
    legend,
    referenceTable,
    matrix,
    ventilationEnabled: config.ventilationEnabled ?? true,
    skipWeekends: settings.skipWeekends,
    schedule,
    procedure,
    responsiblePersons,
    periodicity,
    cleaningResponsibles,
    controlResponsibles,
    marks: matrix,
  };
}

function normalizeResponsiblePairs(
  value: unknown,
  cleaningResponsibles: CleaningResponsible[],
  controlResponsibles: CleaningResponsible[],
  users?: UserLike[]
): CleaningResponsiblePair[] {
  if (!Array.isArray(value) || value.length === 0) {
    return buildResponsiblePairs(cleaningResponsibles, controlResponsibles);
  }

  const result = value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item)
    )
    .map((item, index) => {
      const cleaningUserId = normalizeText(item.cleaningUserId);
      const controlUserId = normalizeText(item.controlUserId);
      const cleaningUser = users?.find((user) => user.id === cleaningUserId) || null;
      const controlUser = users?.find((user) => user.id === controlUserId) || null;

      return {
        id: normalizeText(item.id, createId("cleaning-pair")),
        cleaningTitle: normalizeText(
          item.cleaningTitle,
          cleaningResponsibles[index]?.title || "Ответственный за уборку"
        ),
        cleaningUserId: cleaningUserId || cleaningResponsibles[index]?.userId || null,
        cleaningUserName: normalizeText(
          item.cleaningUserName,
          cleaningUser?.name || cleaningResponsibles[index]?.userName || ""
        ),
        controlTitle: normalizeText(
          item.controlTitle,
          controlResponsibles[index]?.title || "Ответственный за контроль"
        ),
        controlUserId: controlUserId || controlResponsibles[index]?.userId || null,
        controlUserName: normalizeText(
          item.controlUserName,
          controlUser?.name || controlResponsibles[index]?.userName || ""
        ),
      };
    });

  return result.length > 0 ? result : buildResponsiblePairs(cleaningResponsibles, controlResponsibles);
}

function normalizeSchedule(
  value: unknown,
  defaults: ReturnType<typeof buildDefaultSchedule>
): CleaningDocumentConfig["schedule"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const normalizeItem = (item: unknown, fallback: CleaningScheduleItem): CleaningScheduleItem => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return fallback;
    const itemRecord = item as Record<string, unknown>;
    return {
      times: normalizeStringArray(itemRecord.times).length
        ? normalizeStringArray(itemRecord.times)
        : [...fallback.times],
      responsibleUserId:
        typeof itemRecord.responsibleUserId === "string" && itemRecord.responsibleUserId.trim() !== ""
          ? itemRecord.responsibleUserId
          : fallback.responsibleUserId,
    };
  };

  return {
    disinfection: normalizeItem(record.disinfection, defaults.disinfection),
    ventilation: normalizeItem(record.ventilation, defaults.ventilation),
    wetCleaning: normalizeItem(record.wetCleaning, defaults.wetCleaning),
  };
}

function normalizeProcedure(value: unknown, rooms: CleaningRoomItem[]): CleaningProcedure {
  const fallback = buildCompatibilityProcedure(rooms);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const record = value as Record<string, unknown>;
  return {
    surfaces: normalizeText(record.surfaces, fallback.surfaces),
    ventilationRooms: normalizeText(record.ventilationRooms, fallback.ventilationRooms),
    wetCleaningRooms: normalizeText(record.wetCleaningRooms, fallback.wetCleaningRooms),
    detergent: normalizeText(record.detergent, fallback.detergent),
  };
}

function normalizePeriodicity(value: unknown) {
  const fallback = {
    disinfectionPerDay: 3,
    ventilationPerDay: 3,
    wetCleaningPerDay: 2,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  return {
    disinfectionPerDay:
      typeof record.disinfectionPerDay === "number"
        ? record.disinfectionPerDay
        : fallback.disinfectionPerDay,
    ventilationPerDay:
      typeof record.ventilationPerDay === "number"
        ? record.ventilationPerDay
        : fallback.ventilationPerDay,
    wetCleaningPerDay:
      typeof record.wetCleaningPerDay === "number"
        ? record.wetCleaningPerDay
        : fallback.wetCleaningPerDay,
  };
}

function cloneConfig(config: CleaningDocumentConfig): CleaningDocumentConfig {
  return {
    ...config,
    settings: { ...config.settings },
    autoFill: { ...config.autoFill },
    responsiblePairs: config.responsiblePairs.map((pair) => ({ ...pair })),
    rooms: config.rooms.map((room) => ({
      ...room,
      currentScope: [...room.currentScope],
      generalScope: [...room.generalScope],
    })),
    legend: [...config.legend],
    referenceTable: config.referenceTable.map((row) => ({
      ...row,
      currentScope: [...row.currentScope],
      generalScope: [...row.generalScope],
    })),
    matrix: cloneMatrix(config.matrix),
    schedule: {
      disinfection: {
        times: [...config.schedule.disinfection.times],
        responsibleUserId: config.schedule.disinfection.responsibleUserId,
      },
      ventilation: {
        times: [...config.schedule.ventilation.times],
        responsibleUserId: config.schedule.ventilation.responsibleUserId,
      },
      wetCleaning: {
        times: [...config.schedule.wetCleaning.times],
        responsibleUserId: config.schedule.wetCleaning.responsibleUserId,
      },
    },
    procedure: { ...config.procedure },
    responsiblePersons: config.responsiblePersons.map((item) => ({ ...item })),
    periodicity: { ...config.periodicity },
    cleaningResponsibles: config.cleaningResponsibles.map((item) => ({ ...item })),
    controlResponsibles: config.controlResponsibles.map((item) => ({ ...item })),
    marks: cloneMatrix(config.marks),
  };
}

function setMatrixCell(
  matrix: CleaningMatrixMap,
  rowId: string,
  dateKey: string,
  value: CleaningMatrixValue
): CleaningMatrixMap {
  const next = cloneMatrix(matrix);
  const row = { ...(next[rowId] || {}) };

  if (value) {
    row[dateKey] = value;
  } else {
    delete row[dateKey];
  }

  if (Object.keys(row).length > 0) {
    next[rowId] = row;
  } else {
    delete next[rowId];
  }

  return next;
}

function clearRowsFromMatrix(matrix: CleaningMatrixMap, rowIds: string[]): CleaningMatrixMap {
  const rowIdSet = new Set(rowIds);
  const next: CleaningMatrixMap = {};
  for (const [rowId, row] of Object.entries(matrix)) {
    if (!rowIdSet.has(rowId)) {
      next[rowId] = { ...row };
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Defaults and normalization
// ---------------------------------------------------------------------------

export function defaultCleaningDocumentConfig(
  users?: UserLike[],
  areas?: AreaLike[]
): CleaningDocumentConfig {
  return syncCompatibilityFields(buildBaseConfig(users, areas));
}

export function normalizeCleaningDocumentConfig(
  value: unknown,
  context: NormalizationContext = {}
): CleaningDocumentConfig {
  const defaults = defaultCleaningDocumentConfig(context.users, context.areas);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const hasModernModel =
    Array.isArray(record.rooms) ||
    Array.isArray(record.responsiblePairs) ||
    Array.isArray(record.referenceTable) ||
    record.matrix !== undefined ||
    record.marks !== undefined;

  const rooms = normalizeRooms(record.rooms ?? record.referenceTable, context.areas);
  const cleaningResponsibles = normalizeResponsibleArray(
    "cleaning",
    record.cleaningResponsibles,
    context.users,
    "Ответственный за уборку"
  );
  const controlResponsibles = normalizeResponsibleArray(
    "control",
    record.controlResponsibles,
    context.users,
    "Ответственный за контроль"
  );
  const scheduleDefaults = buildDefaultSchedule(
    cleaningResponsibles.length > 0 ? cleaningResponsibles : defaults.cleaningResponsibles,
    controlResponsibles.length > 0 ? controlResponsibles : defaults.controlResponsibles
  );
  const matrix = normalizeMatrix(record.matrix ?? record.marks);
  const title = normalizeText(record.title ?? record.documentTitle, defaults.title);
  const settingsRecord =
    record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
      ? (record.settings as Record<string, unknown>)
      : null;
  const autoFillRecord =
    record.autoFill && typeof record.autoFill === "object" && !Array.isArray(record.autoFill)
      ? (record.autoFill as Record<string, unknown>)
      : null;
  const settingsAutoFillEnabled =
    typeof settingsRecord?.autoFillEnabled === "boolean"
      ? settingsRecord.autoFillEnabled
      : typeof record.autoFillEnabled === "boolean"
        ? record.autoFillEnabled
        : defaults.settings.autoFillEnabled;
  const settingsSkipWeekends =
    typeof settingsRecord?.skipWeekends === "boolean"
      ? settingsRecord.skipWeekends
      : typeof record.skipWeekends === "boolean"
        ? record.skipWeekends
        : defaults.settings.skipWeekends;
  const settingsFillUntilToday =
    typeof settingsRecord?.fillUntilToday === "boolean"
      ? settingsRecord.fillUntilToday
      : defaults.settings.fillUntilToday;
  const autoFillEnabled =
    typeof autoFillRecord?.enabled === "boolean" ? autoFillRecord.enabled : defaults.autoFill.enabled;
  const autoFillSkipWeekends =
    typeof autoFillRecord?.skipWeekends === "boolean"
      ? autoFillRecord.skipWeekends
      : defaults.autoFill.skipWeekends;
  const autoFillFillUntilToday =
    typeof autoFillRecord?.fillUntilToday === "boolean"
      ? autoFillRecord.fillUntilToday
      : defaults.autoFill.fillUntilToday;
  const autoFillDefaultRoomMark =
    typeof autoFillRecord?.defaultRoomMark === "string"
      ? normalizeMatrixValue(autoFillRecord.defaultRoomMark) || "T"
      : defaults.autoFill.defaultRoomMark || "T";

  const next: CleaningDocumentConfig = {
    ...defaults,
    title,
    documentTitle: title,
    settings: {
      autoFillEnabled: settingsAutoFillEnabled,
      skipWeekends: settingsSkipWeekends,
      fillUntilToday: settingsFillUntilToday,
    },
    autoFill: {
      enabled: autoFillEnabled,
      skipWeekends: autoFillSkipWeekends,
      fillUntilToday: autoFillFillUntilToday,
      defaultRoomMark: autoFillDefaultRoomMark,
    },
    responsiblePairs: normalizeResponsiblePairs(
      record.responsiblePairs,
      cleaningResponsibles,
      controlResponsibles,
      context.users
    ),
    rooms,
    legend: normalizeLegend(record.legend),
    referenceTable: buildReferenceTable(rooms),
    matrix,
    ventilationEnabled:
      typeof record.ventilationEnabled === "boolean"
        ? record.ventilationEnabled
        : defaults.ventilationEnabled,
    skipWeekends:
      typeof record.skipWeekends === "boolean"
        ? record.skipWeekends
        : defaults.skipWeekends,
    schedule: normalizeSchedule(record.schedule, scheduleDefaults),
    procedure: normalizeProcedure(record.procedure, rooms),
    responsiblePersons:
      Array.isArray(record.responsiblePersons) && record.responsiblePersons.length > 0
        ? record.responsiblePersons
            .filter(
              (item): item is Record<string, unknown> =>
                !!item && typeof item === "object" && !Array.isArray(item)
            )
            .map((item) => ({
              userId: normalizeText(item.userId),
              title: normalizeText(item.title),
            }))
            .filter((item) => item.userId || item.title)
        : buildCompatibilityResponsiblePersons({
            cleaningResponsibles:
              cleaningResponsibles.length > 0 ? cleaningResponsibles : defaults.cleaningResponsibles,
            controlResponsibles:
              controlResponsibles.length > 0 ? controlResponsibles : defaults.controlResponsibles,
          }),
    periodicity: normalizePeriodicity(record.periodicity),
    cleaningResponsibles:
      cleaningResponsibles.length > 0 ? cleaningResponsibles : defaults.cleaningResponsibles,
    controlResponsibles:
      controlResponsibles.length > 0 ? controlResponsibles : defaults.controlResponsibles,
    marks: matrix,
  };

  if (!hasModernModel && next.responsiblePairs.length === 0) {
    next.responsiblePairs = buildResponsiblePairs(next.cleaningResponsibles, next.controlResponsibles);
  }

  // Rooms-mode (Этап 2). Опциональные поля — без значения старые
  // документы продолжают работать через responsiblePairs.
  const modeRaw = record.cleaningMode;
  next.cleaningMode = modeRaw === "rooms" ? "rooms" : "pairs";
  next.selectedRoomIds = Array.isArray(record.selectedRoomIds)
    ? record.selectedRoomIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  next.selectedCleanerUserIds = Array.isArray(record.selectedCleanerUserIds)
    ? record.selectedCleanerUserIds.filter(
        (x): x is string => typeof x === "string" && x.length > 0
      )
    : [];
  next.roomsRaceMode = record.roomsRaceMode === true;
  // Per-room verifiers: filter only valid string→string entries.
  if (record.verifierByRoomId && typeof record.verifierByRoomId === "object" && !Array.isArray(record.verifierByRoomId)) {
    const cleaned: Record<string, string> = {};
    for (const [roomId, uid] of Object.entries(record.verifierByRoomId as Record<string, unknown>)) {
      if (typeof roomId === "string" && typeof uid === "string" && uid.length > 0) {
        cleaned[roomId] = uid;
      }
    }
    next.verifierByRoomId = cleaned;
  } else {
    next.verifierByRoomId = {};
  }
  next.controlUserId =
    typeof record.controlUserId === "string" && record.controlUserId.length > 0
      ? record.controlUserId
      : null;

  // Pipeline (subtask) mode — perRoom by default для backwards-compat.
  // legacy = без подзадач, global = один общий список, perRoom = по помещению.
  const subtaskModeRaw = record.cleaningSubtaskMode;
  next.cleaningSubtaskMode =
    subtaskModeRaw === "legacy" || subtaskModeRaw === "global" || subtaskModeRaw === "perRoom"
      ? subtaskModeRaw
      : "perRoom";
  // Global subtasks — используются только в "global" mode, но всегда
  // нормализуем чтобы переключение режимов не теряло данные.
  const globalRaw = record.globalSubtasks;
  if (globalRaw && typeof globalRaw === "object" && !Array.isArray(globalRaw)) {
    const g = globalRaw as Record<string, unknown>;
    next.globalSubtasks = {
      current: normalizeStringArray(g.current),
      general: normalizeStringArray(g.general),
    };
  } else {
    next.globalSubtasks = { current: [], general: [] };
  }

  return syncCompatibilityFields(next);
}

/**
 * Серверная валидация cleaning-документа. Используется в PATCH endpoint
 * для отсечения невалидных конфигураций ДО save'а — чтобы юзер получил
 * явную ошибку вместо silent-fail в bulk-assign.
 *
 * Бросает Error с понятным сообщением для UI. Возвращает void.
 */
export function validateCleaningDocumentConfig(
  config: CleaningDocumentConfig,
): void {
  if (config.cleaningMode === "rooms") {
    if (!config.selectedRoomIds || config.selectedRoomIds.length === 0) {
      throw new Error(
        "Режим «По комнатам» требует выбрать хотя бы одну комнату " +
          "(selectedRoomIds). Открой настройки документа и отметь " +
          "комнаты для уборки.",
      );
    }
    if (
      !config.selectedCleanerUserIds ||
      config.selectedCleanerUserIds.length === 0
    ) {
      throw new Error(
        "Режим «По комнатам» требует выбрать хотя бы одного уборщика " +
          "(selectedCleanerUserIds). Открой настройки документа и " +
          "отметь сотрудников.",
      );
    }
  }
}

export function normalizeCleaningEntryData(value: unknown): CleaningEntryData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { activities: [] };
  }

  const record = value as Record<string, unknown>;
  const activities = Array.isArray(record.activities)
    ? record.activities
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object" && !Array.isArray(item)
        )
        .map((item): CleaningActivityEntry => ({
          type:
            item.type === "disinfection" || item.type === "ventilation" || item.type === "wetCleaning"
              ? item.type
              : "wetCleaning",
          times: normalizeStringArray(item.times),
          responsibleName: normalizeText(item.responsibleName),
        }))
    : [];

  return { activities };
}

export function getDefaultCleaningResponsibleIds(users: Array<{ id: string; role: string }>) {
  const responsibleCleaningUserId = pickPrimaryStaff(users)?.id || null;

  const responsibleControlUserId =
    pickPrimaryManager(users.filter((user) => user.id !== responsibleCleaningUserId))?.id ||
    users.find((user) => user.id !== responsibleCleaningUserId)?.id ||
    responsibleCleaningUserId;

  return {
    responsibleCleaningUserId,
    responsibleControlUserId,
  };
}

export function buildCleaningConfigFromAreas(
  areas: AreaLike[],
  userDefaults?: LegacyResponsibleDefaults
): CleaningDocumentConfig {
  const config = defaultCleaningDocumentConfig(undefined, areas);

  if (userDefaults?.responsibleCleaningUserId) {
    config.cleaningResponsibles = config.cleaningResponsibles.map((item, index) =>
      index === 0
        ? { ...item, userId: userDefaults.responsibleCleaningUserId || "", userName: item.userName }
        : item
    );
  }

  if (userDefaults?.responsibleControlUserId) {
    config.controlResponsibles = config.controlResponsibles.map((item, index) =>
      index === 0
        ? { ...item, userId: userDefaults.responsibleControlUserId || "", userName: item.userName }
        : item
    );
  }

  return syncCompatibilityFields(config);
}

export function buildCleaningDocumentConfig(params: {
  users?: UserLike[];
  areas?: AreaLike[];
  base?: unknown;
  title?: string;
}) {
  const normalized = normalizeCleaningDocumentConfig(params.base, {
    users: params.users,
    areas: params.areas,
  });

  return params.title
    ? syncCompatibilityFields({
        ...normalized,
        title: params.title,
        documentTitle: params.title,
      })
    : normalized;
}

export function getCleaningDocumentTitle() {
  return CLEANING_PAGE_TITLE;
}

/**
 * The cleaning journal is run as a half-month document (1st–15th, then
 * 16th–end). Pick the half that contains `referenceDate` so creating
 * a doc on the 20th gives «16–30» (or «16–31» / «16–28»/«16–29»),
 * not «1–15» from the previous half.
 */
export function getCleaningCreatePeriodBounds(referenceDate = new Date()) {
  const date = coerceUtcDate(referenceDate);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthStr = String(month + 1).padStart(2, "0");

  if (day <= 15) {
    return {
      dateFrom: `${year}-${monthStr}-01`,
      dateTo: `${year}-${monthStr}-${String(Math.min(lastDay, 15)).padStart(2, "0")}`,
    };
  }

  return {
    dateFrom: `${year}-${monthStr}-16`,
    dateTo: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

const RU_MONTHS = [
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

export function getCleaningPeriodLabel(dateFrom: Date | string, dateTo: Date | string) {
  const from = typeof dateFrom === "string" ? new Date(`${dateFrom}T00:00:00`) : dateFrom;
  const to = typeof dateTo === "string" ? new Date(`${dateTo}T00:00:00`) : dateTo;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return formatMonthLabel(dateFrom, dateTo);
  }

  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${RU_MONTHS[from.getMonth()]} с ${from.getDate()} по ${to.getDate()}`;
  }

  return formatMonthLabel(dateFrom, dateTo);
}

export function getCleaningFilePrefix() {
  return "cleaning-journal";
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

export function createCleaningRoom(overrides: Partial<CleaningRoomItem> = {}): CleaningRoomItem {
  return {
    id: overrides.id || createId("cleaning-room"),
    areaId: overrides.areaId || null,
    name: normalizeText(overrides.name, "помещение"),
    detergent: normalizeText(overrides.detergent),
    currentScope: overrides.currentScope ? [...overrides.currentScope] : [],
    generalScope: overrides.generalScope ? [...overrides.generalScope] : [],
    currentDays: typeof overrides.currentDays === "number" ? overrides.currentDays : 127,
    generalDays: typeof overrides.generalDays === "number" ? overrides.generalDays : 0,
  };
}

export const createCleaningRoomRow = createCleaningRoom;

export function upsertCleaningRoom(items: CleaningRoomItem[], item: CleaningRoomItem) {
  const next = items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
  return next;
}

export const upsertCleaningRoomRow = upsertCleaningRoom;

export function removeCleaningRoom(items: CleaningRoomItem[], id: string) {
  return items.filter((item) => item.id !== id);
}

export const removeCleaningRoomRow = removeCleaningRoom;

export function createCleaningResponsible(params: {
  kind: CleaningResponsibleKind;
  title: string;
  userId: string;
  userName: string;
  code?: string;
}): CleaningResponsible {
  return {
    id: createId(`cleaning-${params.kind}`),
    kind: params.kind,
    title: normalizeText(
      params.title,
      params.kind === "control" ? "Ответственный за контроль" : "Ответственный за уборку"
    ),
    userId: params.userId,
    userName: params.userName,
    code: normalizeText(params.code, "C1"),
  };
}

export const createCleaningResponsibleRow = createCleaningResponsible;

export function upsertCleaningResponsible(items: CleaningResponsible[], item: CleaningResponsible) {
  const next = items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
  return reindexResponsibles(next);
}

export const upsertCleaningResponsibleRow = upsertCleaningResponsible;

export function removeCleaningResponsible(items: CleaningResponsible[], id: string) {
  return reindexResponsibles(items.filter((item) => item.id !== id));
}

export const removeCleaningResponsibleRow = removeCleaningResponsible;

export function toggleCleaningMatrixValue(currentValue: CleaningMatrixValue): CleaningMatrixValue {
  if (currentValue === "") return "T";
  if (currentValue === "T") return "G";
  if (currentValue === "G") return "/";
  return "";
}

export function setCleaningMatrixValue(params: {
  config: CleaningDocumentConfig;
  rowId: string;
  dateKey: string;
  value: CleaningMatrixValue;
}) {
  const next = cloneConfig(params.config);
  next.matrix = setMatrixCell(next.matrix, params.rowId, params.dateKey, params.value);
  next.marks = next.matrix;
  return syncCompatibilityFields(next);
}

/**
 * Удаляет period-specific поля из cleaning config'а: matrix и marks.
 * Используется когда копируем config предыдущего документа в новый —
 * структуру (rooms, ответственные, schedule, weekday-маски) переносим,
 * а отметки уборщицы по конкретным датам — нет, это новый период.
 *
 * Возвращает копию config'а без matrix/marks; остальные поля как есть.
 */
export function stripPeriodSpecificCleaningFields(
  rawConfig: unknown,
): Record<string, unknown> | null {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    return null;
  }
  const record = rawConfig as Record<string, unknown>;
  const { matrix: _m, marks: _mk, ...rest } = record;
  void _m;
  void _mk;
  return rest;
}

/**
 * Заполняет матрицу по weekday-маскам помещений (currentDays/generalDays).
 * Для каждой пары (room, dateKey):
 *   • если generalDays включает день недели → ставим "G"
 *   • иначе если currentDays включает → ставим "T"
 *   • иначе оставляем как есть
 *
 * `mode` управляет тем, что делать с уже заполненными ячейками:
 *   • "fill-empty"  — трогаем только пустые ячейки (default).
 *                     Пользовательские отметки сохраняются — план только
 *                     дозаполняет «нетронутое».
 *   • "overwrite"   — перезаписываем всё, включая существующие "/"/"T"/"G".
 *                     Используется для «применить план заново» button.
 *
 * Используется:
 *   1. При создании нового JournalDocument для cleaning — чтобы матрица
 *      сразу была размечена по плану из шаблона по умолчанию.
 *   2. При сохранении настроек помещения — auto-apply на пустые ячейки.
 *   3. По кнопке «Заполнить по плану» — overwrite-режим.
 *
 * Sun-first JS dayOfWeek (Date.getUTCDay) → Mon-first index через
 * `+6 % 7` (см. weekday-mask.ts/jsDayOfWeekToMondayIndex).
 */
export function applyRoomScheduleToMatrix(
  config: CleaningDocumentConfig,
  dateKeys: string[],
  mode: "fill-empty" | "overwrite" = "fill-empty",
): CleaningDocumentConfig {
  const next = cloneConfig(config);
  for (const room of next.rooms) {
    const currentMask = typeof room.currentDays === "number" ? room.currentDays : 127;
    const generalMask = typeof room.generalDays === "number" ? room.generalDays : 0;
    if (currentMask === 0 && generalMask === 0) continue;
    const row = next.matrix[room.id] ? { ...next.matrix[room.id] } : {};
    for (const dateKey of dateKeys) {
      const date = new Date(`${dateKey}T00:00:00Z`);
      const jsDow = date.getUTCDay();
      const mondayIdx = (jsDow + 6) % 7;
      const bit = 1 << mondayIdx;
      // Generalная имеет приоритет над текущей: если день в обоих
      // масках — пишем G, иначе T.
      let plan: CleaningMatrixValue = "";
      if ((generalMask & bit) !== 0) plan = "G";
      else if ((currentMask & bit) !== 0) plan = "T";
      if (!plan) continue;
      const existing = row[dateKey];
      if (mode === "fill-empty" && existing) continue;
      row[dateKey] = plan;
    }
    if (Object.keys(row).length > 0) {
      next.matrix[room.id] = row;
    }
  }
  next.marks = next.matrix;
  return syncCompatibilityFields(next);
}

export function deleteCleaningRows(config: CleaningDocumentConfig, rowIds: string[]) {
  const rowIdSet = new Set(rowIds);
  const next = cloneConfig(config);

  next.rooms = next.rooms.filter((room) => !rowIdSet.has(room.id));
  next.cleaningResponsibles = next.cleaningResponsibles.filter((item) => !rowIdSet.has(item.id));
  next.controlResponsibles = next.controlResponsibles.filter((item) => !rowIdSet.has(item.id));
  next.matrix = clearRowsFromMatrix(next.matrix, rowIds);
  next.marks = next.matrix;

  if (next.referenceTable.length > 0) {
    next.referenceTable = next.referenceTable.filter((row) => !rowIdSet.has(row.roomId));
  }

  return syncCompatibilityFields(next);
}

export function addCleaningRoomRow(config: CleaningDocumentConfig, room = createCleaningRoom()) {
  return syncCompatibilityFields({
    ...cloneConfig(config),
    rooms: [...config.rooms, room],
  });
}

export function editCleaningRoomRow(
  config: CleaningDocumentConfig,
  roomId: string,
  patch: Partial<CleaningRoomItem>
) {
  return syncCompatibilityFields({
    ...cloneConfig(config),
    rooms: config.rooms.map((room) => (room.id === roomId ? { ...room, ...patch } : room)),
  });
}

export function deleteCleaningRoomRow(config: CleaningDocumentConfig, roomId: string) {
  return deleteCleaningRows(config, [roomId]);
}

export function addCleaningResponsibleRow(
  config: CleaningDocumentConfig,
  kind: CleaningResponsibleKind,
  responsible = createCleaningResponsible({
    kind,
    title: kind === "control" ? "Ответственный за контроль" : "Ответственный за уборку",
    userId: "",
    userName: "",
  })
) {
  const next = cloneConfig(config);
  if (kind === "cleaning") {
    next.cleaningResponsibles = [...next.cleaningResponsibles, responsible];
  } else {
    next.controlResponsibles = [...next.controlResponsibles, responsible];
  }
  return syncCompatibilityFields(next);
}

export function editCleaningResponsibleRow(
  config: CleaningDocumentConfig,
  kind: CleaningResponsibleKind,
  responsibleId: string,
  patch: Partial<CleaningResponsible>
) {
  const next = cloneConfig(config);
  if (kind === "cleaning") {
    next.cleaningResponsibles = next.cleaningResponsibles.map((item) =>
      item.id === responsibleId ? { ...item, ...patch, kind } : item
    );
  } else {
    next.controlResponsibles = next.controlResponsibles.map((item) =>
      item.id === responsibleId ? { ...item, ...patch, kind } : item
    );
  }
  return syncCompatibilityFields(next);
}

export function deleteCleaningResponsibleRow(
  config: CleaningDocumentConfig,
  kind: CleaningResponsibleKind,
  responsibleId: string
) {
  const next = cloneConfig(config);
  if (kind === "cleaning") {
    next.cleaningResponsibles = next.cleaningResponsibles.filter((item) => item.id !== responsibleId);
  } else {
    next.controlResponsibles = next.controlResponsibles.filter((item) => item.id !== responsibleId);
  }
  next.matrix = clearRowsFromMatrix(next.matrix, [responsibleId]);
  next.marks = next.matrix;
  return syncCompatibilityFields(next);
}

// ---------------------------------------------------------------------------
// Auto-fill
// ---------------------------------------------------------------------------

export function buildCleaningAutoFillMatrix(params: {
  config: CleaningDocumentConfig;
  dateFrom: string;
  dateTo: string;
}) {
  return applyCleaningAutoFillToConfig(params);
}

function getAutoFillDateKeys(params: {
  dateFrom: string;
  dateTo: string;
  skipWeekends: boolean;
  stopAtToday?: boolean;
}) {
  const todayKey = toDateKey(new Date());
  return buildDateKeys(params.dateFrom, params.dateTo).filter((dateKey) => {
    if (params.stopAtToday !== false && dateKey > todayKey) return false;
    if (params.skipWeekends && isWeekend(dateKey)) return false;
    return true;
  });
}

export function applyCleaningAutoFillToConfig(params: {
  config: CleaningDocumentConfig;
  dateFrom: string;
  dateTo: string;
}) {
  const config = syncCompatibilityFields(cloneConfig(params.config));
  const dateKeys = getAutoFillDateKeys({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    skipWeekends: config.autoFill.skipWeekends || config.settings.skipWeekends || config.skipWeekends,
    stopAtToday: config.autoFill.fillUntilToday,
  });

  const roomMark = normalizeMatrixValue(config.autoFill.defaultRoomMark || "T") || "T";

  for (const dateKey of dateKeys) {
    for (const room of config.rooms) {
      const row = config.matrix[room.id] || {};
      if (!row[dateKey]) {
        config.matrix = setMatrixCell(config.matrix, room.id, dateKey, roomMark);
      }
    }

    config.cleaningResponsibles.forEach((responsible, index) => {
      const row = config.matrix[responsible.id] || {};
      if (!row[dateKey]) {
        config.matrix = setMatrixCell(config.matrix, responsible.id, dateKey, responsible.code || `C${index + 1}`);
      }
    });

    config.controlResponsibles.forEach((responsible, index) => {
      const row = config.matrix[responsible.id] || {};
      if (!row[dateKey]) {
        config.matrix = setMatrixCell(config.matrix, responsible.id, dateKey, responsible.code || `C${index + 1}`);
      }
    });
  }

  config.marks = config.matrix;
  return syncCompatibilityFields(config);
}

export function buildCleaningAutoFillEntries(params: {
  config: CleaningDocumentConfig;
  dateFrom: string;
  dateTo: string;
  users: { id: string; name: string }[];
}): Array<{ date: string; data: CleaningEntryData }> {
  void params.users;
  const config = applyCleaningAutoFillToConfig({
    config: params.config,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  const dateKeys = getAutoFillDateKeys({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    skipWeekends: config.autoFill.skipWeekends || config.settings.skipWeekends || config.skipWeekends,
    stopAtToday: config.autoFill.fillUntilToday,
  });

  return dateKeys.map((dateKey) => ({
    date: dateKey,
    data: {
      activities: config.rooms
        .map((room): CleaningActivityEntry | null => {
          const value = config.matrix[room.id]?.[dateKey] || "";
          return value
            ? {
                type: "wetCleaning" as CleaningActivityType,
                times: [value],
                responsibleName: room.name,
              }
            : null;
        })
        .filter((item): item is CleaningActivityEntry => item !== null),
    },
  }));
}

// ---------------------------------------------------------------------------
// Legacy compatibility shims
// ---------------------------------------------------------------------------

/** @deprecated Part of the legacy room-by-day model */
export type CleaningMark = "routine" | "general";

/** @deprecated Part of the legacy room-by-day model */
export type CleaningConfigItem = {
  id: string;
  sourceAreaId: string | null;
  name: string;
  detergent: string;
  routineScope: string;
  generalScope: string;
};

export function createCleaningConfigItem(
  overrides: Partial<CleaningConfigItem> = {}
): CleaningConfigItem {
  return {
    id: overrides.id || createId("cleaning-item"),
    sourceAreaId: overrides.sourceAreaId || null,
    name: normalizeText(overrides.name, "помещение"),
    detergent: normalizeText(overrides.detergent),
    routineScope: normalizeText(overrides.routineScope),
    generalScope: normalizeText(overrides.generalScope),
  };
}

export function getCleaningMarkCode(mark: CleaningMark | null | undefined) {
  if (mark === "routine") return "T";
  if (mark === "general") return "G";
  return "";
}

export function createEmptyCleaningEntryData(mark: CleaningMark | null = null): { mark: CleaningMark | null } {
  return { mark };
}

export function getDefaultCleaningDocumentConfig() {
  return defaultCleaningDocumentConfig();
}

export function buildCleaningAutoFillRows(params: {
  config: CleaningDocumentConfig;
  dateFrom: Date | string;
  dateTo: Date | string;
  referenceDate?: Date | string;
}): Array<{ employeeId: string; date: Date; data: { mark: CleaningMark | null } }> {
  void params.referenceDate;
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : toDateKey(params.dateFrom);
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : toDateKey(params.dateTo);
  const config = applyCleaningAutoFillToConfig({
    config: params.config,
    dateFrom,
    dateTo,
  });

  const dateKeys = getAutoFillDateKeys({
    dateFrom,
    dateTo,
    skipWeekends: config.autoFill.skipWeekends || config.settings.skipWeekends || config.skipWeekends,
    stopAtToday: config.autoFill.fillUntilToday,
  });

  return dateKeys.flatMap((dateKey) =>
    config.rooms.map((room) => ({
      employeeId: room.id,
      date: new Date(`${dateKey}T00:00:00`),
      data: {
        mark:
          config.matrix[room.id]?.[dateKey] === "G"
            ? "general"
            : config.matrix[room.id]?.[dateKey] === "T"
              ? "routine"
              : null,
      },
    }))
  );
}
