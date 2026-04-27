"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  XCircle,
} from "lucide-react";
import type { HealthCheck } from "@/lib/org-health-check";

type Props = {
  checks: HealthCheck[];
  scorePercent: number;
  okCount: number;
  totalCount: number;
};

/**
 * Виджет «Здоровье настройки» на /dashboard. Свёрнутый по умолчанию —
 * показывает только score «8/12» и одну строку «нажмите чтобы развернуть».
 * Развёрнутый — список всех проверок с emoji-статусами и ссылками
 * «настроить → ведёт на нужную страницу».
 */
export function OrgHealthWidget({
  checks,
  scorePercent,
  okCount,
  totalCount,
}: Props) {
  const [open, setOpen] = useState(false);

  const tone =
    scorePercent >= 90
      ? { bg: "#ecfdf5", fg: "#116b2a", label: "отлично" }
      : scorePercent >= 60
        ? { bg: "#fff8eb", fg: "#7a4a00", label: "почти готово" }
        : { bg: "#fff4f2", fg: "#a13a32", label: "нужна донастройка" };

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          <HeartPulse className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0b1024]">
            Здоровье настройки: {okCount}/{totalCount}
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: tone.bg, color: tone.fg }}
            >
              {scorePercent}% — {tone.label}
            </span>
          </div>
          <div className="mt-0.5 text-[12px] text-[#6f7282]">
            {open
              ? "Кликните строку чтобы перейти на настройку"
              : "Кликните чтобы посмотреть список"}
          </div>
          {/* F5 — progress-bar «настройки готовы X%». Визуал прогресса
              делает онбординг ощутимее: «осталось 20% и я готов». */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#ececf4]">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${scorePercent}%`,
                backgroundColor: tone.fg,
              }}
            />
          </div>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-[#9b9fb3]" />
        ) : (
          <ChevronDown className="size-4 text-[#9b9fb3]" />
        )}
      </button>

      {open ? (
        <ul className="mt-4 space-y-1.5">
          {checks.map((c) => {
            const Icon =
              c.status === "ok"
                ? CheckCircle2
                : c.status === "warn"
                  ? AlertCircle
                  : XCircle;
            const fg =
              c.status === "ok"
                ? "#116b2a"
                : c.status === "warn"
                  ? "#7a4a00"
                  : "#a13a32";
            const inner = (
              <span className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[#fafbff]">
                <Icon
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: fg }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-[#0b1024]">
                    {c.title}
                  </span>
                  <span className="block text-[12px] text-[#6f7282]">
                    {c.hint}
                  </span>
                </span>
              </span>
            );
            return (
              <li key={c.id}>
                {c.href && c.status !== "ok" ? (
                  <Link href={c.href} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
