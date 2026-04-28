"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Thermometer,
  Repeat,
  Zap,
} from "lucide-react";

type Anomaly = {
  kind: "temperature_out_of_range" | "identical_streak" | "bulk_fill_burst";
  severity: "warn" | "info";
  templateCode: string;
  templateName: string;
  documentId: string;
  documentTitle: string;
  employeeId: string;
  employeeName: string;
  date: string;
  message: string;
  context: Record<string, string | number>;
};

type Response = {
  scanned: number;
  anomalies: Anomaly[];
  windowDays: number;
};

const KIND_META = {
  temperature_out_of_range: {
    icon: Thermometer,
    label: "Температура",
  },
  identical_streak: {
    icon: Repeat,
    label: "Дублирование",
  },
  bulk_fill_burst: {
    icon: Zap,
    label: "Массовое заполнение",
  },
} as const;

function pluralRu(one: string, few: string, many: string) {
  return (count: number) => {
    const abs = Math.abs(count) % 100;
    const lastDigit = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (lastDigit === 1) return one;
    if (lastDigit >= 2 && lastDigit <= 4) return few;
    return many;
  };
}
const findingWord = pluralRu("находка", "находки", "находок");

/**
 * «Подозрительные записи» — компактный виджет на дашборде. Live-fetch
 * через /api/dashboard/anomalies, развёрнутый список топ-5 находок,
 * остальные — за «Ещё N» сворачиванием. Иконка + цвет — по типу:
 * warn (температура out-of-range) красным, info (streak/burst) серым-
 * синим. Каждая строка кликабельна — открывает документ за нужную дату.
 */
export function AnomaliesCard() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/anomalies", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch_failed");
        const j = (await res.json()) as Response;
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setError("Не удалось загрузить");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#ececf4] bg-white px-5 py-4 text-[13px] text-[#6f7282] shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Сканирую записи…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const items = data.anomalies;
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-[#c8f0d5] bg-[#ecfdf5] px-5 py-4 shadow-[0_0_0_1px_rgba(124,245,192,0.3)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#d9f4e1] text-[#136b2a]">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <div className="text-[14px] font-semibold text-[#136b2a]">
              Подозрительных записей не найдено
            </div>
            <div className="mt-0.5 text-[12px] text-[#136b2a]/80">
              Просканировано {data.scanned.toLocaleString("ru-RU")} записей за
              последние {data.windowDays} дней. Журналы выглядят живыми и
              разнообразными.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visible = expanded ? items : items.slice(0, 5);
  const warnCount = items.filter((a) => a.severity === "warn").length;

  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
              warnCount > 0
                ? "bg-[#fff4f2] text-[#d2453d]"
                : "bg-[#eef1ff] text-[#3848c7]"
            }`}
          >
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-[#0b1024]">
              Подозрительные записи
            </div>
            <div className="mt-0.5 text-[12px] text-[#6f7282]">
              {items.length} {findingWord(items.length)} за {data.windowDays} дней.
              Кликните, чтобы открыть документ.
            </div>
          </div>
        </div>
        {warnCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4f2] px-2.5 py-1 text-[11px] font-medium text-[#d2453d]">
            <AlertTriangle className="size-3" />
            требует проверки: {warnCount}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {visible.map((a, idx) => {
          const Meta = KIND_META[a.kind];
          const Icon = Meta.icon;
          return (
            <Link
              key={`${a.documentId}-${a.employeeId}-${a.date}-${idx}`}
              href={`/journals/${a.templateCode}/documents/${a.documentId}`}
              className={`group flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition-all hover:shadow-[0_6px_20px_-12px_rgba(85,102,246,0.25)] ${
                a.severity === "warn"
                  ? "border-[#ffd2cd] bg-[#fff4f2] hover:border-[#ff8d7d]"
                  : "border-[#ececf4] bg-[#fafbff] hover:border-[#5566f6]/40"
              }`}
            >
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${
                  a.severity === "warn"
                    ? "bg-[#ffe1dc] text-[#d2453d]"
                    : "bg-[#eef1ff] text-[#3848c7]"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-medium text-[#0b1024]">
                    {a.templateName}
                  </span>
                  <span className="text-[11px] text-[#9b9fb3]">·</span>
                  <span className="text-[12px] text-[#6f7282]">
                    {a.employeeName}
                  </span>
                  <span className="text-[11px] text-[#9b9fb3]">·</span>
                  <span className="font-mono text-[11px] text-[#9b9fb3]">
                    {a.date}
                  </span>
                </div>
                <div
                  className={`mt-1 text-[12px] leading-snug ${
                    a.severity === "warn" ? "text-[#a13a32]" : "text-[#3c4053]"
                  }`}
                >
                  {a.message}
                </div>
              </div>
              <ArrowRight className="mt-2 size-4 shrink-0 text-[#9b9fb3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
            </Link>
          );
        })}
      </div>

      {items.length > 5 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[#3848c7] hover:underline"
        >
          {expanded ? "Свернуть" : `Ещё ${items.length - 5}`}
        </button>
      ) : null}
    </div>
  );
}
