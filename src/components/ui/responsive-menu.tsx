"use client";

import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BottomSheet,
  SHEET_ROW_CLASS,
} from "@/components/ui/bottom-sheet";
import { useIsNarrowViewport } from "@/components/ui/spotlight-tour";
import { cn } from "@/lib/utils";

/**
 * Меню действий: на компьютере — выпадающий список, на телефоне — лист
 * снизу, как в мобильных приложениях.
 *
 * Зачем один компонент на оба случая: выпадающий список у края экрана
 * телефона даёт мелкие пункты в 40% ширины, до которых ещё и тянуться
 * большим пальцем. Лист снизу — привычный жест: крупные строки, свайп
 * вниз закрывает.
 *
 * Пункты описываются данными (а не разметкой), поэтому оба вида
 * гарантированно одинаковые: одна и та же подпись, иконка и обработчик.
 */
export type ResponsiveMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "default" | "danger";
};

export function ResponsiveMenu({
  trigger,
  items,
  title = "Действия",
  align = "end",
  contentClassName,
}: {
  /** Кнопка-триггер: получает обработчик открытия обоих видов меню. */
  trigger: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
  items: ResponsiveMenuItem[];
  /** Заголовок листа на телефоне. */
  title?: string;
  align?: "start" | "center" | "end";
  contentClassName?: string;
}) {
  const narrow = useIsNarrowViewport();
  const [sheetOpen, setSheetOpen] = useState(false);
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  if (narrow) {
    const mobileTrigger = isValidElement(trigger)
      ? cloneElement(trigger, {
          onClick: (event: React.MouseEvent) => {
            trigger.props.onClick?.(event);
            setSheetOpen(true);
          },
        })
      : trigger;

    return (
      <>
        {mobileTrigger}
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={title}
        >
          {visible.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                setSheetOpen(false);
                item.onSelect();
              }}
              className={cn(
                SHEET_ROW_CLASS,
                item.disabled && "opacity-40",
                item.tone === "danger" &&
                  "text-[#a13a32] hover:bg-[#fff4f2] active:bg-[#ffe9e5]"
              )}
            >
              {item.icon ? (
                <span className="flex size-5 shrink-0 items-center justify-center text-[#6f7282]">
                  {item.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">{item.label}</span>
            </button>
          ))}
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={
          contentClassName ??
          "w-[280px] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-3 shadow-xl"
        }
      >
        {visible.map((item) => (
          <DropdownMenuItem
            key={item.key}
            disabled={item.disabled}
            title={item.title}
            className={cn(
              "h-9 rounded-xl px-3 text-[13.5px]",
              item.tone === "danger" &&
                "text-[#a13a32] focus:bg-[#fff4f2] focus:text-[#a13a32]"
            )}
            onSelect={item.onSelect}
          >
            {item.icon ? (
              <span className="mr-3 flex size-4 items-center justify-center text-[#6f7282]">
                {item.icon}
              </span>
            ) : null}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
