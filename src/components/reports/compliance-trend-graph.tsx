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

/**
 * Полотно графика тренда — вынесено из `compliance-trend.tsx` по той же
 * причине, что и `temperature-chart-graph.tsx`: `recharts` (359 КБ /
 * 107 КБ gzip) не должен лежать в общем чанке страницы отчётов и
 * скачиваться до того, как график попал на экран.
 *
 * Родитель подключает модуль через `next/dynamic({ ssr: false })`.
 */
export function ComplianceTrendGraph({ points }: { points: TrendPoint[] }) {
  const max = Math.max(...points.map((p) => p.entries), 1);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
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
  );
}
