"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, MapPin, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { BuildingOption } from "@/lib/building-scope";
import { cn } from "@/lib/utils";
import { ResponsiveMenu } from "@/components/ui/responsive-menu";

/**
 * Точки (2026-09-05): переключатель точки в шапке сайта.
 *
 * Страницы остаются одно-точечными: журналы, «сегодня» и пул задач
 * показываются для выбранной точки, а не сводятся в один экран. Список
 * приходит с сервера по активной организации (не по членству), поэтому
 * партнёр в кабинете клиента и ROOT при импёрсонации видят те же точки,
 * что и владелец.
 */

function useSwitchBuilding() {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function switchTo(building: BuildingOption, activeBuildingId: string | null) {
    if (building.id === activeBuildingId || busyId) return;
    setBusyId(building.id);
    try {
      const response = await fetch("/api/me/active-building", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId: building.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось переключить точку");
      toast.success(`Точка: ${building.name}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return { switchTo, busyId };
}

export function LocationSwitcherPill({
  buildings,
  activeBuildingId,
  className,
  compact = false,
  manageHref = null,
}: {
  buildings: BuildingOption[];
  activeBuildingId: string | null;
  className?: string;
  /** Узкая пилюля для мобильной шапки: ниже и с коротким названием. */
  compact?: boolean;
  /** Ссылка «Настроить точки» внизу меню — только тем, кто может их менять. */
  manageHref?: string | null;
}) {
  const router = useRouter();
  const { switchTo, busyId } = useSwitchBuilding();
  const active = buildings.find((building) => building.id === activeBuildingId) ?? buildings[0];
  if (!active || buildings.length < 2) return null;

  const trigger = (
    <button
      type="button"
      title={active.address ? `${active.name}, ${active.address}` : active.name}
      aria-label={`Точка: ${active.name}. Сменить точку`}
      data-tour="location-switcher"
      className={cn(
        "flex min-w-0 items-center rounded-lg bg-[#5566f6]/[0.04] font-semibold text-[#5566f6] transition-colors duration-200 hover:bg-[#5566f6]/[0.09]",
        compact
          ? "h-8 max-w-full gap-1.5 px-2.5 text-[13px]"
          : "ml-1 h-10 max-w-[220px] gap-2 px-3 text-[14px]",
        className,
      )}
    >
      <MapPin className={cn("shrink-0", compact ? "size-4" : "size-5")} />
      <span className="min-w-0 flex-1 truncate text-left">{active.name}</span>
      <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
    </button>
  );

  // На телефоне выбор точки открывается листом снизу — тем же жестом,
  // что меню профиля и действия документа.
  return (
    <ResponsiveMenu
      title="Точка"
      align="start"
      contentClassName="w-[280px] rounded-2xl border-0 p-2 shadow-xl"
      trigger={trigger}
      items={[
        ...buildings.map((building) => ({
          key: building.id,
          label: building.address
            ? `${building.name} · ${building.address}`
            : building.name,
          icon: (
            <MapPin
              className={cn(
                "size-4",
                building.id === active.id ? "text-[#5566f6]" : "text-[#9b9fb3]",
              )}
            />
          ),
          disabled: busyId !== null,
          onSelect: () => void switchTo(building, active.id),
        })),
        ...(manageHref
          ? [
              {
                key: "manage",
                label: "Настроить точки",
                icon: <Settings2 className="size-4 text-[#3848c7]" />,
                onSelect: () => router.push(manageHref),
              },
            ]
          : []),
      ]}
    />
  );
}

/** Тот же список плоскими кнопками — для мобильного меню-шторки. */
export function LocationSwitcherList({
  buildings,
  activeBuildingId,
}: {
  buildings: BuildingOption[];
  activeBuildingId: string | null;
}) {
  const { switchTo, busyId } = useSwitchBuilding();
  if (buildings.length < 2) return null;
  const activeId = activeBuildingId ?? buildings[0]?.id ?? null;

  return (
    <div className="mb-1 border-b border-[#ececf4] pb-2">
      <div className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9b9fb3]">
        Точка
      </div>
      {buildings.map((building) => {
        const isActive = building.id === activeId;
        return (
          <button
            key={building.id}
            type="button"
            onClick={() => void switchTo(building, activeId)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition-colors",
              isActive ? "bg-[#f5f6ff] text-[#5566f6]" : "text-[#3c4053] hover:bg-[#fafbff]",
            )}
          >
            <MapPin
              className={cn("size-5 shrink-0", isActive ? "text-[#5566f6]" : "text-[#6f7282]")}
            />
            <span className="min-w-0 flex-1 truncate">{building.name}</span>
            {busyId === building.id ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-[#5566f6]" />
            ) : isActive ? (
              <Check className="size-4 shrink-0 text-[#5566f6]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
