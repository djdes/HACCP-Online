/**
 * Сборка iCalendar (RFC 5545) — чистые функции без сети и базы.
 *
 * Все события — на весь день (`DTSTART;VALUE=DATE`): сроки медкнижек,
 * поверок, подписки и т.п. не имеют времени. UID стабилен между
 * выгрузками, поэтому календарь обновляет событие, а не плодит копии.
 */
export type CalendarEventKind = "subscription" | "medbook" | "calibration" | "competency" | "capa" | "batch";

export type CalendarEvent = {
  /** Стабильный идентификатор: `<kind>-<id>`; домен добавит сборка. */
  uid: string;
  kind: CalendarEventKind;
  /** ГГГГ-ММ-ДД. */
  date: string;
  title: string;
  description?: string;
};

export const CALENDAR_KIND_LABEL: Record<CalendarEventKind, string> = {
  subscription: "Подписка",
  medbook: "Медкнижки",
  calibration: "Поверки",
  competency: "Обучение и допуски",
  capa: "Корректирующие действия",
  batch: "Сроки годности партий",
};

const CRLF = "\r\n";

/** Экранирование текста по RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Строка длиннее 75 байт переносится с пробелом в начале продолжения (§3.1). */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const limit = first ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // Не резать многобайтовый символ UTF-8: откатываемся к началу символа.
    while (end < bytes.length && end > start && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push((first ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
    first = false;
  }
  return parts.join(CRLF);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function icsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function icsStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildIcs(
  events: CalendarEvent[],
  options: { calendarName: string; now: Date; domain?: string }
): string {
  const domain = options.domain ?? "wesetup.ru";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WeSetup//Календарь сроков//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    "X-WR-TIMEZONE:Europe/Moscow",
    "X-PUBLISHED-TTL:PT6H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];
  const stamp = icsStamp(options.now);
  const sorted = [...events].filter((e) => isIsoDate(e.date)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.uid.localeCompare(b.uid)));
  for (const event of sorted) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}@${domain}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(nextDay(event.date))}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push(`CATEGORIES:${escapeIcsText(CALENDAR_KIND_LABEL[event.kind])}`);
    lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
