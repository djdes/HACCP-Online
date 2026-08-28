"use client";

import type { ReactNode } from "react";
import { MoreHorizontal, Printer, Redo2, Settings2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DOC_TITLE_ROW_CLASS } from "@/components/journals/journal-responsive";
import { cn } from "@/lib/utils";

/**
 * Контракт кнопок отмены. Проп опциональный: журналы, где отмена ещё
 * не подключена, ничего не передают — и шапка выглядит как раньше.
 */
export type DocumentBarUndo = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Сколько правок можно откатить — бейджем на кнопке. */
  undoCount?: number;
};

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
  /** Отмена/повтор правок сетки. Не передан — кнопок нет. */
  undo?: DocumentBarUndo;
  className?: string;
  /**
   * Диалоги/поповеры, которым нужен монтаж вне DropdownMenuContent
   * (например, подтверждение «Скопировать вчерашнее»).
   */
  children?: ReactNode;
};

/**
 * Иконочная кнопка шапки. `relative` — под бейдж-счётчик отмены,
 * disabled приглушается, чтобы «отменять нечего» читалось без тултипа.
 */
const ICON_BUTTON_CLASS =
  "relative flex size-9 items-center justify-center rounded-lg border-0 bg-[#5566f6]/[0.04] text-[#5566f6] transition-colors duration-150 hover:bg-[#5566f6]/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 disabled:cursor-not-allowed disabled:bg-[#f5f6ff] disabled:text-[#c3c6d6] disabled:hover:bg-[#f5f6ff]";

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
  undo,
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
          {undo ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={undo.onUndo}
                disabled={!undo.canUndo}
                aria-label="Отменить последнее изменение"
                title="Отменить (Ctrl+Z). Отменяются только ваши правки в этой вкладке — автозаполнение не трогаем."
                className={ICON_BUTTON_CLASS}
              >
                <Undo2 className="size-4" />
                {undo.undoCount ? (
                  <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-[#5566f6] px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">
                    {undo.undoCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={undo.onRedo}
                disabled={!undo.canRedo}
                aria-label="Повторить отменённое изменение"
                title="Повторить (Ctrl+Shift+Z)"
                className={ICON_BUTTON_CLASS}
              >
                <Redo2 className="size-4" />
              </button>
            </div>
          ) : null}
          {/* Печать страницы (Ctrl+P) — иконка рядом с «Настройками
              журнала», как на эталоне. Печатные стили документа уже есть,
              поэтому кнопка просто зовёт window.print(). Серверный PDF
              остаётся отдельным пунктом в меню «⋯». */}
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Распечатать"
            title="Распечатать"
            className="flex size-9 items-center justify-center rounded-lg border-0 bg-[#5566f6]/[0.04] text-[#5566f6] transition-colors duration-150 hover:bg-[#5566f6]/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
          >
            <Printer className="size-4" />
          </button>
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
