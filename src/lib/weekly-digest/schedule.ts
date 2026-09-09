/**
 * Когда слать еженедельный отчёт: понедельник 08:00 по часовому поясу
 * организации. Крон дёргает маршрут каждый час, а решение «сейчас ли»
 * принимается здесь — по локальному времени каждой организации.
 */
export const DIGEST_WEEKDAY = 1; // понедельник
export const DIGEST_HOUR = 8;
/** Повторно в ту же неделю не шлём: между отправками не меньше шести дней. */
export const DIGEST_MIN_GAP_MS = 6 * 24 * 60 * 60 * 1000;

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(now: Date, timeZone: string): { weekday: number; hour: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  }
  const weekday = WEEKDAYS[parts.find((p) => p.type === "weekday")?.value ?? "Mon"] ?? 1;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  return { weekday, hour };
}

export function isDigestSlot(now: Date, timeZone: string): boolean {
  const { weekday, hour } = localParts(now, timeZone);
  return weekday === DIGEST_WEEKDAY && hour === DIGEST_HOUR;
}

export function shouldSendWeeklyDigest(input: {
  now: Date;
  timeZone: string;
  lastSentAt: Date | null;
  force?: boolean;
}): { send: boolean; reason: "force" | "slot" | "not-slot" | "sent-recently" } {
  if (input.force) return { send: true, reason: "force" };
  if (input.lastSentAt && input.now.getTime() - input.lastSentAt.getTime() < DIGEST_MIN_GAP_MS) {
    return { send: false, reason: "sent-recently" };
  }
  return isDigestSlot(input.now, input.timeZone) ? { send: true, reason: "slot" } : { send: false, reason: "not-slot" };
}
