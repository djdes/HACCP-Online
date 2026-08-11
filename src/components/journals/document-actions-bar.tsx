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
import { DOC_TITLE_ROW_CLASS } from "@/components/journals/journal-responsive";
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
  /**
   * Куда вёл «Назад» — обычно `/journals/<code>`. Кнопки больше нет
   * (её роль выполняют хлебные крошки), но проп сохранён: его передают
   * все 13 клиентов, и он остаётся частью контракта шапки.
   */
  backHref?: string;
  backLabel?: string;
  /** Документ, для которого открывается серверный PDF (единственная печать). */
  documentId?: string;
  /** Скрыть пункт «Печать» — если печать на этой странице не нужна вообще. */
  showPrint?: boolean;
  /**
   * Заголовок страницы (H1) и всё, что живёт под ним (период документа,
   * индикатор «Сохранение…»). На эталоне заголовок стоит СЛЕВА в одной
   * строке с «Настройками журнала», поэтому шапка принимает его слотом,
   * а не рендерится отдельным блоком над/под собой.
   */
  heading?: ReactNode;
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
  "h-9 rounded-lg border-0 bg-[#5566f6]/[0.04] px-3.5 text-[14px] font-semibold text-[#5566f6] shadow-none transition-colors hover:bg-[#5566f6]/[0.09]";

/**
 * Единая шапка страницы документа для всех 13 обязательных журналов.
 *
 * Справа — ровно два элемента: «Настройки журнала» и меню «⋯» со
 * вторичными действиями. Печать здесь ОДНА — серверный PDF.
 * Первичные действия («Добавить», автозаполнение, «Карточки/Таблица»)
 * живут на теле страницы, а не в шапке.
 *
 * Кнопки «Назад» тут больше нет — навигацию вверх дают хлебные крошки
 * (`JournalBreadcrumbs`), как на эталоне. `backHref` остаётся в пропсах:
 * его передают все 13 клиентов, и он ещё нужен как fallback-цель.
 * В Mini App этот компонент тоже рендерится, но там своя навигация
 * (ссылка «К списку документов» + нижний MiniNav), так что потери нет.
 */
export function DocumentActionsBar({
  documentId,
  showPrint = true,
  heading,
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
          heading
            ? DOC_TITLE_ROW_CLASS
            : "mb-5 flex flex-wrap items-center justify-end gap-2 print:hidden",
          className
        )}
      >
        {heading ? <div className="min-w-0 flex-1">{heading}</div> : null}
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
                  className="flex size-9 items-center justify-center rounded-lg border-0 bg-[#5566f6]/[0.04] text-[#5566f6] transition-colors hover:bg-[#5566f6]/[0.09]"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[280px] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-3 shadow-xl"
              >
                {hasPrint ? (
                  <DropdownMenuItem
                    className="h-9 rounded-xl px-3 text-[13.5px]"
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
          ) : null}
        </div>
      </div>
      {children}
    </>
  );
}
