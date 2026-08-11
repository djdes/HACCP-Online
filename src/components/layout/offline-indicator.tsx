"use client";

import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfflineQueue } from "@/lib/use-offline-submit";

/**
 * Индикатор сети + очереди. Рендерится в шапке dashboard. Если
 * online + очередь пуста — компактная зелёная точка (почти не видна).
 * Если очередь не пуста или offline — контрастная плашка с кнопкой
 * «Отправить сейчас».
 */
export function OfflineIndicator() {
  const { online, pending, flushNow, busy } = useOfflineQueue();

  // Quiet state — ничего лишнего не показываем.
  // Показываем только от lg+ (1024): на md (768–1023) шапка и так плотная,
  // «В сети» будет overlap'ить pill «Сотрудники». Проблемные состояния
  // (offline / pending queue) показываем и на md — их важнее увидеть.
  if (online && pending === 0) {
    return (
      <span
        aria-label="В сети"
        title="В сети, очередь пуста"
        className="hidden h-10 items-center gap-1.5 rounded-lg bg-[#ecfdf5] px-3 text-[13px] font-semibold text-[#116b2a] lg:inline-flex"
      >
        <Cloud className="size-4" />
        В сети
      </span>
    );
  }

  const label = online
    ? `В сети · ждёт отправки ${pending}`
    : pending > 0
      ? `Офлайн · ${pending} в очереди`
      : "Офлайн";

  return (
    <button
      type="button"
      onClick={() => void flushNow()}
      disabled={busy || pending === 0}
      title={
        online
          ? "Есть записи, которые не успели уйти. Нажмите, чтобы отправить сейчас."
          : "Нет интернета. Записи сохраняются локально и отправятся, когда сеть вернётся."
      }
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-200",
        online
          ? "bg-[#fff8eb] text-[#b25f00] hover:bg-[#fff4d9]"
          : "bg-[#fff4f2] text-[#a13a32] hover:bg-[#ffe9e4]"
      )}
    >
      {busy ? (
        <RefreshCw className="size-4 animate-spin" />
      ) : online ? (
        <Cloud className="size-4" />
      ) : (
        <CloudOff className="size-4" />
      )}
      {label}
    </button>
  );
}
