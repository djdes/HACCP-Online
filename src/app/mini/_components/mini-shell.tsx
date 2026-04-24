"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { getTelegramWebApp } from "./telegram-web-app";
import { useMiniTheme } from "./mini-theme";

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
  if (pathname === "/mini") return "Кабинет";
  if (pathname.startsWith("/mini/journals")) return "Журналы";
  if (pathname.startsWith("/mini/documents")) return "Документ";
  if (pathname.startsWith("/mini/o/")) return "Задача";
  return SECTION_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "WeSetup";
}

export function MiniTelegramRuntime() {
  const { theme } = useMiniTheme();

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;

    try {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation?.();
    } catch {
      /* Older Telegram clients expose only part of the WebApp API. */
    }
  }, []);

  // Синхронизируем Telegram chrome с текущей темой Mini App. Без этого
  // при переключении dark↔light у пользователя остаётся старый header
  // до следующего открытия бота — выглядит как баг.
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;
    const bg = theme === "dark" ? "#0a0b0f" : "#fafbff";
    try {
      tg.setHeaderColor?.(bg);
      tg.setBackgroundColor?.(bg);
    } catch {
      /* old client — silent */
    }
  }, [theme]);

  return null;
}

/**
 * Живые часы в шапке. Mono-цифры, обновляется раз в секунду. Даёт
 * ощущение «command deck» — оператор видит текущее время, не теряется.
 */
function LiveClock() {
  const [now, setNow] = useState<string>(() => formatClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="mini-mono tabular-nums"
      style={{
        fontSize: 11,
        color: "var(--mini-text-muted)",
        letterSpacing: "0.08em",
      }}
    >
      {now}
    </span>
  );
}

function formatClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function MiniTopBar() {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header
      className="mini-topbar sticky top-0 z-40"
      style={{
        borderBottom: "1px solid var(--mini-divider)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        padding: "14px 16px 12px",
      }}
    >
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
        <Link
          href="/mini"
          className="flex min-w-0 items-center gap-3"
          aria-label="На главный экран"
        >
          {/* WS monogram — tactile brand glyph */}
          <span
            className="mini-monogram relative flex size-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              border: "1px solid var(--mini-divider-strong)",
            }}
          >
            <span
              className="mini-display-bold"
              style={{ fontSize: 18, color: "var(--mini-lime)" }}
            >
              W
            </span>
            {/* Breathing indicator — «live» dot */}
            <span
              className="mini-pulse-dot absolute right-1 top-1 size-1.5 rounded-full"
              style={{ background: "var(--mini-lime)" }}
            />
          </span>
          <div className="min-w-0">
            <div
              className="mini-eyebrow"
              style={{ letterSpacing: "0.28em", fontSize: 9 }}
            >
              WESETUP · HACCP
            </div>
            <div
              className="mini-display-bold truncate"
              style={{ fontSize: 16, marginTop: 2 }}
            >
              {title}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2.5">
          <LiveClock />
          <Link
            href="/mini/me"
            aria-label="Профиль"
            className="mini-press inline-flex size-10 items-center justify-center rounded-2xl"
            style={{
              background: "var(--mini-surface-1)",
              border: "1px solid var(--mini-divider)",
              color: "var(--mini-text)",
            }}
          >
            <UserRound className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
