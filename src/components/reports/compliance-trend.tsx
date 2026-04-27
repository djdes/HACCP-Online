"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/compliance-trend";

type Props = {
  points: TrendPoint[];
};

/**
 * E1 — линейный график «записей в журналах за 12 месяцев». Помогает
 * увидеть сезонность («у нас провалы в августе»), общий тренд («росли
 * 6 месяцев, теперь падает»).
 */
export function ComplianceTrend({ points }: Props) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.entries), 1);

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-6">
      <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]">
        Записи за 12 месяцев
      </h2>
      <p className="mt-0.5 text-[13px] text-[#6f7282]">
        Тренд активности и количество уникальных шаблонов журналов.
      </p>

      <div className="mt-4 h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
          >
            <XAxis
              dataKey="monthLabel"
              stroke="#9b9fb3"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#ececf4" }}
            />
            <YAxis
              stroke="#9b9fb3"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, Math.ceil(max * 1.1)]}
            />
            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #ececf4",
                borderRadius: "0.75rem",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#0b1024", fontWeight: 600 }}
              formatter={(value: unknown, name: unknown) => [
                String(value ?? ""),
                name === "entries" ? "Записей" : "Уник. шаблонов",
              ]}
            />
            <Line
              type="monotone"
              dataKey="entries"
              stroke="#5566f6"
              strokeWidth={2.5}
              dot={{ fill: "#5566f6", r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="uniqueTemplates"
              stroke="#7a5cff"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ fill: "#7a5cff", r: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[12px] text-[#6f7282]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-[#5566f6]" />
          Записей в журналах
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-[#7a5cff] opacity-60" />
          Уникальных шаблонов
        </span>
      </div>
    </section>
  );
}
