"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { UserRound } from "lucide-react";
import { getTelegramWebApp } from "./telegram-web-app";

const SECTION_TITLES: Array<[string, string]> = [
  ["/mini/staff", "Сотрудники"],
  ["/mini/equipment", "Оборудование"],
  ["/mini/reports", "Отчёты"],
  ["/mini/audit", "Аудит"],
  ["/mini/iot", "IoT"],
  ["/mini/shift-handover", "Смены"],
  ["/mini/me", "Профиль"],
  ["/mini/open", "Полная версия"],
];

function titleForPath(pathname: string): string {
  if (pathname === "/mini") return "Рабочий кабинет";
  if (pathname.startsWith("/mini/journals")) return "Журналы";
  if (pathname.startsWith("/mini/documents")) return "Документ";
  if (pathname.startsWith("/mini/o/")) return "Задача";
  return SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "WeSetup";
}

export function MiniTelegramRuntime() {
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;

    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.("#0b1024");
      tg.setBackgroundColor?.("#fafbff");
      tg.enableClosingConfirmation?.();
    } catch {
      /* Older Telegram clients expose only part of the WebApp API. */
    }
  }, []);

  return null;
}

export function MiniTopBar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-[#ececf4] bg-white/92 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/78">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
        <Link href="/mini" className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="relative flex size-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_-18px_rgba(11,16,36,0.85)]"
              style={{
                background:
                  "linear-gradient(135deg, #0b1024 0%, #1a1f45 40%, #5566f6 140%)",
              }}
            >
              <span className="text-[13px] font-bold tracking-[0.14em]">W</span>
              <span className="pointer-events-none absolute -left-1 -top-1 size-3 rounded-full bg-[#5566f6] opacity-70 blur-[4px]" />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-4 tracking-[-0.01em] text-[#0b1024]">
                WeSetup
              </div>
              <div className="truncate text-[11px] leading-4 text-[#6f7282]">
                {title}
              </div>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/mini/me"
            className="inline-flex size-9 items-center justify-center rounded-2xl border border-[#ececf4] bg-[#fafbff] text-[#3c4053] active:scale-[0.98]"
            aria-label="Профиль"
          >
            <UserRound className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
