import { db } from "@/lib/db";

/**
 * История аптайма: крон раз в 5 минут пишет замер (база, Telegram-бот),
 * страница /status показывает 90 дней и проценты. Дни без замеров после
 * первого известного считаются недоступными: если процесс лежал, замеров
 * нет, и это тоже простой.
 */
export const SAMPLE_INTERVAL_MIN = 5;
export const SAMPLES_PER_DAY = (24 * 60) / SAMPLE_INTERVAL_MIN;
export const UPTIME_DAYS = 90;

export type UptimeSampleRow = { at: Date; ok: boolean };
export type UptimeDay = { date: string; samples: number; okSamples: number; /** null — данных ещё не было (до первого замера). */ ratio: number | null };
export type UptimeStats = { days: UptimeDay[]; pct30: number | null; pct90: number | null; firstSampleAt: string | null };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeUptime(samples: UptimeSampleRow[], now: Date, days: number = UPTIME_DAYS): UptimeStats {
  const byDay = new Map<string, { samples: number; ok: number }>();
  let first: Date | null = null;
  for (const s of samples) {
    const key = isoDay(s.at);
    const row = byDay.get(key) ?? { samples: 0, ok: 0 };
    row.samples += 1;
    if (s.ok) row.ok += 1;
    byDay.set(key, row);
    if (!first || s.at < first) first = s.at;
  }
  const today = isoDay(now);
  const out: UptimeDay[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = isoDay(d);
    const row = byDay.get(key);
    if (!first || key < isoDay(first)) {
      out.push({ date: key, samples: 0, okSamples: 0, ratio: null });
      continue;
    }
    // Сегодня — по факту замеров; прошлые дни — от ожидаемого числа замеров.
    const expected = key === today ? Math.max(row?.samples ?? 0, 1) : SAMPLES_PER_DAY;
    const ok = row?.ok ?? 0;
    out.push({ date: key, samples: row?.samples ?? 0, okSamples: ok, ratio: Math.min(1, ok / expected) });
  }
  const pct = (span: number): number | null => {
    const known = out.slice(-span).filter((d) => d.ratio !== null);
    if (known.length === 0) return null;
    return Math.round((known.reduce((s, d) => s + (d.ratio ?? 0), 0) / known.length) * 1000) / 10;
  };
  return { days: out, pct30: pct(30), pct90: pct(90), firstSampleAt: first ? first.toISOString() : null };
}

export async function takeUptimeSample(input: { ok: boolean; dbMs: number | null; telegramOk: boolean }): Promise<void> {
  await db.uptimeSample.create({ data: { ok: input.ok, dbMs: input.dbMs, telegramOk: input.telegramOk } });
  // Держим 100 дней — больше на странице не показываем.
  await db.uptimeSample.deleteMany({ where: { at: { lt: new Date(Date.now() - 100 * 86_400_000) } } });
}

export async function loadUptime(now: Date = new Date()): Promise<UptimeStats> {
  const since = new Date(now.getTime() - UPTIME_DAYS * 86_400_000);
  const rows = await db.uptimeSample.findMany({ where: { at: { gte: since } }, select: { at: true, ok: true }, orderBy: { at: "asc" } });
  return computeUptime(rows, now);
}
