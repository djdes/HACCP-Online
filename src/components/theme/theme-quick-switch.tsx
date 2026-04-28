"use client";

import { Monitor, Moon, Sun, Clock3 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSiteTheme, type ThemeMode } from "./site-theme";

/**
 * Маленькая иконка-кнопка в header'е: при клике открывается popover с
 * 3 режимами темы (system/light/dark) + checkbox «менять по времени».
 *
 * Иконка отражает текущую effective theme: Sun (light), Moon (dark),
 * Monitor (system без auto), Clock3 (включено auto-by-schedule).
 */
export function ThemeQuickSwitch({ className }: { className?: string }) {
  const { theme, mode, autoBySchedule, setMode, setAutoBySchedule } =
    useSiteTheme();

  const TriggerIcon = autoBySchedule
    ? Clock3
    : mode === "system"
      ? Monitor
      : theme === "dark"
        ? Moon
        : Sun;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Тема оформления"
          title="Тема оформления"
          className={cn(
            "hidden size-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors md:inline-flex hover:border-[#dcdfed] hover:bg-[#f5f6ff] hover:text-[#5566f6]",
            className
          )}
        >
          <TriggerIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 rounded-2xl border border-[#ececf4] p-2 shadow-[0_20px_50px_-20px_rgba(11,16,36,0.4)]"
      >
        <div className="mb-1 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          Тема оформления
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#fafbff] p-1">
          <ModeButton
            label="Системная"
            icon={Monitor}
            active={mode === "system" && !autoBySchedule}
            disabled={autoBySchedule}
            onClick={() => setMode("system")}
          />
          <ModeButton
            label="Светлая"
            icon={Sun}
            active={mode === "light" && !autoBySchedule}
            disabled={autoBySchedule}
            onClick={() => setMode("light")}
          />
          <ModeButton
            label="Тёмная"
            icon={Moon}
            active={mode === "dark" && !autoBySchedule}
            disabled={autoBySchedule}
            onClick={() => setMode("dark")}
          />
        </div>

        <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-[#fafbff]">
          <input
            type="checkbox"
            checked={autoBySchedule}
            onChange={(e) => setAutoBySchedule(e.target.checked)}
            className="mt-0.5 size-4 cursor-pointer accent-[#5566f6]"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#0b1024]">
              Менять по времени суток
            </div>
            <div className="mt-0.5 text-[11.5px] leading-[1.4] text-[#6f7282]">
              7:00–19:00 — светлая, остальное — тёмная. Перекрывает выбор
              сверху, пока включено.
            </div>
          </div>
        </label>
      </PopoverContent>
    </Popover>
  );
}

function ModeButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Sun;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 text-[11.5px] font-medium transition-all",
        disabled && "opacity-40",
        !disabled && active
          ? "bg-white text-[#0b1024] shadow-[0_4px_14px_-8px_rgba(85,102,246,0.45)]"
          : !disabled &&
              "bg-transparent text-[#6f7282] hover:bg-white/60 hover:text-[#0b1024]"
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          active ? "bg-[#5566f6] text-white" : "bg-[#eef1ff] text-[#5566f6]"
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      {label}
    </button>
  );
}

/** ThemeMode pass-through, чтобы импортёры могли пробрасывать тип без site-theme. */
export type { ThemeMode };
