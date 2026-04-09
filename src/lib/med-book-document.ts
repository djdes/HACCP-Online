// src/lib/med-book-document.ts

export const MED_BOOK_TEMPLATE_CODE = "med_books";
export const MED_BOOK_DOCUMENT_TITLE = "Мед. книжки";

export const DEFAULT_EXAMINATIONS = [
  "Гинеколог",
  "Стоматолог",
  "Психиатр",
  "Оториноларинголог",
  "Терапевт",
  "Невролог",
  "Нарколог",
  "Дерматовенеролог",
  "Флюорография",
  "Маммография",
];

export const DEFAULT_VACCINATIONS = [
  "Дифтерия",
  "Корь",
  "Дизентерия Зонне",
  "Краснуха",
  "Гепатит B",
  "Гепатит A",
  "Грипп",
  "Коронавирус",
];

export type MedBookExamination = {
  date: string | null;
  expiryDate: string | null;
};

export type MedBookVaccinationType = "done" | "refusal" | "exemption";

export type MedBookVaccination = {
  type: MedBookVaccinationType;
  dose?: string | null;
  date?: string | null;
  expiryDate?: string | null;
};

export type MedBookEntryData = {
  positionTitle: string;
  birthDate: string | null;
  gender: "male" | "female" | null;
  hireDate: string | null;
  medBookNumber: string | null;
  photoUrl: string | null;
  examinations: Record<string, MedBookExamination>;
  vaccinations: Record<string, MedBookVaccination>;
  note: string | null;
};

export type MedBookDocumentConfig = {
  examinations: string[];
  vaccinations: string[];
  includeVaccinations: boolean;
};

export function getDefaultMedBookConfig(): MedBookDocumentConfig {
  return {
    examinations: [...DEFAULT_EXAMINATIONS],
    vaccinations: [...DEFAULT_VACCINATIONS],
    includeVaccinations: true,
  };
}

export function normalizeMedBookConfig(raw: unknown): MedBookDocumentConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return getDefaultMedBookConfig();
  }
  const obj = raw as Record<string, unknown>;
  return {
    examinations: Array.isArray(obj.examinations)
      ? (obj.examinations as string[]).filter((v) => typeof v === "string")
      : [...DEFAULT_EXAMINATIONS],
    vaccinations: Array.isArray(obj.vaccinations)
      ? (obj.vaccinations as string[]).filter((v) => typeof v === "string")
      : [...DEFAULT_VACCINATIONS],
    includeVaccinations:
      typeof obj.includeVaccinations === "boolean"
        ? obj.includeVaccinations
        : true,
  };
}

export function normalizeMedBookEntryData(raw: unknown): MedBookEntryData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyMedBookEntry("");
  }
  const obj = raw as Record<string, unknown>;
  return {
    positionTitle: typeof obj.positionTitle === "string" ? obj.positionTitle : "",
    birthDate: typeof obj.birthDate === "string" ? obj.birthDate : null,
    gender:
      obj.gender === "male" || obj.gender === "female" ? obj.gender : null,
    hireDate: typeof obj.hireDate === "string" ? obj.hireDate : null,
    medBookNumber:
      typeof obj.medBookNumber === "string" ? obj.medBookNumber : null,
    photoUrl: typeof obj.photoUrl === "string" ? obj.photoUrl : null,
    examinations: normalizeExaminationsMap(obj.examinations),
    vaccinations: normalizeVaccinationsMap(obj.vaccinations),
    note: typeof obj.note === "string" ? obj.note : null,
  };
}

function normalizeExaminationsMap(
  raw: unknown
): Record<string, MedBookExamination> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, MedBookExamination> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const v = val as Record<string, unknown>;
    result[key] = {
      date: typeof v.date === "string" ? v.date : null,
      expiryDate: typeof v.expiryDate === "string" ? v.expiryDate : null,
    };
  }
  return result;
}

function normalizeVaccinationsMap(
  raw: unknown
): Record<string, MedBookVaccination> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, MedBookVaccination> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const v = val as Record<string, unknown>;
    const type = v.type;
    if (type !== "done" && type !== "refusal" && type !== "exemption") continue;
    result[key] = {
      type,
      dose: typeof v.dose === "string" ? v.dose : null,
      date: typeof v.date === "string" ? v.date : null,
      expiryDate: typeof v.expiryDate === "string" ? v.expiryDate : null,
    };
  }
  return result;
}

export function emptyMedBookEntry(positionTitle: string): MedBookEntryData {
  return {
    positionTitle,
    birthDate: null,
    gender: null,
    hireDate: null,
    medBookNumber: null,
    photoUrl: null,
    examinations: {},
    vaccinations: {},
    note: null,
  };
}

export function isExaminationExpired(exam: MedBookExamination): boolean {
  if (!exam.expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return exam.expiryDate < today;
}

export function isExaminationExpiringSoon(
  exam: MedBookExamination,
  daysThreshold = 30
): boolean {
  if (!exam.expiryDate) return false;
  const today = new Date();
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + daysThreshold);
  const thresholdStr = threshold.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  return exam.expiryDate >= todayStr && exam.expiryDate <= thresholdStr;
}

export function formatMedBookDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
}

export const VACCINATION_TYPE_LABELS: Record<MedBookVaccinationType, string> = {
  done: "Вакцинация",
  refusal: "Отказ сотрудника",
  exemption: "Мед. отвод",
};

export const EXAMINATION_REFERENCE_DATA = [
  { name: "Гинеколог", periodicity: "осмотр 1 раз в год", note: "только женщины" },
  { name: "Стоматолог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Психиатр", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Оториноларинголог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Терапевт", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Невролог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Нарколог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Дерматовенеролог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Исследования на гельминто-возы", periodicity: "при поступлении на работу, затем 1 раз в год", note: "" },
  { name: "Профпатолог", periodicity: "осмотр 1 раз в год", note: "заключение о прохождении медицинской комиссии" },
  { name: "Флюорография", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Исследования на стафилококк", periodicity: "при поступлении на работу", note: "в дальнейшем по медицинским и эпид. показаниям" },
  { name: "Бактериологическое исследование на диз.группу", periodicity: "при поступлении на работу", note: "в дальнейшем по эпид. показаниям" },
  { name: "Брюшной тиф", periodicity: "при поступлении на работу", note: "в дальнейшем по эпид. показаниям" },
  {
    name: "Гигиеническая подготовка (сан.минимум)",
    periodicity: "осмотр 1 раз / 1 раз в 2 года",
    note: "для работников деятельность, которых связана с производством, хранением, транспортировкой и реализацией мясо - молочной и кремово - кондитерской продукции, детского питания, питания дошкольников - 1 раз в год; для остальных категорий работников - 1 раз в 2 года",
  },
];

export const VACCINATION_REFERENCE_DATA = [
  {
    name: "ДИФТЕРИЯ (АДСМ анатоксин: дифтерийно-столбнячная малотоксичная)",
    periodicity: "Привитым лицам ревакцинация проводится без ограничения возраста каждые 10 лет от момента последней ревакцинации. Лицам не привитым и без сведений о прививках проводится курс из 3 прививок: 2 прививки в цикле вакцинации, проведённые с интервалом в 1,5 месяца и последующая ревакцинация через 6-9 месяцев после законченной вакцинации.",
  },
  {
    name: "КОРЬ (ЖКВ-живая коревая вакцина)",
    periodicity: "Необходимо 2 прививки. Интервал между первой прививкой (вакцинацией) и второй прививкой (ревакцинацией) составляет не менее 3 месяцев. В ВОЗРАСТЕ ДО 55 ЛЕТ.",
  },
  { name: "Дизентерия Зонне", periodicity: "Ежегодно" },
  {
    name: "КРАСНУХА",
    periodicity: "Необходимо 2 прививки женщинам до 25 лет. Интервал между первой прививкой (вакцинацией) и второй прививкой (ревакцинацией) составляет не менее 3 месяцев.",
  },
  {
    name: "ГЕПАТИТ В",
    periodicity: "Лицам до 55 лет необходимо 3 прививки по схеме 0-1 месяц - 6 месяцев (V1-V2-V3)",
  },
  {
    name: "ГЕПАТИТ А",
    periodicity: "Необходимо 2 прививки с интервалом между прививками 6-12 месяцев (V1-V2)",
  },
  {
    name: "Вакцинация от гриппа",
    periodicity: "Взрослые ежегодно, осенне-зимний период",
  },
  {
    name: "Вакцинация от коронавируса",
    periodicity: "Взрослые от 18 лет и старше, с совокупно не менее 80% от общей численности работников.",
  },
];

export const MED_BOOK_VACCINATION_RULES = [
  "В ОДИН ДЕНЬ МОЖНО ДЕЛАТЬ НЕ БОЛЕЕ 4 ПРИВИВОК ПРОТИВ РАЗНЫХ ИНФЕКЦИЙ: 2 ПОД ЛОПАТКУ (ПРАВУЮ И ЛЕВУЮ) И 2 В ПЛЕЧО (ПРАВОЕ И ЛЕВОЕ)",
  "ИНТЕРВАЛ МЕЖДУ ПРИВИВКАМИ РАЗНЫХ ИНФЕКЦИЙ СОСТАВЛЯЕТ НЕ МЕНЕЕ 1 МЕСЯЦА",
];
