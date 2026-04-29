"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
// NOTE: терминология «задачи / Сегодня» — нейтральная, мини-апп
// никогда не показывает слово «журнал». Сотрудник просто видит
// чек-лист задач смены. Под капотом это journal-task-claim.

type ShiftGate = {
  gateRequired: boolean;
  shiftStarted: boolean;
  today: string;
  preset: string;
};
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Sparkles,
  UserCheck,
} from "lucide-react";

type Scope = {
  scopeKey: string;
  scopeLabel: string;
  sublabel?: string;
  journalCode: string;
  journalLabel: string;
  journalDocumentId?: string;
  availability: "available" | "mine" | "taken" | "completed";
  claimUserName?: string | null;
  claimId?: string;
};

type Group = {
  code: string;
  label: string;
  scopes: Scope[];
};

type Payload = {
  dateKey: string;
  groups: Group[];
  myActive: {
    id: string;
    journalCode: string;
    scopeKey: string;
    scopeLabel: string;
  } | null;
};

export default function MiniTodayPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gate, setGate] = useState<ShiftGate | null>(null);
  const [startingShift, setStartingShift] = useState(false);

  async function loadGate() {
    const res = await fetch("/api/mini/start-shift", { cache: "no-store" });
    if (res.ok) setGate((await res.json()) as ShiftGate);
  }

  async function load() {
    const res = await fetch("/api/mini/today", { cache: "no-store" });
    if (res.ok) setData((await res.json()) as Payload);
  }

  async function startShift() {
    setStartingShift(true);
    try {
      const res = await fetch("/api/mini/start-shift", { method: "POST" });
      if (res.ok) {
        await loadGate();
        await load();
      }
    } finally {
      setStartingShift(false);
    }
  }

  useEffect(() => {
    (async () => {
      await loadGate();
      // Не загружаем задачи пока gate не пройден — иначе сотрудник
      // мельком увидит список до того как нажал «Начать смену».
    })();
  }, []);

  useEffect(() => {
    if (gate && (!gate.gateRequired || gate.shiftStarted)) {
      void load();
    }
  }, [gate]);

  async function claim(scope: Scope) {
    if (!data) return;
    setBusy(scope.scopeKey);
    try {
      const res = await fetch("/api/journal-task-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalCode: scope.journalCode,
          scopeKey: scope.scopeKey,
          scopeLabel: scope.scopeLabel,
          dateKey: data.dateKey,
          parentHint: scope.scopeLabel,
        }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => null);
        if (j?.claim?.id) {
          // Переходим на универсальную /mini/claim/[id] страницу
          router.push(`/mini/claim/${j.claim.id}`);
          return;
        }
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  async function complete(claimId: string) {
    setBusy(claimId);
    try {
      await fetch(`/api/journal-task-claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  // Shift gate: для линейного персонала без активной смены —
  // показываем ОДНУ кнопку «Начать смену» и ничего больше. Это
  // делает обязательной отметку начала рабочего дня — заведующая
  // на Контрольной доске видит кто реально вышел на работу.
  if (gate && gate.gateRequired && !gate.shiftStarted) {
    return (
      <div className="space-y-4 pb-24">
        <Link
          href="/mini"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#6f7282]"
        >
          <ArrowLeft className="size-4" />
          Главная
        </Link>
        <div className="rounded-3xl border border-[#ececf4] bg-[#0b1024] p-8 text-center text-white">
          <div className="text-[12px] uppercase tracking-[0.16em] text-white/60">
            {new Date(gate.today).toLocaleDateString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <div className="mt-2 text-[24px] font-semibold leading-tight">
            Готов к работе?
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-white/70">
            Нажми «Начать смену» чтобы получить задачи на сегодня.
            Руководитель увидит, что ты вышел на работу.
          </p>
          <button
            type="button"
            onClick={startShift}
            disabled={startingShift}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[16px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.7)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
          >
            {startingShift ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <span>▶️</span>
            )}
            Начать смену
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-40 items-center justify-center text-[#6f7282]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const totalAvailable = data.groups.flatMap((g) =>
    g.scopes.filter((s) => s.availability === "available")
  ).length;
  const totalMine = data.groups.flatMap((g) =>
    g.scopes.filter((s) => s.availability === "mine")
  ).length;
  const totalDone = data.groups.flatMap((g) =>
    g.scopes.filter((s) => s.availability === "completed")
  ).length;

  return (
    <div className="space-y-4 pb-24">
      <Link
        href="/mini"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#6f7282]"
      >
        <ArrowLeft className="size-4" />
        Главная
      </Link>

      <header className="rounded-3xl border border-[#ececf4] bg-[#0b1024] p-6 text-white">
        <div className="text-[12px] uppercase tracking-[0.16em] text-white/60">
          {new Date(data.dateKey).toLocaleDateString("ru-RU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <div className="mt-2 text-[24px] font-semibold leading-tight">
          Сегодня
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-full bg-white/10 px-2.5 py-1">
            Доступно: {totalAvailable}
          </span>
          {totalMine > 0 ? (
            <span className="rounded-full bg-[#5566f6] px-2.5 py-1">
              У меня: {totalMine}
            </span>
          ) : null}
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-emerald-100">
            Готово: {totalDone}
          </span>
        </div>
      </header>

      {data.myActive ? (
        <div className="rounded-2xl border border-[#5566f6] bg-[#eef1ff] p-3 text-[13px] text-[#3848c7]">
          <Lock className="mr-1.5 inline size-4 align-text-bottom" />
          В работе:&nbsp;
          <span className="font-semibold">{data.myActive.scopeLabel}</span>
          &nbsp;— завершите её прежде чем брать новые.
        </div>
      ) : null}

      {data.groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-10 text-center text-[14px] text-[#6f7282]">
          На сегодня нет активных задач. Попросите менеджера создать
          документы журналов.
        </div>
      ) : null}

      {data.groups.map((g) => (
        <section key={g.code} className="space-y-2">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
            {g.label} ({g.scopes.length})
          </div>
          {g.scopes.map((s) => (
            <ScopeRow
              key={s.scopeKey}
              scope={s}
              busy={busy === s.scopeKey || busy === s.claimId}
              locked={Boolean(
                data.myActive &&
                  data.myActive.journalCode +
                    data.myActive.scopeKey !==
                    s.journalCode + s.scopeKey
              )}
              onClaim={() => claim(s)}
              onComplete={() => s.claimId && complete(s.claimId)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function ScopeRow({
  scope,
  busy,
  locked,
  onClaim,
  onComplete,
}: {
  scope: Scope;
  busy: boolean;
  locked: boolean;
  onClaim: () => void;
  onComplete: () => void;
}) {
  const av = scope.availability;
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border p-3.5 transition-colors",
        av === "completed"
          ? "border-[#c8f0d5] bg-[#ecfdf5]"
          : av === "mine"
            ? "border-[#5566f6] bg-[#eef1ff]"
            : av === "taken"
              ? "border-[#ececf4] bg-[#fafbff] opacity-70"
              : "border-[#ececf4] bg-white",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          av === "completed"
            ? "bg-[#d9f4e1] text-[#136b2a]"
            : av === "mine"
              ? "bg-[#5566f6] text-white"
              : av === "taken"
                ? "bg-[#ececf4] text-[#9b9fb3]"
                : "bg-[#eef1ff] text-[#3848c7]",
        ].join(" ")}
      >
        {av === "completed" ? (
          <CheckCircle2 className="size-5" />
        ) : av === "mine" ? (
          <UserCheck className="size-5" />
        ) : av === "taken" ? (
          <Lock className="size-5" />
        ) : (
          <Sparkles className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-[#0b1024]">
          {scope.scopeLabel}
        </div>
        {scope.sublabel ? (
          <div className="mt-0.5 text-[12px] text-[#6f7282]">{scope.sublabel}</div>
        ) : null}
        {scope.claimUserName ? (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-[#6f7282]">
            <Clock className="size-3" />
            {av === "completed" ? "Готово · " : av === "mine" ? "Я · " : "Занято · "}
            <span>{scope.claimUserName}</span>
          </div>
        ) : null}
      </div>
      <div className="shrink-0">
        {av === "available" ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={busy || locked}
            title={locked ? "Сначала заверши текущую" : undefined}
            className={[
              "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium",
              locked
                ? "border border-[#ececf4] bg-[#fafbff] text-[#9b9fb3]"
                : "bg-[#5566f6] text-white shadow-[0_8px_20px_-10px_rgba(85,102,246,0.6)]",
            ].join(" ")}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {locked ? <Lock className="size-3.5" /> : null}
            Взять
          </button>
        ) : null}
        {av === "mine" ? (
          <button
            type="button"
            onClick={onComplete}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#136b2a] px-3 text-[13px] font-medium text-white"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Завершить
          </button>
        ) : null}
      </div>
    </div>
  );
}
