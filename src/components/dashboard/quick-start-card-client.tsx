"use client";

import Link from "next/link";
import {
  ArrowRight,
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

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[#5566f6]/25 bg-white shadow-[0_10px_30px_-15px_rgba(85,102,246,0.25)]"
    >
      {/* Лёгкий индиго-подсвет вместо сплошной заливки: карточка
          остаётся заметной, но не спорит с тёмным hero над ней. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 size-[320px] rounded-full bg-[#5566f6] opacity-[0.07] blur-[100px]" />
      </div>
      {/* Три колонки на одной линии: слева — что настраиваем, по центру
          прогресс во всю оставшуюся ширину, справа — действие. Раньше
          полоса лежала отдельной строкой под заголовком и читалась как
          не связанная ни с текстом слева, ни с кнопкой справа. */}
      <div className="relative z-10 p-4 sm:p-5">
        {/* На sm+ полоса стоит ровно по центру блока: боковые группы
            одной ширины (260px), левая прижата влево, правая вправо.
            Пока ширины были разные, «центр» полосы уезжал вслед за
            длиной заголовка.

            На мобиле не колонка, а обёртка: заголовок и «Завершить»
            держатся в одной строке, полоса уходит вниз. Колонкой кнопка
            падала третьей строкой под прогресс-баром — до неё надо было
            доскроллить, и главное действие карточки терялось. */}
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:w-[260px] sm:flex-none sm:shrink-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5566f6]">
              <Sparkles className="size-4" />
            </span>
            {/* whitespace-nowrap: «Завершите начальную настройку» ломалось
                на две строки и перекашивало всю полосу. Заголовок
                укорочен до одной строки — смысл тот же. */}
            <h2 className="truncate whitespace-nowrap text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024] sm:text-[16px]">
              Начальная настройка
            </h2>
          </div>

          {/* Процент вынут из потока: в колонке он поднимал полосу над
              центром блока. Абсолютом он висит над ней, а сама полоса
              остаётся единственным содержимым и центрируется и по
              горизонтали, и по вертикали. */}
          {/* order-last + basis-full: на мобиле полоса встаёт отдельной
              второй строкой во всю ширину, mt компенсирует висящий над
              ней абсолютный «NN%» — иначе процент налезал бы на строку
              заголовка. */}
          <div className="relative flex min-w-0 flex-1 items-center max-sm:order-last max-sm:mt-2 max-sm:basis-full">
            <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-full text-center text-[11px] font-semibold tabular-nums text-[#6f7282]">
              {percent}%
            </span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#ececf4]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percent >= 80
                    ? "bg-emerald-400"
                    : percent >= 50
                      ? "bg-amber-400"
                      : "bg-[#5566f6]"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end sm:w-[260px]">
            <Link
              href="/settings/onboarding"
              // max-sm:w-auto — на 360px «Начальная настройка» и
              // «Завершить →» помещаются в одну строку только если кнопка
              // сжимается по содержимому.
              className="inline-flex h-10 w-[180px] items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] max-sm:w-auto"
            >
              Завершить
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
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
