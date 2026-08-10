"use client";

import type { ReactNode } from "react";
import { MoreHorizontal, Printer, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentBackLink } from "@/components/journals/document-back-link";
import { cn } from "@/lib/utils";

export type DocumentBarMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  title?: string;
};

type Props = {
  /** Куда ведёт «Назад» — обычно `/journals/<code>`. */
  backHref: string;
  backLabel?: string;
  /** Документ, для которого открывается серверный PDF (единственная печать). */
  documentId?: string;
  /** Скрыть пункт «Печать» — если печать на этой странице не нужна вообще. */
  showPrint?: boolean;
  /** Открыть диалог «Настройки журнала». Не передан — кнопки нет. */
  onSettings?: () => void;
  settingsLabel?: string;
  /** Вторичные действия — попадают в меню «⋯» после «Печати». */
  menuItems?: DocumentBarMenuItem[];
  className?: string;
  /**
   * Диалоги/поповеры, которым нужен монтаж вне DropdownMenuContent
   * (например, подтверждение «Скопировать вчерашнее»).
   */
  children?: ReactNode;
};

const ACTION_BUTTON_CLASS =
  "h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none transition-colors hover:bg-[#f5f6ff]";

/**
 * Единая шапка страницы документа для всех 13 обязательных журналов.
 *
 * Слева — «Назад». Справа — ровно два элемента: «Настройки журнала» и
 * меню «⋯» со вторичными действиями. Печать здесь ОДНА — серверный PDF.
 * Первичные действия («Добавить», автозаполнение, «Карточки/Таблица»)
 * живут на теле страницы, а не в шапке.
 */
export function DocumentActionsBar({
  backHref,
  backLabel,
  documentId,
  showPrint = true,
  onSettings,
  settingsLabel = "Настройки журнала",
  menuItems = [],
  className,
  children,
}: Props) {
  const items = menuItems.filter(Boolean);
  const hasPrint = Boolean(showPrint && documentId);
  const hasMenu = hasPrint || items.length > 0;

  return (
    <>
      <div
        className={cn(
          "mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden",
          className
        )}
      >
        <DocumentBackLink href={backHref} label={backLabel} className="mb-0" />
        <div className="flex flex-wrap items-center gap-2">
          {onSettings ? (
            <Button
              type="button"
              variant="outline"
              onClick={onSettings}
              className={ACTION_BUTTON_CLASS}
            >
              <Settings2 className="size-4" />
              {settingsLabel}
            </Button>
          ) : null}
          {hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Ещё действия"
                  title="Ещё действия"
                  className="flex size-11 items-center justify-center rounded-2xl border border-[#dcdfed] bg-white text-[#3848c7] transition-colors hover:bg-[#f5f6ff]"
                >
                  <MoreHorizontal className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[280px] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-3 shadow-xl"
              >
                {hasPrint ? (
                  <DropdownMenuItem
                    className="h-11 rounded-2xl px-3 text-[15px]"
                    onSelect={() =>
                      window.open(
                        `/api/journal-documents/${documentId}/pdf`,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <Printer className="mr-3 size-4 text-[#6f7282]" />
                    Печать
                  </DropdownMenuItem>
                ) : null}
                {items.map((item) => (
                  <DropdownMenuItem
                    key={item.key}
                    disabled={item.disabled}
                    title={item.title}
                    className={cn(
                      "h-11 rounded-2xl px-3 text-[15px]",
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
          ) : null}
        </div>
      </div>
      {children}
    </>
  );
}
