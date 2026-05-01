"use client";

import { useEffect, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

type Props = {
  /** Уникальный ключ для localStorage — чтобы предпочтение
   *  «свёрнут / раскрыт» помнилось между сессиями. */
  storageKey: string;
  /** Заголовок блока в свёрнутом и раскрытом состоянии. */
  title: string;
  /** Краткое описание под заголовком. Показывается всегда. */
  subtitle?: string;
  /** Иконка в pill (lucide-react). */
  icon?: LucideIcon;
  /** Значок-pill справа от заголовка — например, «3 критично». */
  badge?: {
    text: string;
    tone?: "default" | "ok" | "warn" | "danger";
  };
  /** По умолчанию раскрыт? Default false (компактнее). */
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const STORAGE_PREFIX = "wesetup.dashboard.section.";

const TONE_CLS: Record<NonNullable<Props["badge"]>["tone"] & string, string> = {
  default: "bg-[#eef1ff] text-[#3848c7]",
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
};

/**
 * Раскрывающаяся секция дашборда. Кликнул на заголовок — увидел
 * содержимое; кликнул ещё раз — свернул. Состояние сохраняется в
 * localStorage по `storageKey` чтобы юзер один раз настроил под себя
 * и оно так осталось.
 *
 * SSR-safe: при первом рендере используется defaultOpen (без access
 * к localStorage), на client'е useEffect синхронизирует с сохранённым
 * значением. Это даёт лёгкий «мигающий» эффект при первом заходе если
 * предпочтение != default — компромисс ради SSR.
 */
export function DashboardSection({
  storageKey,
  title,
  subtitle,
  icon: Icon,
  badge,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (raw === "1") setOpen(true);
      else if (raw === "0") setOpen(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(
          STORAGE_PREFIX + storageKey,
          next ? "1" : "0",
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[#fafbff] sm:p-5 ${
          open ? "border-b border-[#ececf4]" : ""
        }`}
      >
        {Icon ? (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024] sm:text-[16px]">
              {title}
            </h3>
            {badge ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLS[badge.tone ?? "default"]}`}
              >
                {badge.text}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] leading-snug text-[#6f7282] sm:text-[12.5px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`mt-1 size-5 shrink-0 text-[#9b9fb3] transition-transform ${
            open ? "rotate-180 text-[#5566f6]" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={`p-4 sm:p-5 ${hydrated ? "" : "transition-opacity"}`}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
