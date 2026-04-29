"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

type Status = "untouched" | "in_progress" | "completed";

type Item = {
  code: string;
  name: string;
  status: Status;
  realCount: number;
  totalCount: number;
  tfCompleted: number;
  tfTotal: number;
  primaryDocumentId: string | null;
};

type Counts = { untouched: number; in_progress: number; completed: number };

export function JournalsProgressClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Counts>({
    untouched: 0,
    in_progress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false, signal?: AbortSignal) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/journals/today-status", {
        cache: "no-store",
        signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Не удалось загрузить");
        return;
      }
      setItems(data.items ?? []);
      setCounts(data.counts ?? { untouched: 0, in_progress: 0, completed: 0 });
    } catch (err) {
      // AbortError при unmount — игнорируем, это штатный сценарий.
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    load(false, ctrl.signal);
    // Авто-обновление раз в 60 секунд — пока заведующая открыла страницу,
    // данные подтягиваются «вживую» по мере того как сотрудники
    // заполняют журналы. Не дёргаем сервер, если вкладка скрыта
    // (visibilityState != 'visible') — экономим запросы.
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      load(true, ctrl.signal);
    }, 60_000);
    return () => {
      clearInterval(interval);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inProgress = items.filter((i) => i.status === "in_progress");
  const completed = items.filter((i) => i.status === "completed");
  const untouched = items.filter((i) => i.status === "untouched");

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ClipboardList className="size-6" />
              </span>
              <div>
                <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                  Прогресс журналов
                </h1>
                <p className="mt-2 max-w-[640px] text-[14px] text-white/70">
                  Сводка за сегодня: какие журналы уже сделаны, какие в
                  процессе, и какие ещё не начинали. Обновляется автоматически
                  раз в минуту.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing || loading}
              className="hidden h-10 items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 text-[13px] text-white hover:bg-white/10 disabled:opacity-60 sm:inline-flex"
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCcw className="size-4" />
              )}
              Обновить
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              tone="success"
              label="Готовы"
              value={counts.completed}
              icon={<CheckCircle2 className="size-4" />}
            />
            <SummaryCard
              tone="warn"
              label="В процессе"
              value={counts.in_progress}
              icon={<Activity className="size-4" />}
            />
            <SummaryCard
              tone="muted"
              label="Не начаты"
              value={counts.untouched}
              icon={<ClipboardList className="size-4" />}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-[#ececf4] bg-white p-16 text-[#6f7282]">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Считаем прогресс…
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Column
            title="Идёт заполнение"
            subtitle="Кто-то уже начал — но не все строки или TasksFlow-задачи закрыты"
            tone="warn"
            items={inProgress}
            emptyHint="Всё либо ещё не начато, либо уже сделано"
          />
          <Column
            title="Готовы"
            subtitle="Все TasksFlow-задачи выполнены или все строки заполнены"
            tone="success"
            items={completed}
            emptyHint="Пока ни один журнал не сделан полностью"
          />
        </div>
      )}

      {!loading && untouched.length > 0 ? (
        <Column
          title="Не начаты"
          subtitle="Сегодня к этим журналам никто не подошёл"
          tone="muted"
          items={untouched}
          emptyHint=""
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "success" | "warn" | "muted";
}) {
  const fg =
    tone === "success"
      ? "text-[#7cf5c0]"
      : tone === "warn"
        ? "text-[#ffd28a]"
        : "text-white/70";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
      <div
        className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${fg}`}
      >
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-[28px] font-semibold leading-none tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Column({
  title,
  subtitle,
  tone,
  items,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  tone: "success" | "warn" | "muted";
  items: Item[];
  emptyHint: string;
}) {
  const headerDot =
    tone === "success"
      ? "bg-[#136b2a]"
      : tone === "warn"
        ? "bg-[#a13a32]"
        : "bg-[#6f7282]";
  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-5 md:p-6">
      <div className="mb-4 flex items-start gap-2">
        <span className={`mt-1.5 size-2 rounded-full ${headerDot}`} />
        <div>
          <h2 className="text-[15px] font-semibold text-[#0b1024]">
            {title}{" "}
            <span className="text-[12px] font-medium text-[#9b9fb3]">
              · {items.length}
            </span>
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[#6f7282]">
            {subtitle}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-6 text-center text-[12px] text-[#9b9fb3]">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <ItemRow key={item.code} item={item} tone={tone} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemRow({
  item,
  tone,
}: {
  item: Item;
  tone: "success" | "warn" | "muted";
}) {
  const href = item.primaryDocumentId
    ? `/journals/${item.code}/documents/${item.primaryDocumentId}`
    : `/journals/${item.code}`;
  const border =
    tone === "success"
      ? "border-[#c8f0d5] bg-[#ecfdf5]/40"
      : tone === "warn"
        ? "border-[#ffe9b0] bg-[#fff8eb]/30"
        : "border-[#ececf4] bg-[#fafbff]";
  return (
    <li>
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-2xl border ${border} p-3 transition-shadow hover:shadow-[0_8px_20px_-12px_rgba(85,102,246,0.18)]`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-tight text-[#0b1024]">
            {item.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6f7282]">
            {item.totalCount > 0 ? (
              <span className="rounded-full bg-white px-2 py-0.5 font-medium text-[#3c4053]">
                строк: {item.realCount}/{item.totalCount}
              </span>
            ) : null}
            {item.tfTotal > 0 ? (
              <span className="rounded-full bg-white px-2 py-0.5 font-medium text-[#3848c7]">
                TasksFlow: {item.tfCompleted}/{item.tfTotal}
              </span>
            ) : null}
            {item.realCount === 0 && item.tfCompleted === 0 ? (
              <span className="text-[#9b9fb3]">пока пусто</span>
            ) : null}
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-[#9b9fb3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
      </Link>
    </li>
  );
}
