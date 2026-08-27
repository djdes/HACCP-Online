"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteTheme, type ThemeMode } from "./site-theme";

/**
 * Переключатель темы: три режима (system/light/dark) + чекбокс
 * «менять по времени суток».
 *
 * Раньше это была отдельная иконка-popover в ряду контролов шапки.
 * Теперь блок живёт в подменю «Тема» меню профиля (правая иконка
 * сверху) — шапка перестала расти иконками, а тема оказалась там же,
 * где тариф и настройки. Компонент рисует только содержимое, обёртку
 * (popover / dropdown-submenu) даёт вызывающий.
 */
export function ThemeModeControls({ className }: { className?: string }) {
  const { mode, autoBySchedule, setMode, setAutoBySchedule } = useSiteTheme();

  return (
    <div className={className}>
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
    </div>
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
