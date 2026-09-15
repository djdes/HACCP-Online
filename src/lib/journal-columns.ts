/**
 * Колонки таблиц журналов: какие показывать и как подписывать.
 *
 * Хранение — `JournalDocument.config.columns`:
 *
 *   { hidden: ["temp", "courier"], labels: { name: "Блюдо" } }
 *
 * Правила:
 *   • обязательную колонку бланка (`required`) скрыть нельзя;
 *   • неизвестные ключи отбрасываются, подпись — не длиннее 60 символов;
 *   • пустая подпись или совпадающая со стандартной не хранится;
 *   • скрытая колонка данных не теряет: значения строк остаются в конфиге.
 *
 * Порядок источников (`resolveColumns`): `config.columns` документа →
 * общий вариант организации (`Organization.journalColumnsJson[code]`) →
 * старые флаги `showX` → реестр. Общий вариант организации записывается
 * в документы при создании и по «Применить ко всем документам», поэтому
 * у открытого документа он уже лежит в `config.columns`.
 *
 * Старые флаги (`showProductTemp`, `showNote`…) продолжают жить в
 * конфиге: нормализаторы синхронизируют их из `columns`
 * (`legacyFlagsFromColumns`), и печать/адаптеры TasksFlow работают без
 * правок.
 */

export const JOURNAL_COLUMN_LABEL_MAX = 60;

export type JournalColumnsConfig = {
  hidden: string[];
  labels: Record<string, string>;
};

type ConfigRecord = Record<string, unknown>;

export type JournalColumnDef = {
  key: string;
  /** Стандартная подпись; может зависеть от режима документа. */
  label: string | ((config: ConfigRecord) => string);
  /** Относительная ширина в таблице. */
  weight: number;
  /** Обязательная колонка бланка — скрыть нельзя. */
  required?: boolean;
  /**
   * Старый булев флаг конфига, которым колонка включалась раньше.
   * `defaultVisible` — как вёл себя документ без флага.
   */
  legacyFlag?: { key: string; defaultVisible: boolean };
  align?: "center";
};

export type ResolvedJournalColumn = {
  key: string;
  label: string;
  defaultLabel: string;
  weight: number;
  required: boolean;
  hidden: boolean;
  align?: "center";
};

const FINISHED_PRODUCT_COLUMNS: JournalColumnDef[] = [
  { key: "production", label: "Дата, время изготовления", weight: 9, required: true, align: "center" },
  { key: "rejection", label: "Время снятия бракеража", weight: 7, required: true, align: "center" },
  {
    key: "name",
    label: (config) =>
      config.fieldNameMode === "semi" ? "Наименование полуфабриката" : "Наименование блюд (изделий)",
    weight: 13,
    required: true,
  },
  {
    key: "organoleptic",
    label: "Органолептическая оценка (включая оценку степени готовности)",
    weight: 31,
    required: true,
  },
  {
    key: "temp",
    label: "T°C внутри продукта",
    weight: 8,
    legacyFlag: { key: "showProductTemp", defaultVisible: false },
    align: "center",
  },
  {
    key: "corrective",
    label: "Корректирующие действия",
    weight: 12,
    legacyFlag: { key: "showCorrectiveAction", defaultVisible: false },
  },
  {
    key: "oxygen",
    label: "Остаточный уровень кислорода, % об.",
    weight: 9,
    legacyFlag: { key: "showOxygenLevel", defaultVisible: false },
    align: "center",
  },
  { key: "release", label: "Разрешение к реализации (время)", weight: 13, required: true, align: "center" },
  {
    key: "courier",
    label: "Время передачи блюд курьеру",
    weight: 9,
    legacyFlag: { key: "showCourierTime", defaultVisible: false },
    align: "center",
  },
  { key: "responsible", label: "Ответственный исполнитель (ФИО, должность)", weight: 14 },
  {
    key: "inspector",
    label: (config) =>
      config.inspectorMode === "commission_signatures"
        ? "Подписи членов комиссии"
        : "ФИО лица, проводившего бракераж",
    weight: 13,
    required: true,
  },
];

const PERISHABLE_REJECTION_COLUMNS: JournalColumnDef[] = [
  { key: "arrival", label: "Дата, время поступления пищ. продукции", weight: 95, required: true },
  { key: "product", label: "Наименование", weight: 110, required: true },
  { key: "productionDate", label: "Дата выработки", weight: 78 },
  { key: "manufacturer", label: "Изготовитель/поставщик", weight: 100 },
  { key: "packaging", label: "Фасовка/Кол-во поступившего продукта (в кг, литрах, шт)", weight: 92 },
  { key: "document", label: "Номер документа, подтверждающего безопасность", weight: 92 },
  { key: "organoleptic", label: "Результаты органолептической оценки", weight: 100, required: true },
  { key: "storage", label: "Условия хранения, конечный срок реализации", weight: 100 },
  { key: "sale", label: "Дата, время фактической реализации", weight: 84 },
  { key: "responsible", label: "Ответственное лицо (ФИО, должность)", weight: 96, required: true },
  {
    key: "note",
    label: "Примечание",
    weight: 70,
    legacyFlag: { key: "showNote", defaultVisible: true },
  },
];

const REGISTRY: Record<string, JournalColumnDef[]> = {
  finished_product: FINISHED_PRODUCT_COLUMNS,
  perishable_rejection: PERISHABLE_REJECTION_COLUMNS,
};

export const JOURNAL_COLUMN_CODES = Object.keys(REGISTRY);

export function hasColumnRegistry(code: string): boolean {
  return code in REGISTRY;
}

export function getColumnRegistry(code: string): readonly JournalColumnDef[] {
  return REGISTRY[code] ?? [];
}

function asRecord(value: unknown): ConfigRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ConfigRecord) : {};
}

function defaultLabelOf(column: JournalColumnDef, config: ConfigRecord): string {
  return typeof column.label === "function" ? column.label(config) : column.label;
}

/**
 * Приводит сырое значение `columns` к допустимому виду для журнала. `null`
 * — значения нет (или это не объект): документ пользуется стандартом.
 */
export function sanitizeColumnsConfig(
  code: string,
  raw: unknown,
  config: unknown = {}
): JournalColumnsConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const registry = getColumnRegistry(code);
  if (registry.length === 0) return null;
  const record = raw as ConfigRecord;
  const configRecord = asRecord(config);
  const byKey = new Map(registry.map((column) => [column.key, column]));

  const hiddenRaw = Array.isArray(record.hidden) ? record.hidden : [];
  const hidden = [
    ...new Set(
      hiddenRaw.filter(
        (key): key is string =>
          typeof key === "string" && byKey.has(key) && byKey.get(key)?.required !== true
      )
    ),
  ];

  const labels: Record<string, string> = {};
  const labelsRaw = asRecord(record.labels);
  for (const [key, value] of Object.entries(labelsRaw)) {
    const column = byKey.get(key);
    if (!column || typeof value !== "string") continue;
    const label = value.replace(/\s+/g, " ").trim().slice(0, JOURNAL_COLUMN_LABEL_MAX);
    if (!label || label === defaultLabelOf(column, configRecord)) continue;
    labels[key] = label;
  }

  return { hidden, labels };
}

/** Колонки журнала с итоговой видимостью и подписью. */
export function resolveColumns(
  code: string,
  config: unknown,
  orgDefaults?: unknown
): ResolvedJournalColumn[] {
  const registry = getColumnRegistry(code);
  const configRecord = asRecord(config);
  const own = sanitizeColumnsConfig(code, configRecord.columns, configRecord);
  const fromOrg = own ? null : sanitizeColumnsConfig(code, orgDefaults, configRecord);
  const source = own ?? fromOrg;

  return registry.map((column) => {
    const defaultLabel = defaultLabelOf(column, configRecord);
    let hidden: boolean;
    if (column.required) {
      hidden = false;
    } else if (source) {
      hidden = source.hidden.includes(column.key);
    } else if (column.legacyFlag) {
      const flag = configRecord[column.legacyFlag.key];
      hidden = typeof flag === "boolean" ? !flag : !column.legacyFlag.defaultVisible;
    } else {
      hidden = false;
    }
    return {
      key: column.key,
      label: source?.labels[column.key] ?? defaultLabel,
      defaultLabel,
      weight: column.weight,
      required: column.required === true,
      hidden,
      align: column.align,
    };
  });
}

/** Только видимые колонки — для таблицы, карточек и печати. */
export function visibleColumns(
  code: string,
  config: unknown,
  orgDefaults?: unknown
): ResolvedJournalColumn[] {
  return resolveColumns(code, config, orgDefaults).filter((column) => !column.hidden);
}

/** Старые флаги `showX` по набору колонок — чтобы печать и адаптеры не отставали. */
export function legacyFlagsFromColumns(
  code: string,
  columns: JournalColumnsConfig
): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const column of getColumnRegistry(code)) {
    if (!column.legacyFlag) continue;
    flags[column.legacyFlag.key] = !columns.hidden.includes(column.key);
  }
  return flags;
}

/** Набор колонок из текущего вида документа — для «сохранить как общий». */
export function columnsConfigFromResolved(columns: ResolvedJournalColumn[]): JournalColumnsConfig {
  return {
    hidden: columns.filter((column) => column.hidden).map((column) => column.key),
    labels: Object.fromEntries(
      columns
        .filter((column) => column.label !== column.defaultLabel)
        .map((column) => [column.key, column.label])
    ),
  };
}

/** Конфиг документа с набором колонок и синхронными старыми флагами (`showX`). */
export function applyColumnsToConfig(
  code: string,
  config: unknown,
  columns: JournalColumnsConfig
): Record<string, unknown> {
  const base = asRecord(config);
  const sanitized = sanitizeColumnsConfig(code, columns, base) ?? { hidden: [], labels: {} };
  return { ...base, columns: sanitized, ...legacyFlagsFromColumns(code, sanitized) };
}

/**
 * Старые переключатели (`showX`) поверх набора колонок — для форм, которые
 * до сих пор правят флаги (диалог создания, настройки из списка документов):
 * без этого флаг, изменённый в форме, проигрывал бы набору колонок.
 */
export function syncColumnsWithLegacyFlags(
  code: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  const columns = sanitizeColumnsConfig(code, config.columns, config);
  if (!columns) return config;
  const hidden = new Set(columns.hidden);
  for (const column of getColumnRegistry(code)) {
    if (!column.legacyFlag) continue;
    const flag = config[column.legacyFlag.key];
    if (typeof flag !== "boolean") continue;
    if (flag) hidden.delete(column.key);
    else hidden.add(column.key);
  }
  return { ...config, columns: { ...columns, hidden: [...hidden] } };
}

/**
 * Общие наборы организации (`Organization.journalColumnsJson`): журналы без
 * реестра колонок и испорченные значения отбрасываются.
 */
export function parseOrgColumnDefaults(raw: unknown): Record<string, JournalColumnsConfig> {
  const out: Record<string, JournalColumnsConfig> = {};
  for (const [code, value] of Object.entries(asRecord(raw))) {
    if (!hasColumnRegistry(code)) continue;
    const sanitized = sanitizeColumnsConfig(code, value);
    if (sanitized) out[code] = sanitized;
  }
  return out;
}

/**
 * Новый документ получает общий набор организации, если своего набора у
 * конфига нет. `respectFlags` — флаги в конфиге выбраны человеком (диалог
 * создания показывает их по общему набору) и важнее набора для своих колонок.
 */
export function withOrgColumnDefault(
  code: string,
  config: Record<string, unknown> | undefined,
  defaults: Record<string, JournalColumnsConfig>,
  options: { respectFlags?: boolean } = {}
): Record<string, unknown> | undefined {
  const columns = defaults[code];
  if (!columns) return config;
  const base = config ?? {};
  if (base.columns && typeof base.columns === "object") return config;
  if (!options.respectFlags) return applyColumnsToConfig(code, base, columns);
  const seeded = syncColumnsWithLegacyFlags(code, { ...base, columns });
  return applyColumnsToConfig(code, base, (seeded.columns as JournalColumnsConfig) ?? columns);
}
