"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSiteTheme, type SiteTheme, type ThemeMode } from "./site-theme";
import { cn } from "@/lib/utils";

/**
 * Settings-страница: подробная карточка с превью + 3 режима (system/light/dark)
 * + checkbox «менять по времени суток». В header'е есть компактная версия —
 * `ThemeQuickSwitch`. Источник истины состояния — site-theme provider.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, mode, autoBySchedule, setMode, setAutoBySchedule } =
    useSiteTheme();

  return (
    <div
      className={cn(
        "rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3848c7]">
            Тема оформления
          </div>
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
            Как должен выглядеть дашборд
          </h3>
          <p className="mt-1.5 max-w-[420px] text-[13px] leading-[1.55] text-[#6f7282]">
            Светлая — привычный бело-индиго как на лендинге. Тёмная — для
            поздней смены и слабого освещения в цехе. Системная — синхронизация
            с настройками устройства. Влияет только на личный кабинет; лендинг
            и форма входа остаются светлыми.
          </p>
        </div>

        <ThemePreview theme={theme} />
      </div>

      <div
        role="radiogroup"
        aria-label="Тема дашборда"
        className={cn(
          "mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-1.5",
          autoBySchedule && "opacity-60"
        )}
      >
        <ModeOption
          label="Системная"
          icon={Monitor}
          active={mode === "system"}
          disabled={autoBySchedule}
          onSelect={() => setMode("system")}
        />
        <ModeOption
          label="Светлая"
          icon={Sun}
          active={mode === "light"}
          disabled={autoBySchedule}
          onSelect={() => setMode("light")}
        />
        <ModeOption
          label="Тёмная"
          icon={Moon}
          active={mode === "dark"}
          disabled={autoBySchedule}
          onSelect={() => setMode("dark")}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 hover:bg-[#f5f6ff]">
        <input
          type="checkbox"
          checked={autoBySchedule}
          onChange={(e) => setAutoBySchedule(e.target.checked)}
          className="mt-0.5 size-4 cursor-pointer accent-[#5566f6]"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-[#0b1024]">
            Менять по времени суток
          </div>
          <div className="mt-1 text-[12px] leading-[1.5] text-[#6f7282]">
            С 7:00 до 19:00 — светлая, ночью — тёмная. Перекрывает выбор
            сверху, пока включено. Удобно если работаете и днём, и в ночную
            смену — глазам легче.
          </div>
        </div>
      </label>
    </div>
  );
}

function ModeOption({
  label,
  icon: Icon,
  active,
  disabled,
  onSelect,
}: {
  label: string;
  icon: typeof Sun;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[13px] font-semibold transition-all sm:text-[14px]",
        disabled && "cursor-not-allowed",
        !disabled && active
          ? "border-[#5566f6] bg-white text-[#0b1024] shadow-[0_4px_18px_-10px_rgba(85,102,246,0.45)]"
          : !disabled &&
              "border-transparent bg-transparent text-[#6f7282] hover:bg-white/60 hover:text-[#0b1024]",
          disabled && "border-transparent bg-transparent text-[#9b9fb3]"
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg transition-colors",
          !disabled && active
            ? "bg-[#5566f6] text-white"
            : "bg-[#eef1ff] text-[#5566f6]"
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      {label}
    </button>
  );
}

/**
 * Mini-макет браузерного окна: показывает как будет выглядеть текущая
 * effective тема. Меняется синхронно — тактильная подсказка «да,
 * переключилось».
 */
function ThemePreview({ theme }: { theme: SiteTheme }) {
  const isDark = theme === "dark";
  return (
    <div
      aria-hidden
      className="relative w-full shrink-0 overflow-hidden rounded-2xl border shadow-[0_12px_30px_-18px_rgba(11,16,36,0.35)] sm:w-[220px]"
      style={{
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "#ececf4",
        background: isDark ? "#0b0d1a" : "#fafbff",
      }}
    >
      <div
        className="flex items-center gap-1.5 border-b px-3 py-2"
        style={{
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "#ececf4",
          background: isDark ? "#131526" : "#ffffff",
        }}
      >
        <span
          className="size-2 rounded-full"
          style={{ background: isDark ? "#2b2e45" : "#ff6059" }}
        />
        <span
          className="size-2 rounded-full"
          style={{ background: isDark ? "#2b2e45" : "#ffbe2f" }}
        />
        <span
          className="size-2 rounded-full"
          style={{ background: isDark ? "#2b2e45" : "#29d153" }}
        />
      </div>
      <div className="space-y-2 p-3">
        <div
          className="rounded-lg p-2"
          style={{ background: isDark ? "#13172e" : "#0b1024" }}
        >
          <div
            className="mb-1.5 h-1.5 w-12 rounded-full"
            style={{ background: "#5566f6" }}
          />
          <div
            className="h-2 w-20 rounded-full"
            style={{ background: "rgba(255,255,255,0.8)" }}
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-8 rounded-md"
              style={{
                background: isDark ? "#16182a" : "#ffffff",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#ececf4"}`,
              }}
            />
          ))}
        </div>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-4 rounded-md"
            style={{
              background: isDark ? "#16182a" : "#ffffff",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#ececf4"}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Re-export для импортёров, которым нужен тип. */
export type { ThemeMode };
