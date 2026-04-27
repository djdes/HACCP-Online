import type { WeekdayHeatmapRow } from "@/lib/compliance-heatmap";

type Props = {
  rows: WeekdayHeatmapRow[];
  weekdayLabels: readonly string[];
};

/**
 * Heatmap «по дням недели» — какой % дней-этого-дня-недели каждый
 * шаблон заполняется. Помогает увидеть «у нас завал по health_check
 * каждый понедельник».
 *
 * Сортировка: сверху самые проблемные шаблоны (низкое среднее).
 */
export function WeekdayHeatmap({ rows, weekdayLabels }: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]">
            По дням недели (8 нед.)
          </h2>
          <p className="mt-0.5 text-[13px] text-[#6f7282]">
            Какой % дней этого дня недели каждый журнал заполняется.
            Низкие значения — паттерн пропусков.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#6f7282]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-[#fda5a5]" /> 0–40%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-[#fde68a]" /> 40–80%
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-[#86efac]" /> 80–100%
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white pr-3 text-left font-medium text-[#6f7282]">
                Журнал
              </th>
              {weekdayLabels.map((label) => (
                <th
                  key={label}
                  className="px-3 py-2 text-center font-medium text-[#6f7282]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.templateCode}>
                <td className="sticky left-0 z-10 max-w-[200px] truncate bg-white py-1 pr-3 text-[#0b1024]">
                  <span title={row.templateName}>{row.templateName}</span>
                </td>
                {row.cells.map((c) => {
                  const bg =
                    c.pct >= 80
                      ? "#86efac"
                      : c.pct >= 40
                        ? "#fde68a"
                        : "#fda5a5";
                  const fg = c.pct >= 60 ? "#0b1024" : "#3c4053";
                  return (
                    <td
                      key={c.weekday}
                      className="p-1 text-center"
                      style={{ minWidth: "44px" }}
                    >
                      <div
                        className="rounded-md px-2 py-1.5 text-[13px] font-semibold tabular-nums"
                        style={{ backgroundColor: bg, color: fg }}
                        title={`${c.pct}% (${c.sampleSize} дней)`}
                      >
                        {c.pct}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
