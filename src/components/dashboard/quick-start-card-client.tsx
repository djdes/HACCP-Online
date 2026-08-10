"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
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

export type QuickStartCategory =
  | "company"
  | "structure"
  | "team"
  | "journals"
  | "documents"
  | "integrations"
  | "advanced";

export type QuickStartItem = {
  id: string;
  icon: keyof typeof ICON_MAP;
  label: string;
  description: string;
  status: "done" | "partial" | "empty" | "info";
  meta?: string;
  href: string;
  cta: string;
  category: QuickStartCategory;
};

const CATEGORY_LABELS: Record<QuickStartCategory, { title: string; subtitle: string }> = {
  company: {
    title: "Компания",
    subtitle: "Реквизиты, чтобы документы выглядели профессионально",
  },
  structure: {
    title: "Структура заведения",
    subtitle: "Цеха, оборудование, продукты — что вы реально ведёте",
  },
  team: {
    title: "Команда",
    subtitle: "Должности и сотрудники",
  },
  journals: {
    title: "Журналы",
    subtitle: "Какие нужны, кто заполняет, как именно",
  },
  documents: {
    title: "Документы",
    subtitle: "Чтобы было что заполнять — нужны открытые документы на период",
  },
  integrations: {
    title: "Интеграции",
    subtitle: "TasksFlow, Telegram — куда уходят задачи",
  },
  advanced: {
    title: "Дополнительно",
    subtitle: "Тонкая настройка по желанию — компания работает и без этого",
  },
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
const BLOCKING_IDS = new Set([
  "company",
  "positions",
  "users",
  "journals",
  "responsibles",
]);

/**
 * COMPACT — для /dashboard. Просто заголовок + progress-bar + большая
 * кнопка «Открыть быстрый старт» → /settings/onboarding. Сворачивается
 * в одну строку с прогрессом, состояние в localStorage переживает
 * reload. Auto-hide когда всё done считает родительский server-component.
 */
export function QuickStartCardCompact({
  items,
  completed,
  total,
}: {
  items: QuickStartItem[];
  completed: number;
  total: number;
}) {
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
      className="relative overflow-hidden rounded-3xl border border-[#5566f6]/25 bg-white shadow-[0_10px_30px_-15px_rgba(85,102,246,0.25)]"
    >
      {/* Лёгкий индиго-подсвет вместо сплошной заливки: карточка
          остаётся заметной, но не спорит с тёмным hero над ней. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 size-[320px] rounded-full bg-[#5566f6] opacity-[0.07] blur-[100px]" />
      </div>
      <div className="relative z-10 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024] sm:text-[20px]">
                Быстрый старт
              </h2>
              <p className="mt-1 text-[13px] text-[#6f7282]">
                {completed} из {total} шагов готово
                {blockedCount > 0 ? ` · ${blockedCount} критичных не настроено` : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f6ff] text-[#5566f6] transition-colors hover:bg-[#eef1ff]"
            aria-label={collapsed ? "Развернуть быстрый старт" : "Свернуть быстрый старт"}
            suppressHydrationWarning
          >
            <ChevronDown
              className={`size-5 transition-transform ${mounted && collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ececf4]">
          <div
            className={`h-full transition-all ${
              percent >= 80
                ? "bg-emerald-400"
                : percent >= 50
                  ? "bg-amber-400"
                  : "bg-[#5566f6]"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {!collapsed ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] leading-relaxed text-[#6f7282]">
              Пошаговое руководство: что нужно настроить чтобы команда могла заполнять журналы.
              {blockedCount > 0
                ? " Без этих шагов система не будет работать корректно."
                : " Закончите оставшиеся пункты когда будет время."}
            </p>
            <Link
              href="/settings/onboarding"
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-[#5566f6] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
            >
              Открыть быстрый старт
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * FULL — для /settings/onboarding. Сгруппирована по категориям
 * (Компания / Структура / Команда / Журналы / Документы / Интеграции /
 * Дополнительно), чтобы не было визуального хаоса. Pipeline на той
 * же странице — основной flow; этот блок — детальный чек-лист.
 *
 * Видна всегда — пользователь специально перешёл сюда чтобы настроить.
 */
export function QuickStartCardFull({
  items,
  completed,
  total,
}: {
  items: QuickStartItem[];
  completed: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const blockedCount = items.filter(
    (i) => i.status === "empty" && BLOCKING_IDS.has(i.id),
  ).length;

  // Группировка по категориям — порядок задаётся объявлением
  // CATEGORY_LABELS, не алфавитом.
  const orderedCategories: QuickStartCategory[] = [
    "company",
    "structure",
    "team",
    "journals",
    "documents",
    "integrations",
    "advanced",
  ];
  const groups = orderedCategories
    .map((cat) => ({
      cat,
      labels: CATEGORY_LABELS[cat],
      items: items.filter((i) => i.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-5 sm:p-7 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024] sm:text-[20px]">
              Чек-лист всех настроек
            </h2>
            <p className="mt-1 text-[13px] text-[#6f7282]">
              {completed} из {total} шагов готово
              {blockedCount > 0
                ? ` · ${blockedCount} критичных не настроено`
                : null}
            </p>
          </div>
        </div>
        <span className="text-[28px] font-semibold tabular-nums text-[#0b1024]">
          {percent}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ececf4]">
        <div
          className={`h-full transition-all ${
            percent >= 80
              ? "bg-emerald-500"
              : percent >= 50
                ? "bg-amber-400"
                : "bg-[#5566f6]"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-6 space-y-6">
        {groups.map((g) => {
          const groupDone = g.items.filter((i) => i.status === "done").length;
          const groupTotal = g.items.filter((i) => i.status !== "info").length;
          return (
            <div key={g.cat}>
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold uppercase tracking-[0.12em] text-[#0b1024]">
                    {g.labels.title}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-[#6f7282]">
                    {g.labels.subtitle}
                  </p>
                </div>
                {groupTotal > 0 ? (
                  <span className="shrink-0 rounded-full bg-[#fafbff] px-2.5 py-1 text-[11px] font-medium text-[#3848c7]">
                    {groupDone} / {groupTotal}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {g.items.map((item) => (
                  <QuickStartItemCardLight key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[12px] text-[#6f7282]">
        Жмите на любую карточку — откроется страница с подсказкой что делать.
      </p>
    </section>
  );
}

function QuickStartItemCardLight({ item }: { item: QuickStartItem }) {
  const Icon = ICON_MAP[item.icon] ?? Briefcase;
  const statusBadge = (() => {
    if (item.status === "done")
      return { label: "✓", cls: "bg-emerald-100 text-emerald-700" };
    if (item.status === "partial")
      return { label: "≈", cls: "bg-amber-100 text-amber-700" };
    if (item.status === "info")
      return { label: "i", cls: "bg-[#f5f6ff] text-[#5566f6]" };
    if (BLOCKING_IDS.has(item.id))
      return { label: "!", cls: "bg-rose-100 text-rose-700" };
    return { label: "·", cls: "bg-[#fafbff] text-[#9b9fb3]" };
  })();

  return (
    <Link
      href={item.href}
      className="group flex items-start gap-3 rounded-2xl border border-[#ececf4] bg-white p-4 transition-colors hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5566f6]">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[#0b1024]">
            {item.label}
          </span>
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
            <span className="ml-auto text-[11px] text-[#6f7282]">
              {item.meta}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] leading-[1.5] text-[#6f7282]">
          {item.description}
        </p>
        <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#5566f6] group-hover:text-[#3848c7]">
          {item.cta}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

// Legacy-name re-export — старый импорт продолжает работать.
export const QuickStartCardClient = QuickStartCardCompact;
