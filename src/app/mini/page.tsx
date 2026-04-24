"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { getTelegramWebApp } from "./_components/telegram-web-app";
import { QrScannerButton } from "./_components/qr-scanner";
import { GeoReminder } from "./_components/geo-reminder";

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
        const resp = await fetch("/api/mini/home", { cache: "no-store" });
        if (!resp.ok) {
          const body = (await resp.json().catch(() => ({ error: "" }))) as {
            error?: string;
          };
          throw new Error(body.error || `HTTP ${resp.status}`);
        }
        const data = (await resp.json()) as HomeData;
        setHome(data);
      } catch (err) {
        setLocalState({
          kind: "error",
          message: err instanceof Error ? err.message : "Не удалось загрузить данные",
        });
      }
    })();
  }, [nextPath, status]);

  if (localState.kind === "no-telegram") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <section className="w-full rounded-3xl border border-[#ececf4] bg-white px-6 py-8 text-center shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <ShieldAlert className="mx-auto size-9 text-[#5566f6]" />
          <h1 className="mt-4 text-[20px] font-semibold text-[#0b1024]">
            Откройте внутри Telegram
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[#6f7282]">
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
        <section className="w-full rounded-3xl border border-[#ffd9d3] bg-[#fff4f2] px-6 py-8 text-center">
          <ShieldAlert className="mx-auto size-9 text-[#a13a32]" />
          <h1 className="mt-4 text-[20px] font-semibold text-[#0b1024]">
            Не получилось войти
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[#a13a32]">
            {localState.message}
          </p>
        </section>
      </div>
    );
  }
  if (status !== "authenticated" || !home) {
    return (
      <div className="flex flex-1 items-center justify-center text-[14px] text-[#6f7282]">
        <Loader2 className="mr-2 size-4 animate-spin text-[#5566f6]" />
        Загружаем кабинет…
      </div>
    );
  }

  const displayName = session?.user?.name ?? home.user.name;
  const perms = new Set(home.permissions);
  const showStaffNow = home.mode === "staff" && home.now.length > 0;
  const showStaffDoneBanner = home.mode === "staff" && home.now.length === 0;
  const isReadonly = home.mode === "readonly";

  return (
    <div className="flex flex-1 flex-col gap-5 pb-24">
      <header className="relative overflow-hidden rounded-3xl border border-[#1b2450] bg-[#0b1024] px-5 py-5 text-white shadow-[0_20px_60px_-36px_rgba(11,16,36,0.85)]">
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#aeb8ff]">
              Сегодня
            </p>
            <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em]">
              Привет, {displayName}
            </h1>
            {home.user.organizationName ? (
              <p className="mt-1 truncate text-[13px] text-white/70">
                {home.user.organizationName}
              </p>
            ) : null}
          </div>
          <QrScannerButton />
        </div>
        <div className="relative z-10 mt-5 grid grid-cols-2 gap-2">
          {home.mode === "manager" ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2">
                <div className="text-[20px] font-semibold tabular-nums">
                  {home.summary.pending}
                </div>
                <div className="text-[11px] text-white/60">открыто задач</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2">
                <div className="text-[20px] font-semibold tabular-nums">
                  {home.summary.done}
                </div>
                <div className="text-[11px] text-white/60">закрыто сегодня</div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2">
                <div className="text-[20px] font-semibold tabular-nums">
                  {home.mode === "staff" ? home.now.length : home.all.length}
                </div>
                <div className="text-[11px] text-white/60">
                  {home.mode === "staff" ? "к заполнению" : "журналов"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2">
                <div className="flex h-7 items-center">
                  <ClipboardCheck className="size-5 text-[#7cf5c0]" />
                </div>
                <div className="text-[11px] text-white/60">смена под рукой</div>
              </div>
            </>
          )}
        </div>
      </header>

      {home.areas && home.areas.length > 0 ? (
        <GeoReminder areas={home.areas} />
      ) : null}

      {isReadonly ? (
        <section className="rounded-3xl border border-[#ffe0bd] bg-[#fff8ed] px-4 py-4 text-center text-[14px] leading-6 text-[#9a5a00]">
          У вас режим просмотра. Вы можете ознакомиться с данными, но не
          заполнять журналы.
        </section>
      ) : null}

      {showStaffNow ? (
        <section className="space-y-2">
          <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
            На сейчас · {home.now.length}
          </h2>
          {home.now.map((item) => (
            <MiniCard
              key={item.id}
              href={item.href}
              title={item.name}
              subtitle={item.description}
              status={{ kind: "todo", label: "нужно заполнить" }}
            />
          ))}
        </section>
      ) : null}

      {showStaffDoneBanner ? (
        <section className="flex items-center gap-3 rounded-3xl border border-[#c5f7da] bg-[#ecfdf5] px-4 py-4 text-[14px] leading-6 text-[#116b2a]">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>Все журналы на сегодня заполнены. Можно выдохнуть.</span>
        </section>
      ) : null}

      {home.mode === "manager" ? (
        <section className="rounded-3xl border border-[#ececf4] bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <h2 className="text-[15px] font-semibold text-[#0b1024]">
            Сводка на сегодня
          </h2>
          <p className="mt-1 text-[13px] text-[#6f7282]">
            Открыто: {home.summary.pending} · Выполнено: {home.summary.done}
          </p>
          <p className="mt-0.5 text-[13px] text-[#6f7282]">
            Сотрудников с открытыми задачами:{" "}
            {home.summary.employeesWithPending}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {perms.has("staff.view") ? (
              <Link
                href="/mini/staff"
                className="rounded-full bg-[#f5f6ff] px-3 py-1.5 text-[13px] font-medium text-[#3848c7]"
              >
                Сотрудники
              </Link>
            ) : null}
            {perms.has("equipment.view") ? (
              <Link
                href="/mini/equipment"
                className="rounded-full bg-[#f5f6ff] px-3 py-1.5 text-[13px] font-medium text-[#3848c7]"
              >
                Оборудование
              </Link>
            ) : null}
            {perms.has("reports.view") ? (
              <Link
                href="/mini/reports"
                className="rounded-full bg-[#f5f6ff] px-3 py-1.5 text-[13px] font-medium text-[#3848c7]"
              >
                Отчёты
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
          {isReadonly ? "Доступные журналы" : "Все мои журналы"}
        </h2>
        {home.all.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-7 text-center text-[14px] leading-6 text-[#6f7282]">
            Руководитель ещё не дал доступ ни к одному журналу.
          </div>
        ) : (
          home.all.map((journal) => (
            <MiniCard
              key={journal.code}
              href={`/mini/journals/${journal.code}`}
              title={journal.name}
              subtitle={journal.description}
              status={
                journal.filled
                  ? { kind: "done", label: "заполнено" }
                  : { kind: "idle", label: "—" }
              }
            />
          ))
        )}
      </section>
    </div>
  );
}
