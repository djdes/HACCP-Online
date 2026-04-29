"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Filter,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type Task = {
  journalCode: string;
  journalLabel: string;
  scopeKey: string;
  scopeLabel: string;
  sublabel?: string;
  journalDocumentId?: string;
  status: "not_taken" | "in_progress" | "pending_review" | "approved" | "rejected" | "completed";
  assigneeId: string | null;
  assigneeName: string | null;
  claimId: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  overdueInProgress: boolean;
};

type Sub = {
  id: string;
  name: string;
  preset: string;
  positionLabel: string;
  hasTelegram: boolean;
  inProgressCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  notStarted: boolean;
};

type Resp = {
  today: string;
  tasks: Task[];
  subordinates: Sub[];
  summary: {
    total: number;
    notTaken: number;
    inProgress: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    overdue: number;
    notStartedCount: number;
    noTelegramCount: number;
  };
};

type StatusFilter = "all" | "problems" | "not_taken" | "in_progress" | "pending_review";

const STATUS_META: Record<
  Task["status"],
  { label: string; bg: string; border: string; text: string; icon: typeof Activity }
> = {
  not_taken: {
    label: "Не взято",
    bg: "bg-[#fff8eb]",
    border: "border-[#ffe9b0]",
    text: "text-[#a13a32]",
    icon: AlertTriangle,
  },
  in_progress: {
    label: "В работе",
    bg: "bg-[#eef1ff]",
    border: "border-[#5566f6]/30",
    text: "text-[#3848c7]",
    icon: Activity,
  },
  pending_review: {
    label: "Ждёт проверки",
    bg: "bg-[#f5f0ff]",
    border: "border-[#b496e6]/40",
    text: "text-[#5d3ab3]",
    icon: ClipboardCheck,
  },
  approved: {
    label: "Одобрено",
    bg: "bg-[#ecfdf5]",
    border: "border-[#c8f0d5]",
    text: "text-[#136b2a]",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Возвращено",
    bg: "bg-[#fff4f2]",
    border: "border-[#ffd2cd]",
    text: "text-[#a13a32]",
    icon: XCircle,
  },
  completed: {
    label: "Готово",
    bg: "bg-[#ecfdf5]",
    border: "border-[#c8f0d5]",
    text: "text-[#136b2a]",
    icon: CheckCircle2,
  },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  return `${h} ч ${m % 60} мин`;
}

export function ControlBoardClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("problems");
  const [groupBy, setGroupBy] = useState<"journal" | "status">("status");
  const [busyButton, setBusyButton] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/control-board", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as Resp);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, []);

  async function remindAll() {
    setBusyButton("remind-all");
    try {
      const res = await fetch("/api/control-board/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (res.ok) toast.success(`Отправлено ${j.sent} напоминаний (из ${j.total})`);
      else toast.error(j.error || "Ошибка");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyButton(null);
    }
  }

  async function remindOne(userId: string, scopeLabel?: string) {
    setBusyButton(`remind-${userId}`);
    try {
      const res = await fetch("/api/control-board/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId], scopeLabel }),
      });
      if (res.ok) toast.success("Напоминание отправлено");
      else {
        const j = await res.json();
        toast.error(j.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка");
    } finally {
      setBusyButton(null);
    }
  }

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case "all":
        return data.tasks;
      case "not_taken":
        return data.tasks.filter((t) => t.status === "not_taken");
      case "in_progress":
        return data.tasks.filter((t) => t.status === "in_progress");
      case "pending_review":
        return data.tasks.filter((t) => t.status === "pending_review");
      case "problems":
        return data.tasks.filter(
          (t) =>
            t.status === "not_taken" ||
            t.status === "rejected" ||
            t.overdueInProgress ||
            t.status === "pending_review"
        );
    }
  }, [data, filter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Task[]>();
    if (groupBy === "status") {
      const order: Task["status"][] = [
        "not_taken",
        "rejected",
        "in_progress",
        "pending_review",
        "approved",
      ];
      for (const s of order) groups.set(STATUS_META[s].label, []);
      for (const t of filteredTasks) {
        const key = STATUS_META[t.status].label;
        const arr = groups.get(key) ?? [];
        arr.push(t);
        groups.set(key, arr);
      }
    } else {
      // groupBy = journal
      for (const t of filteredTasks) {
        const arr = groups.get(t.journalLabel) ?? [];
        arr.push(t);
        groups.set(t.journalLabel, arr);
      }
    }
    return [...groups.entries()].filter(([, arr]) => arr.length > 0);
  }, [filteredTasks, groupBy]);

  if (loading && !data) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[#6f7282]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const s = data.summary;
  const compliance =
    s.total === 0
      ? 100
      : Math.round(((s.approved + s.pendingReview) / s.total) * 100);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                  Контрольная доска
                </h1>
                <p className="mt-2 max-w-[620px] text-[15px] text-white/70">
                  Все задачи смены в одном экране. Видно кто работает,
                  кто прохлаждается, что не сделано и что ждёт проверки.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-[12px] uppercase tracking-[0.16em] text-white/60">
                Прогресс дня
              </div>
              <div className="text-[36px] font-semibold leading-none">
                {compliance}<span className="text-white/50">%</span>
              </div>
              <div className="text-[12px] text-white/60">
                {s.approved + s.pendingReview} из {s.total}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Не взято" value={s.notTaken} accent={s.notTaken > 0 ? "warn" : "ok"} />
            <Stat label="В работе" value={s.inProgress} accent="info" />
            <Stat label="Ждут проверки" value={s.pendingReview} accent={s.pendingReview > 0 ? "warn" : "ok"} />
            <Stat label="Просрочено" value={s.overdue} accent={s.overdue > 0 ? "danger" : "ok"} />
          </div>

          {(s.notStartedCount > 0 || s.noTelegramCount > 0) ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <AlertTriangle className="size-4 shrink-0 text-amber-300" />
              <div className="text-[13px] text-white">
                {s.notStartedCount > 0
                  ? `${s.notStartedCount} сотрудник${plural(s.notStartedCount)} прохлаждается (не взяли задачи)`
                  : ""}
                {s.notStartedCount > 0 && s.noTelegramCount > 0 ? " · " : ""}
                {s.noTelegramCount > 0
                  ? `${s.noTelegramCount} без Telegram`
                  : ""}
              </div>
              {s.notStartedCount > 0 ? (
                <button
                  type="button"
                  onClick={remindAll}
                  disabled={busyButton === "remind-all"}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-medium text-[#0b1024] hover:bg-white/90"
                >
                  {busyButton === "remind-all" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Bell className="size-3.5" />
                  )}
                  Напомнить всем
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#ececf4] bg-white px-3 py-2">
        <Filter className="size-4 shrink-0 text-[#9b9fb3]" />
        <FilterPill cur={filter} v="problems" onClick={setFilter} label="Проблемы" />
        <FilterPill cur={filter} v="not_taken" onClick={setFilter} label="Не взято" />
        <FilterPill cur={filter} v="in_progress" onClick={setFilter} label="В работе" />
        <FilterPill cur={filter} v="pending_review" onClick={setFilter} label="На проверку" />
        <FilterPill cur={filter} v="all" onClick={setFilter} label="Все" />
        <div className="flex-1" />
        <span className="text-[11px] text-[#9b9fb3]">Группа:</span>
        <button
          type="button"
          onClick={() => setGroupBy(groupBy === "status" ? "journal" : "status")}
          className="text-[12px] font-medium text-[#3848c7] hover:underline"
        >
          {groupBy === "status" ? "по статусу" : "по журналу"}
        </button>
      </div>

      {/* Sections */}
      {grouped.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center text-[14px] text-[#6f7282]">
          {filter === "problems"
            ? "Проблем нет — всё под контролем 🎉"
            : "Нет задач."}
        </div>
      ) : null}

      {grouped.map(([groupLabel, arr]) => (
        <section key={groupLabel} className="space-y-2">
          <div className="px-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
            {groupLabel} ({arr.length})
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {arr.map((t) => (
              <TaskCard
                key={t.scopeKey + t.journalCode}
                task={t}
                onRemind={() => t.assigneeId && remindOne(t.assigneeId, t.scopeLabel)}
                busy={busyButton === `remind-${t.assigneeId}`}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Subordinates summary */}
      {data.subordinates.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
              По сотрудникам ({data.subordinates.length})
            </div>
            <Link href="/team" className="text-[12px] font-medium text-[#3848c7] hover:underline">
              Открыть «Моя команда» →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.subordinates.map((sub) => (
              <SubCard
                key={sub.id}
                sub={sub}
                onRemind={() => remindOne(sub.id)}
                busy={busyButton === `remind-${sub.id}`}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "ok" | "info" | "warn" | "danger";
}) {
  const colors = {
    ok: "bg-white/5 text-white",
    info: "bg-white/5 text-white",
    warn: "bg-[#ffd466]/15 text-amber-100",
    danger: "bg-[#ff8d7d]/20 text-rose-100",
  };
  return (
    <div className={`rounded-2xl px-4 py-3 ${colors[accent]}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</div>
      <div className="mt-0.5 text-[24px] font-semibold leading-none tabular-nums">{value}</div>
    </div>
  );
}

function FilterPill({
  cur,
  v,
  onClick,
  label,
}: {
  cur: StatusFilter;
  v: StatusFilter;
  onClick: (v: StatusFilter) => void;
  label: string;
}) {
  const active = cur === v;
  return (
    <button
      type="button"
      onClick={() => onClick(v)}
      className={`inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
        active
          ? "bg-[#5566f6] text-white"
          : "bg-[#fafbff] text-[#6f7282] hover:bg-[#eef1ff] hover:text-[#3848c7]"
      }`}
    >
      {label}
    </button>
  );
}

function TaskCard({
  task,
  onRemind,
  busy,
}: {
  task: Task;
  onRemind: () => void;
  busy: boolean;
}) {
  const meta = STATUS_META[task.status];
  const Icon = meta.icon;
  return (
    <div
      className={`rounded-2xl border ${meta.border} ${meta.bg} p-3 transition-colors`}
    >
      <div className="flex items-start gap-2">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl bg-white ${meta.text}`}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium leading-tight text-[#0b1024]">
            {task.scopeLabel}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-[#6f7282]">
            <span>{task.journalLabel}</span>
            {task.assigneeName ? (
              <>
                <span>·</span>
                <span className={meta.text}>{task.assigneeName}</span>
              </>
            ) : null}
            {task.claimedAt && task.status === "in_progress" ? (
              <>
                <span>·</span>
                <Clock className="size-3" />
                <span className={task.overdueInProgress ? "text-[#a13a32] font-medium" : ""}>
                  {timeAgo(task.claimedAt)}
                </span>
              </>
            ) : null}
            {task.completedAt && task.status === "pending_review" ? (
              <>
                <span>·</span>
                <span>сделал {timeAgo(task.completedAt)} назад</span>
              </>
            ) : null}
          </div>
          {task.overdueInProgress ? (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#a13a32]">
              <AlertTriangle className="size-3" /> Зависло &gt; 2 ч
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {task.status === "in_progress" && task.assigneeId ? (
          <button
            type="button"
            onClick={onRemind}
            disabled={busy}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#dcdfed] bg-white px-2 text-[11px] text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Bell className="size-3" />}
            Напомнить
          </button>
        ) : null}
        {task.status === "pending_review" ? (
          <Link
            href="/verifications"
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#5566f6] px-2 text-[11px] font-medium text-white"
          >
            <ClipboardCheck className="size-3" />
            Проверить
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function SubCard({
  sub,
  onRemind,
  busy,
}: {
  sub: Sub;
  onRemind: () => void;
  busy: boolean;
}) {
  const total =
    sub.inProgressCount + sub.pendingReviewCount + sub.approvedCount + sub.rejectedCount;
  const isProblem = sub.notStarted || !sub.hasTelegram;
  return (
    <div
      className={`rounded-2xl border p-3 ${
        isProblem
          ? "border-[#ffd2cd] bg-[#fff4f2]"
          : sub.inProgressCount > 0
            ? "border-[#5566f6]/30 bg-[#eef1ff]"
            : "border-[#ececf4] bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[#0b1024]">{sub.name}</div>
          <div className="mt-0.5 text-[11px] text-[#6f7282]">{sub.positionLabel}</div>
        </div>
        {sub.hasTelegram && sub.notStarted ? (
          <button
            type="button"
            onClick={onRemind}
            disabled={busy}
            className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] text-[#a13a32] border border-[#ffd2cd]"
            title="Напомнить начать смену"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Bell className="size-3" />}
            Тыкнуть
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
        {sub.inProgressCount > 0 ? (
          <span className="rounded-full bg-[#eef1ff] px-2 py-0.5 text-[#3848c7]">
            В работе: {sub.inProgressCount}
          </span>
        ) : null}
        {sub.pendingReviewCount > 0 ? (
          <span className="rounded-full bg-[#f5f0ff] px-2 py-0.5 text-[#5d3ab3]">
            Ждут проверки: {sub.pendingReviewCount}
          </span>
        ) : null}
        {sub.approvedCount > 0 ? (
          <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[#136b2a]">
            Одобрено: {sub.approvedCount}
          </span>
        ) : null}
        {sub.rejectedCount > 0 ? (
          <span className="rounded-full bg-[#fff4f2] px-2 py-0.5 text-[#a13a32]">
            Возвращено: {sub.rejectedCount}
          </span>
        ) : null}
        {total === 0 && sub.hasTelegram ? (
          <span className="rounded-full bg-[#fff8eb] px-2 py-0.5 text-[#a13a32]">
            Не взял ни одной задачи
          </span>
        ) : null}
        {!sub.hasTelegram ? (
          <span className="rounded-full bg-[#ffe1dc] px-2 py-0.5 text-[#a13a32]">
            Нет Telegram
          </span>
        ) : null}
      </div>
    </div>
  );
}

function plural(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "ов";
  if (last === 1) return "";
  if (last >= 2 && last <= 4) return "а";
  return "ов";
}
