import type { UptimeStats } from "@/lib/uptime";

function tone(ratio: number | null): string {
  if (ratio === null) return "#ececf4";
  if (ratio >= 0.999) return "#2e9e5b";
  if (ratio >= 0.95) return "#d98a00";
  return "#d2453d";
}

function label(day: { date: string; ratio: number | null; samples: number }): string {
  const d = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("ru-RU", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  if (day.ratio === null) return `${d}: данных нет`;
  return `${d}: ${Math.round(day.ratio * 1000) / 10}% (${day.samples} замеров)`;
}

/** Полоска аптайма за 90 дней: одна ячейка — один день. */
export function UptimeBar({ stats }: { stats: UptimeStats }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium text-[#0b1024]">Доступность за 90 дней</span>
        <span className="text-[13px] tabular-nums text-[#6f7282]">
          30 дней: <b className="text-[#0b1024]">{stats.pct30 === null ? "—" : `${stats.pct30}%`}</b> · 90 дней:{" "}
          <b className="text-[#0b1024]">{stats.pct90 === null ? "—" : `${stats.pct90}%`}</b>
        </span>
      </div>
      <div className="mt-2 flex gap-[2px]" data-testid="uptime-bar" aria-label="Доступность по дням">
        {stats.days.map((day) => (
          <span key={day.date} title={label(day)} className="h-8 flex-1 rounded-[3px]" style={{ background: tone(day.ratio) }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[#9b9fb3]">
        <span>90 дней назад</span>
        <span>сегодня</span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[#9b9fb3]">Замер каждые 5 минут: база данных и Telegram-бот. Серый — замеров ещё не было.</p>
    </div>
  );
}
