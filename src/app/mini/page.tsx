"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { sanitizeMiniAppRedirectPath } from "@/lib/journal-obligation-links";
import { MiniCard } from "./_components/mini-card";
import { MiniBonusCard } from "./_components/mini-bonus-card";
import { getTelegramWebApp } from "./_components/telegram-web-app";
import { QrScannerButton } from "./_components/qr-scanner";
import { GeoReminder } from "./_components/geo-reminder";
import { MiniHomeSkeleton } from "./_components/mini-home-skeleton";
import { PullToRefresh } from "./_components/pull-to-refresh";
import { MyShiftButton } from "./_components/my-shift-button";

type LocalState =
  | { kind: "init" }
  | { kind: "no-telegram" }
  | { kind: "error"; message: string };

type HomeUser = {
  name: string;
  organizationName: string;
};

type AreaLoc = { id: string; name: string; lat: number; lng: number };

type HomeJournal = {
  code: string;
  name: string;
  description: string | null;
  filled: boolean;
};

type StaffHomeData = {
  mode: "staff";
  user: HomeUser;
  permissions: string[];
  areas: AreaLoc[];
  now: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    href: string;
    bonusAmountKopecks?: number;
    claimedById?: string | null;
    claimedByName?: string | null;
    claimedAt?: string | null;
  }>;
  all: HomeJournal[];
};

type ManagerHomeData = {
  mode: "manager";
  user: HomeUser;
  permissions: string[];
  summary: {
    total: number;
    pending: number;
    done: number;
    employeesWithPending: number;
  };
  areas: AreaLoc[];
  all: HomeJournal[];
};

type ReadonlyHomeData = {
  mode: "readonly";
  user: HomeUser;
  permissions: string[];
  areas: AreaLoc[];
  all: HomeJournal[];
};

type HomeData = StaffHomeData | ManagerHomeData | ReadonlyHomeData;

export default function MiniHomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localState, setLocalState] = useState<LocalState>({ kind: "init" });
  const [home, setHome] = useState<HomeData | null>(null);
  const signInStarted = useRef(false);
  const fetchStarted = useRef(false);
  const redirectStarted = useRef(false);
  const nextPath = (() => {
    const target = sanitizeMiniAppRedirectPath(searchParams.get("next") ?? "");
    return target === "/mini" ? null : target;
  })();

  useEffect(() => {
    if (status !== "unauthenticated" || signInStarted.current) return;

    const webApp = getTelegramWebApp();
    if (!webApp || !webApp.initData) {
      signInStarted.current = true;
      setLocalState({ kind: "no-telegram" });
      return;
    }
    try {
      webApp.ready();
      webApp.expand();
    } catch {
      /* older TG clients don't expose every method */
    }
    signInStarted.current = true;
    void (async () => {
      const result = await signIn("telegram", {
        initData: webApp.initData,
        redirect: false,
      });
      if (!result || result.error) {
        setLocalState({
          kind: "error",
          message: result?.error || "Сессия Telegram не получена",
        });
      }
    })();
  }, [status]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !nextPath ||
      redirectStarted.current
    ) {
      return;
    }

    redirectStarted.current = true;
    router.replace(nextPath);
  }, [nextPath, router, status]);

  // Вынесли в useCallback, чтобы тот же путь использовался и для
  // первоначальной загрузки, и для pull-to-refresh — без дублирования
  // обработки ошибок и без копирования URL.
  const fetchHome = useCallback(async () => {
    try {
      const resp = await fetch("/api/mini/home", { cache: "no-store" });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({ error: "" }))) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as HomeData;
      setHome(data);
      // На успешном refetch сбрасываем error-state — пользователь
      // вытянул вниз, мы заново вошли в norma flow.
      setLocalState((prev) => (prev.kind === "error" ? { kind: "init" } : prev));
    } catch (err) {
      setLocalState({
        kind: "error",
        message: err instanceof Error ? err.message : "Не удалось загрузить данные",
      });
    }
  }, []);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      fetchStarted.current ||
      nextPath
    ) {
      return;
    }

    fetchStarted.current = true;
    void (async () => {
      try {
        await fetchHome();
      } catch {
        /* errors уже разложены в setLocalState */
      }
    })();
  }, [fetchHome, nextPath, status]);

  if (localState.kind === "no-telegram") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <section className="mini-card-solid w-full px-6 py-8 text-center">
          <ShieldAlert
            className="mx-auto size-9"
            style={{ color: "var(--mini-lime)" }}
          />
          <h1 className="mini-display-bold mt-4" style={{ fontSize: 22 }}>
            Откройте внутри Telegram
          </h1>
          <p
            className="mt-2 text-[14px] leading-6"
            style={{ color: "var(--mini-text-muted)" }}
          >
            Рабочий кабинет сотрудника доступен только как Mini App в Telegram.
            Попросите у руководителя персональную ссылку-приглашение.
          </p>
        </section>
      </div>
    );
  }
  if (localState.kind === "error") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <section
          className="w-full rounded-3xl px-6 py-8 text-center"
          style={{
            background: "rgba(255, 82, 104, 0.08)",
            border: "1px solid rgba(255, 82, 104, 0.24)",
          }}
        >
          <ShieldAlert
            className="mx-auto size-9"
            style={{ color: "var(--mini-crimson)" }}
          />
          <h1 className="mini-display-bold mt-4" style={{ fontSize: 22 }}>
            Не получилось войти
          </h1>
          <p
            className="mt-2 text-[14px] leading-6"
            style={{ color: "var(--mini-crimson)" }}
          >
            {localState.message}
          </p>
        </section>
      </div>
    );
  }
  // Аутентифицированному, но без payload — показываем skeleton-каркас.
  // Эффективнее на восприятие чем спиннер: мерцание из 3-4 «карточек»
  // создаёт иллюзию того что страница уже здесь и просто доукомплектуется,
  // а не «зависла на белом экране».
  if (status === "authenticated" && !home) {
    return <MiniHomeSkeleton />;
  }
  if (status !== "authenticated" || !home) {
    return (
      <div
        className="flex flex-1 items-center justify-center text-[14px]"
        style={{ color: "var(--mini-text-muted)" }}
      >
        <Loader2
          className="mr-2 size-4 animate-spin"
          style={{ color: "var(--mini-lime)" }}
        />
        Загружаем кабинет…
      </div>
    );
  }

  const displayName = session?.user?.name ?? home.user.name;
  const perms = new Set(home.permissions);
  const showStaffNow = home.mode === "staff" && home.now.length > 0;
  const showStaffDoneBanner = home.mode === "staff" && home.now.length === 0;
  const isReadonly = home.mode === "readonly";

  const greeting = timeGreeting();
  const total = home.all.length;
  const filled = home.all.filter((j) => j.filled).length;
  const completion = total === 0 ? 0 : Math.round((filled / total) * 100);

  return (
    <PullToRefresh onRefresh={fetchHome}>
    <div className="flex flex-1 flex-col gap-5 pb-28">
      {/* Editorial hero — «Сегодня» + progress ring */}
      <header className="mini-reveal relative">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mini-eyebrow">
              {greeting} · {formatDateRu()}
            </div>
            <h1
              className="mini-display mt-2"
              style={{ fontSize: "42px", color: "var(--mini-text)" }}
            >
              {firstName(displayName)}
              <span
                style={{
                  color: "var(--mini-lime)",
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                ,
              </span>
            </h1>
            {home.user.organizationName ? (
              <p
                className="mt-1.5 truncate text-[13px]"
                style={{ color: "var(--mini-text-muted)" }}
              >
                {home.user.organizationName}
              </p>
            ) : null}
          </div>
          <QrScannerButton />
        </div>

        {/* Three-stat strip + progress ring */}
        <div className="mt-5 grid grid-cols-[1fr_auto] gap-4 items-center">
          <div className="space-y-3">
            {home.mode === "manager" ? (
              <>
                <HeroStat
                  value={home.summary.pending}
                  label="открытых задач"
                  tone={home.summary.pending > 0 ? "amber" : "sage"}
                />
                <HeroStat
                  value={home.summary.employeesWithPending}
                  label={pluralRu(
                    home.summary.employeesWithPending,
                    "сотрудник ждёт",
                    "сотрудника ждут",
                    "сотрудников ждут"
                  )}
                  tone="ice"
                />
              </>
            ) : (
              <>
                <HeroStat
                  value={home.mode === "staff" ? home.now.length : filled}
                  label={
                    home.mode === "staff"
                      ? pluralRu(
                          home.now.length,
                          "задача в работе",
                          "задачи в работе",
                          "задач в работе"
                        )
                      : pluralRu(filled, "выполнена сегодня", "выполнено сегодня", "выполнено сегодня")
                  }
                  tone={
                    home.mode === "staff" && home.now.length > 0 ? "amber" : "lime"
                  }
                />
                <HeroStat
                  value={total}
                  label={pluralRu(total, "задача всего", "задачи всего", "задач всего")}
                  tone="neutral"
                />
              </>
            )}
          </div>
          <ProgressRing percent={completion} />
        </div>
      </header>

      {home.areas && home.areas.length > 0 ? (
        <GeoReminder areas={home.areas} />
      ) : null}

      {/* «Я вышел / закончил смену» — self-service для линейного
          сотрудника. Manager-режим тоже видит кнопку: иногда
          руководитель сам подменяет смену, и ему нужно открыть/закрыть. */}
      {!isReadonly ? <MyShiftButton /> : null}

      {isReadonly ? (
        <section
          className="rounded-2xl px-4 py-3 text-[13px] leading-5"
          style={{
            background: "var(--mini-amber-soft)",
            border: "1px solid rgba(255,144,64,0.22)",
            color: "var(--mini-amber)",
          }}
        >
          Режим просмотра — выполнять задачи нельзя, только листать.
        </section>
      ) : null}

      {showStaffNow ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="mini-eyebrow">На сейчас</h2>
            <span
              className="mini-mono"
              style={{
                fontSize: 11,
                color: "var(--mini-amber)",
                letterSpacing: "0.08em",
              }}
            >
              {String(home.now.length).padStart(2, "0")} / ОТКРЫТО
            </span>
          </div>
          {home.now.map((item, idx) => {
            const isPremium = (item.bonusAmountKopecks ?? 0) > 0;
            return (
              <div
                key={item.id}
                className="mini-reveal"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {isPremium ? (
                  <MiniBonusCard
                    obligationId={item.id}
                    title={item.name}
                    subtitle={item.description}
                    bonusAmountKopecks={item.bonusAmountKopecks ?? 0}
                    initialClaimedByName={item.claimedByName ?? null}
                    initialClaimedAt={item.claimedAt ?? null}
                    index={idx + 1}
                  />
                ) : (
                  <MiniCard
                    href={item.href}
                    title={item.name}
                    subtitle={item.description}
                    status={{ kind: "todo", label: "нужно заполнить" }}
                    index={idx + 1}
                  />
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      {showStaffDoneBanner ? (
        <section
          className="flex items-center gap-3 rounded-2xl px-4 py-4 text-[14px] leading-5"
          style={{
            background: "var(--mini-lime-soft)",
            border: "1px solid rgba(200,255,90,0.26)",
            color: "var(--mini-lime)",
          }}
        >
          <CheckCircle2 className="size-5 shrink-0" strokeWidth={2} />
          <span style={{ color: "var(--mini-text)" }}>
            Смена закрыта. Все задачи на сегодня выполнены.
          </span>
        </section>
      ) : null}

      {home.mode === "manager" ? (
        <section className="mini-card px-4 py-4">
          <div className="flex items-baseline justify-between">
            <h2 className="mini-eyebrow">Сводка смены</h2>
            <span
              className="mini-mono"
              style={{ fontSize: 11, color: "var(--mini-text-faint)" }}
            >
              {formatDateRu()}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <ManagerStat
              value={home.summary.pending}
              label="открыто"
              tone={home.summary.pending > 0 ? "amber" : "sage"}
            />
            <ManagerStat
              value={home.summary.done}
              label="выполнено"
              tone="lime"
            />
            <ManagerStat
              value={home.summary.employeesWithPending}
              label="с задачами"
              tone="ice"
            />
          </div>
          <div className="mini-dotted-sep mt-4 pt-3 flex flex-wrap gap-2">
            {perms.has("staff.view") ? (
              <Link href="/mini/staff" className="mini-btn-ghost">
                → Сотрудники
              </Link>
            ) : null}
            {perms.has("equipment.view") ? (
              <Link href="/mini/equipment" className="mini-btn-ghost">
                → Оборудование
              </Link>
            ) : null}
            {perms.has("reports.view") ? (
              <Link href="/mini/reports" className="mini-btn-ghost">
                → Отчёты
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isReadonly ? (
        <Link
          href="/mini/today"
          className="mini-reveal flex items-center gap-3 rounded-3xl border px-4 py-3.5"
          style={{
            background: "var(--mini-card)",
            borderColor: "var(--mini-border)",
          }}
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "var(--mini-lime)",
              color: "var(--mini-text-on-lime)",
            }}
          >
            ⚡
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold" style={{ color: "var(--mini-text)" }}>
              Сегодня — все задачи
            </div>
            <div className="text-[12px]" style={{ color: "var(--mini-text-muted)" }}>
              Race-claim · возьми задачу первым
            </div>
          </div>
          <span style={{ color: "var(--mini-text-faint)" }}>→</span>
        </Link>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="mini-eyebrow">
            {isReadonly ? "Доступно" : "Все мои задачи"}
          </h2>
          <span
            className="mini-mono"
            style={{
              fontSize: 11,
              color: "var(--mini-text-faint)",
              letterSpacing: "0.08em",
            }}
          >
            {String(home.all.length).padStart(2, "0")} · ЖУРНАЛОВ
          </span>
        </div>
        {home.all.length === 0 ? (
          <div
            className="rounded-2xl px-4 py-7 text-center text-[14px] leading-5"
            style={{
              background: "rgba(250,247,242,0.02)",
              border: "1px dashed var(--mini-divider-strong)",
              color: "var(--mini-text-muted)",
            }}
          >
            Руководитель ещё не дал доступ ни к одной задаче.
          </div>
        ) : (
          home.all.map((journal, idx) => (
            <div
              key={journal.code}
              className="mini-reveal"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <MiniCard
                href={`/mini/journals/${journal.code}`}
                title={journal.name}
                subtitle={journal.description}
                status={
                  journal.filled
                    ? { kind: "done", label: "заполнено" }
                    : { kind: "idle", label: "—" }
                }
                index={idx + 1}
              />
            </div>
          ))
        )}
      </section>
    </div>
    </PullToRefresh>
  );
}

function ManagerStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "lime" | "amber" | "ice" | "sage";
}) {
  const color =
    tone === "lime"
      ? "var(--mini-lime)"
      : tone === "amber"
        ? "var(--mini-amber)"
        : tone === "ice"
          ? "var(--mini-ice)"
          : "var(--mini-sage)";
  return (
    <div>
      <div
        className="mini-mono tabular-nums"
        style={{
          fontSize: 28,
          fontWeight: 500,
          color,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--mini-text-muted)",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: "var(--mini-font-mono)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ---------------- helpers / hero sub-components ------------------ */

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 18) return "Добрый день";
  if (h >= 18 && h < 23) return "Добрый вечер";
  return "Ночная смена";
}

function formatDateRu(): string {
  return new Date()
    .toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    .toUpperCase();
}

function firstName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return parts[1];
  if (parts.length >= 2) return parts[1];
  return parts[0] ?? "Смена";
}

function pluralRu(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return few;
  return many;
}

function HeroStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "lime" | "amber" | "ice" | "crimson" | "sage" | "neutral";
}) {
  const color =
    tone === "lime"
      ? "var(--mini-lime)"
      : tone === "amber"
        ? "var(--mini-amber)"
        : tone === "ice"
          ? "var(--mini-ice)"
          : tone === "crimson"
            ? "var(--mini-crimson)"
            : tone === "sage"
              ? "var(--mini-sage)"
              : "var(--mini-text)";
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="mini-mono tabular-nums"
        style={{
          fontSize: 26,
          fontWeight: 500,
          color,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "var(--mini-text-muted)",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 76;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, percent)) / 100);
  const color =
    percent >= 90
      ? "var(--mini-lime)"
      : percent >= 50
        ? "var(--mini-amber)"
        : "var(--mini-crimson)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="mini-ring-track"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ color: "var(--mini-text)" }}
      >
        <span
          className="mini-mono tabular-nums"
          style={{ fontSize: 18, fontWeight: 600, lineHeight: 1 }}
        >
          {percent}
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--mini-text-muted)",
            letterSpacing: "0.14em",
          }}
        >
          %
        </span>
      </div>
    </div>
  );
}
