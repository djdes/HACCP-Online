import { WEEKDAY_LABELS, normalizeWeeklyDaysOff } from "@/lib/staff-days-off";

/**
 * Разбор вставленных строк с сотрудниками.
 *
 * Модуль чистый и живёт отдельно от роута, потому что нужен обеим
 * сторонам: сервер разбирает загруженный текст, браузер — то, что
 * человек вставил в таблицу из Excel по Ctrl+V. Держать две реализации
 * одного формата значит однажды получить «на сайте распозналось, в
 * файле нет».
 */

export type ParsedStaffRow = {
  fullName: string;
  positionName: string;
  phone: string;
  contactEmail: string;
  weeklyDaysOff: number[];
  telegramInvite: boolean;
};

export type ParseResult = {
  rows: ParsedStaffRow[];
  errors: Array<{ line: number; message: string }>;
};

/** Заголовок — это строка, где вместо данных названия колонок. */
const HEADER_PATTERN = /ФИО|должн|телеф|почт|выходн|name|position|phone|email/i;

/**
 * Разделитель определяем по первой строке. Порядок проверки важен:
 * табуляция бывает только при вставке из таблицы, а точка с запятой —
 * привычный разделитель русского Excel, который в CSV встречается чаще
 * запятой (в ФИО запятых не бывает, а вот в адресах — сколько угодно).
 */
function detectSeparator(sample: string): string {
  if (sample.includes("\t")) return "\t";
  if (sample.includes(";")) return ";";
  return ",";
}

/**
 * Полные названия — рядом с сокращениями: «Сб» и «суббота» друг друга не
 * префиксуют, и одной таблицей сокращений тут не обойтись.
 */
const WEEKDAY_FULL = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
] as const;

const YES = /^(да|yes|true|1|\+|есть|v|✓)$/i;

export function parseYesNo(value: string | null | undefined): boolean {
  return YES.test((value ?? "").trim());
}

/**
 * «Сб, Вс» → [5, 6]. Принимает и русские сокращения, и номера, и
 * «суббота», и «сб вс» без запятых — человек пишет как придётся, а
 * ругаться на формат выходных за него глупо.
 */
export function parseWeeklyDaysOff(value: string | null | undefined): number[] {
  const raw = (value ?? "").trim();
  if (!raw) return [];
  if (/^(нет|без выходных|—|-)$/i.test(raw)) return [];

  const tokens = raw.split(/[,;/\s]+/).filter(Boolean);
  const result: number[] = [];
  for (const token of tokens) {
    const asNumber = Number(token);
    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 6) {
      result.push(asNumber);
      continue;
    }
    const lower = token.toLowerCase();
    const index = WEEKDAY_FULL.findIndex(
      (full, day) =>
        lower === WEEKDAY_LABELS[day].toLowerCase() || full.startsWith(lower)
    );
    if (index >= 0) result.push(index);
  }
  return normalizeWeeklyDaysOff(result);
}

export function formatWeeklyDaysOff(days: number[] | null | undefined): string {
  const normalized = normalizeWeeklyDaysOff(days);
  if (normalized.length === 0) return "";
  return normalized.map((index) => WEEKDAY_LABELS[index]).join(", ");
}

/**
 * Разбор вставленного текста.
 *
 * Обязательных колонок две — ФИО и должность. Телефон необязателен
 * намеренно: одиночное добавление сотрудника его тоже не требует, и
 * расходиться в требованиях между «добавить одного» и «добавить
 * десятерых» нельзя — человек воспримет это как поломку.
 */
export function parseStaffRows(raw: string): ParseResult {
  const errors: ParseResult["errors"] = [];
  const rows: ParsedStaffRow[] = [];

  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows, errors };

  const separator = detectSeparator(lines[0]);
  const startIndex = HEADER_PATTERN.test(lines[0]) ? 1 : 0;

  for (let i = startIndex; i < lines.length; i += 1) {
    const cells = lines[i].split(separator).map((cell) => cell.trim());
    const [fullName, positionName, phone, contactEmail, daysOff, telegram] =
      cells;

    if (!fullName) {
      errors.push({ line: i + 1, message: "Пустое ФИО" });
      continue;
    }
    if (!positionName) {
      errors.push({
        line: i + 1,
        message: `«${fullName}»: не указана должность`,
      });
      continue;
    }

    rows.push({
      fullName,
      positionName,
      phone: phone ?? "",
      contactEmail: contactEmail ?? "",
      weeklyDaysOff: parseWeeklyDaysOff(daysOff),
      telegramInvite: parseYesNo(telegram),
    });
  }

  return { rows, errors };
}
