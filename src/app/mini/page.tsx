"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold">Откройте внутри Telegram</h1>
        <p className="text-sm text-slate-500">
          Рабочий кабинет сотрудника доступен только как Mini App в Telegram.
          Попросите у руководителя персональную ссылку-приглашение.
        </p>
      </div>
    );
  }
  if (localState.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold">Не получилось войти</h1>
        <p className="text-sm text-red-500">{localState.message}</p>
      </div>
    );
  }
  if (status !== "authenticated" || !home) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Загружаем…
      </div>
    );
  }

  const displayName = session?.user?.name ?? home.user.name;
  const perms = new Set(home.permissions);
  const canManage =
    perms.has("dashboard.view") || perms.has("staff.manage");
  const showStaffNow = home.mode === "staff" && home.now.length > 0;
  const showStaffDoneBanner = home.mode === "staff" && home.now.length === 0;
  const isReadonly = home.mode === "readonly";

  return (
    <div className="flex flex-1 flex-col gap-6 pb-24">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900">
            Привет, {displayName}!
          </h1>
          {home.user.organizationName ? (
            <p className="mt-0.5 text-[13px] text-slate-500">
              {home.user.organizationName}
            </p>
          ) : null}
        </div>
        <QrScannerButton />
      </header>

      {home.areas && home.areas.length > 0 ? <GeoReminder areas={home.areas} /> : null}

      {isReadonly ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-[14px] text-amber-700">
          У вас режим просмотра. Вы можете ознакомиться с данными, но не
          заполнять журналы.
        </section>
      ) : null}

      {showStaffNow ? (
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
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
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-[14px] text-emerald-700">
          Все журналы на сегодня заполнены. Молодец!
        </section>
      ) : null}

      {home.mode === "manager" ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Сводка на сегодня
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Открыто: {home.summary.pending} · Выполнено: {home.summary.done}
          </p>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Сотрудников с открытыми задачами: {home.summary.employeesWithPending}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {perms.has("staff.view") ? (
              <Link
                href="/mini/staff"
                className="text-[13px] font-medium text-slate-900 underline underline-offset-2"
              >
                Сотрудники →
              </Link>
            ) : null}
            {perms.has("equipment.view") ? (
              <Link
                href="/mini/equipment"
                className="text-[13px] font-medium text-slate-900 underline underline-offset-2"
              >
                Оборудование →
              </Link>
            ) : null}
            {perms.has("reports.view") ? (
              <Link
                href="/mini/reports"
                className="text-[13px] font-medium text-slate-900 underline underline-offset-2"
              >
                Отчёты →
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
          {isReadonly ? "Доступные журналы" : "Все мои журналы"}
        </h2>
        {home.all.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-[14px] text-slate-500">
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
