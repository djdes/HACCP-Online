"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type LocationSummaryItem = {
  id: string;
  name: string;
  address: string | null;
  /** Заполнено сегодня обязательных журналов на точке. */
  filled: number;
  total: number;
  active: boolean;
};

/**
 * Точки (2026-09-05): сводка по точкам на дашборде — строка на точку с
 * заполненностью за сегодня. Клик переключает активную точку: дашборд
 * ниже, журналы и «сегодня» показываются уже для неё. Управляющая сетью
 * видит все точки одним взглядом, а не тремя переключениями.
 */
export function LocationsSummaryStrip({ items }: { items: LocationSummaryItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (items.length < 2) return null;

  async function switchTo(item: LocationSummaryItem) {
    if (item.active || busyId) return;
    setBusyId(item.id);
    try {
      const response = await fetch("/api/me/active-building", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId: item.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось переключить точку");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      aria-label="Сводка по точкам"
      className="rounded-3xl border border-[#ececf4] bg-white p-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          Точки сегодня
        </div>
        <div className="text-[12px] text-[#9b9fb3]">Нажмите, чтобы перейти в точку</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const ratio = item.total > 0 ? item.filled / item.total : 1;
          const tone =
            item.total === 0 || ratio >= 1
              ? { bar: "bg-[#22a06b]", text: "text-[#116b2a]" }
              : ratio >= 0.5
                ? { bar: "bg-[#e0a100]", text: "text-[#8a5a12]" }
                : { bar: "bg-[#d2453d]", text: "text-[#a13a32]" };
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void switchTo(item)}
              aria-current={item.active ? "true" : undefined}
              title={item.address ? `${item.name}, ${item.address}` : item.name}
              className={cn(
                "group rounded-2xl border px-3.5 py-3 text-left transition-colors",
                item.active
                  ? "border-[#5566f6]/40 bg-[#f5f6ff]"
                  : "border-[#ececf4] bg-white hover:border-[#5566f6]/40 hover:bg-[#fafbff]",
              )}
            >
              <div className="flex items-center gap-2">
                <MapPin
                  className={cn("size-4 shrink-0", item.active ? "text-[#5566f6]" : "text-[#9b9fb3]")}
                />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#0b1024]">
                  {item.name}
                </span>
                {busyId === item.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-[#5566f6]" />
                ) : item.active ? (
                  <Check className="size-4 shrink-0 text-[#5566f6]" />
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0f6]">
                  <div
                    className={cn("h-full rounded-full transition-[width]", tone.bar)}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
                <span className={cn("text-[12px] font-medium tabular-nums", tone.text)}>
                  {item.filled}/{item.total}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
