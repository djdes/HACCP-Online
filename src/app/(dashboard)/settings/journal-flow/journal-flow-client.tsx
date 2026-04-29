"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Sparkles,
  Users,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type Mode = "race" | "shared" | "manual";

const MODES: {
  value: Mode;
  label: string;
  short: string;
  icon: typeof Sparkles;
  pros: string[];
  cons: string[];
}[] = [
  {
    value: "race",
    label: "Гонка (default)",
    short: "Кто первый — того и задача",
    icon: Sparkles,
    pros: [
      "Сотрудник видит что свободно и берёт сам",
      "Нет конфликтов — система блокирует scope для других",
      "У каждого max 1 active задача — фокус",
    ],
    cons: ["Кто шустрее — нагребает больше", "Менее опытные могут стесняться"],
  },
  {
    value: "shared",
    label: "Свободно",
    short: "Все могут заполнять параллельно",
    icon: Users,
    pros: [
      "Никаких блокировок — берёт кто хочет когда хочет",
      "Подходит для малых команд из 2-3 человек",
    ],
    cons: [
      "Возможно дублирование (двое начали одну задачу)",
      "one-active-task rule отключён",
    ],
  },
  {
    value: "manual",
    label: "Только админ назначает",
    short: "Сотрудники не берут сами",
    icon: Lock,
    pros: [
      "Жёсткий контроль — только заведующая или админ распределяют",
      "Подходит для строгих организаций",
    ],
    cons: [
      "Сотрудники не могут себе брать — придётся ждать назначения",
      "Больше работы для админа",
    ],
  },
];

export function JournalFlowClient({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Mode>(initialMode);

  async function save(next: Mode) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/journal-flow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskFlowMode: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(next);
      setMode(next);
      toast.success("Режим сохранён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Настройки
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                Режим распределения задач
              </h1>
              <p className="mt-2 max-w-[640px] text-[15px] text-white/70">
                Как сотрудники получают задачи. Изменение применяется к
                ВСЕМ журналам сразу. Можно поменять в любой момент —
                незавершённые задачи продолжат работать как были взяты.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.value;
          const isSaved = saved === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => save(m.value)}
              disabled={saving || isSaved}
              className={`flex flex-col gap-3 rounded-3xl border p-5 text-left transition-all ${
                active
                  ? "border-[#5566f6] bg-[#eef1ff] shadow-[0_0_0_3px_rgba(85,102,246,0.15)]"
                  : "border-[#ececf4] bg-white hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                    active ? "bg-[#5566f6] text-white" : "bg-[#fafbff] text-[#6f7282]"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-[#0b1024]">
                    {m.label}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#6f7282]">
                    {m.short}
                  </div>
                </div>
                {isSaved ? (
                  <CheckCircle2 className="ml-auto size-5 text-[#136b2a]" />
                ) : null}
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#136b2a]">
                  Плюсы
                </div>
                <ul className="ml-4 list-disc space-y-0.5 text-[12px] text-[#3c4053]">
                  {m.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a13a32]">
                  Минусы
                </div>
                <ul className="ml-4 list-disc space-y-0.5 text-[12px] text-[#3c4053]">
                  {m.cons.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
              {saving && active ? (
                <div className="inline-flex items-center gap-1.5 text-[11px] text-[#3848c7]">
                  <Loader2 className="size-3 animate-spin" />
                  Сохраняю...
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#dcdfed] bg-[#fafbff] p-4 text-[13px] text-[#3c4053]">
        💡 Можно установить разные режимы для разных журналов через
        будущую страницу{" "}
        <Link href="/settings/journal-pipelines" className="text-[#3848c7] underline">
          /settings/journal-pipelines
        </Link>
        . Текущий режим — глобальный для всех 35 журналов организации.
      </div>
    </div>
  );
}
