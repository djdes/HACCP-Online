"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  Sparkles,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  CalendarRange,
  ClipboardList,
  FileText,
  ListChecks,
  Send,
  Settings2,
  ShieldCheck,
  Users as UsersIcon,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type QuickStartItem = {
  id: string;
  icon: keyof typeof ICON_MAP;
  label: string;
  description: string;
  status: "done" | "partial" | "empty" | "info";
  meta?: string;
  href: string;
  cta: string;
};

const ICON_MAP: Record<string, LucideIcon> = {
  Briefcase,
  Building2,
  UsersIcon,
  ClipboardList,
  Settings2,
  Workflow,
  Send,
  ShieldCheck,
  Boxes,
  CalendarRange,
  FileText,
  ListChecks,
  Wrench,
  Bell,
};

const STORAGE_KEY = "wesetup.quick-start-collapsed";

export function QuickStartCardClient({
  items,
  completed,
  total,
}: {
  items: QuickStartItem[];
  completed: number;
  total: number;
}) {
  // Default false (expanded) — после регистрации сразу видно куда жать.
  // Если юзер свернул вручную — сохраняется в localStorage и при reload
  // остаётся свёрнутой. Если в localStorage 'true' — стартует свёрнутой.
  // mounted flag нужен чтобы избежать SSR/CSR mismatch и flash.
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
    }
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) window.localStorage.setItem(STORAGE_KEY, "true");
        else window.localStorage.removeItem(STORAGE_KEY);
      }
      return next;
    });
  }

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const blockedCount = items.filter(
    (i) => i.status === "empty" && BLOCKING_IDS.has(i.id),
  ).length;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-[#5566f6]/20 text-white shadow-[0_20px_60px_-30px_rgba(85,102,246,0.55)] ${
        collapsed ? "" : "bg-gradient-to-br from-[#1a1f3a] via-[#0b1024] to-[#0b1024]"
      } ${collapsed ? "bg-white text-[#0b1024] border-[#dcdfed]" : ""}`}
    >
      {!collapsed ? (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 size-[420px] rounded-full bg-[#5566f6] opacity-30 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-20 blur-[140px]" />
        </div>
      ) : null}
      <div className="relative z-10 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 items-center justify-center rounded-2xl ${
                collapsed ? "bg-[#eef1ff] text-[#5566f6]" : "bg-white/10 ring-1 ring-white/20"
              }`}
            >
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2
                className={`text-[18px] font-semibold tracking-[-0.02em] sm:text-[20px] ${collapsed ? "text-[#0b1024]" : "text-white"}`}
              >
                Быстрый старт
              </h2>
              <p
                className={`mt-1 text-[13px] ${collapsed ? "text-[#6f7282]" : "text-white/70"}`}
              >
                {completed} из {total} шагов готово
                {blockedCount > 0 ? ` · ${blockedCount} критичных не настроено` : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
              collapsed
                ? "bg-[#f5f6ff] text-[#5566f6] hover:bg-[#eef1ff]"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
            aria-label={collapsed ? "Развернуть быстрый старт" : "Свернуть быстрый старт"}
            // suppressHydrationWarning — initial server HTML может
            // отличаться от localStorage-derived state на клиенте.
            suppressHydrationWarning
          >
            <ChevronDown
              className={`size-5 transition-transform ${mounted && collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Progress bar — виден всегда, в обоих state'ах */}
        <div
          className={`mt-4 h-2 overflow-hidden rounded-full ${
            collapsed ? "bg-[#ececf4]" : "bg-white/10"
          }`}
        >
          <div
            className={`h-full transition-all ${
              percent >= 80 ? "bg-emerald-400" : percent >= 50 ? "bg-amber-300" : "bg-[#5566f6]"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Сворачиваемый контент */}
        {!collapsed ? (
          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {items.map((item) => (
                <QuickStartItemCard key={item.id} item={item} />
              ))}
            </div>
            <p className="text-[12px] text-white/60">
              Жмите на любую карточку — откроется страница с подсказкой что делать.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const BLOCKING_IDS = new Set([
  "company",
  "positions",
  "users",
  "journals",
  "responsibles",
]);

function QuickStartItemCard({ item }: { item: QuickStartItem }) {
  const Icon = ICON_MAP[item.icon] ?? Briefcase;
  const statusBadge = (() => {
    if (item.status === "done") return { label: "✓", cls: "bg-emerald-400/20 text-emerald-300" };
    if (item.status === "partial") return { label: "≈", cls: "bg-amber-400/20 text-amber-300" };
    if (item.status === "info") return { label: "i", cls: "bg-white/15 text-white/80" };
    if (BLOCKING_IDS.has(item.id))
      return { label: "!", cls: "bg-rose-400/20 text-rose-300" };
    return { label: "·", cls: "bg-white/15 text-white/70" };
  })();

  return (
    <Link
      href={item.href}
      className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-[#5566f6]/40 hover:bg-white/10"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-white">{item.label}</span>
          <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${statusBadge.cls}`}
            aria-label={
              item.status === "done"
                ? "готово"
                : item.status === "partial"
                  ? "частично"
                  : item.status === "info"
                    ? "по желанию"
                    : "не настроено"
            }
          >
            {statusBadge.label}
          </span>
          {item.meta ? (
            <span className="ml-auto text-[11px] text-white/50">{item.meta}</span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] leading-[1.5] text-white/65">{item.description}</p>
        <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#a7b2ff] group-hover:text-white">
          {item.cta}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

// Suppress unused warnings — these are exported for typing.
void CheckCircle2;
void Circle;
