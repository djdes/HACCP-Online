"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, Lock, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableContextMenu, type TableContextMenuItem } from "@/components/journals/table-context-menu";
import {
  JOURNAL_COLUMN_LABEL_MAX,
  columnsConfigFromResolved,
  resolveColumns,
  type JournalColumnsConfig,
  type ResolvedJournalColumn,
} from "@/lib/journal-columns";
import { LONG_PRESS_MS, isLongPressCancelled, type PressPoint } from "@/lib/long-press";
import { cn } from "@/lib/utils";

/**
 * Колонки таблицы журнала: одна секция для «Настроек журнала» обоих
 * бракеражей, меню заголовка таблицы (ПКМ / долгое нажатие) и диалог
 * «Применить ко всем документам журнала».
 *
 * Хранение и правила — `src/lib/journal-columns.ts`. Здесь только UI:
 * скрытие колонки данных не удаляет, обязательную колонку скрыть нельзя.
 */

export type ColumnsApplyScope = "new-only" | "active-any" | "all";

/** Новый набор колонок: скрыть/показать одну колонку. */
export function toggleColumnHidden(columns: JournalColumnsConfig, key: string, hidden: boolean): JournalColumnsConfig {
  const set = new Set(columns.hidden);
  if (hidden) set.add(key);
  else set.delete(key);
  return { ...columns, hidden: [...set] };
}

/** Новый набор колонок: переименовать одну колонку ("" — стандартное название). */
export function renameColumn(columns: JournalColumnsConfig, key: string, label: string): JournalColumnsConfig {
  const labels = { ...columns.labels };
  const value = label.replace(/\s+/g, " ").trim().slice(0, JOURNAL_COLUMN_LABEL_MAX);
  if (value) labels[key] = value;
  else delete labels[key];
  return { ...columns, labels };
}

function ColumnRow({
  column,
  onToggle,
  onRename,
  disabled,
}: {
  column: ResolvedJournalColumn;
  onToggle: (hidden: boolean) => void;
  onRename: (label: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(column.label);
  }, [column.label, editing]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const value = draft.trim();
    onRename(value === column.defaultLabel ? "" : value);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors duration-150",
        column.hidden ? "border-[#ececf4] bg-white" : "border-[#ececf4] bg-[#fafbff] hover:bg-[#f5f6ff]"
      )}
    >
      <Checkbox
        checked={!column.hidden}
        disabled={disabled || column.required}
        onCheckedChange={(value) => onToggle(value !== true)}
        aria-label={column.hidden ? `Показать колонку «${column.label}»` : `Скрыть колонку «${column.label}»`}
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            maxLength={JOURNAL_COLUMN_LABEL_MAX}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraft(column.label);
                setEditing(false);
              }
            }}
            className="h-9 w-full rounded-xl border border-[#dcdfed] bg-white px-3 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            aria-label="Название колонки"
          />
        ) : (
          <div className={cn("text-[14px] leading-snug", column.hidden ? "text-[#9b9fb3]" : "text-[#0b1024]")}>
            {column.label}
          </div>
        )}
        {column.required ? (
          <div className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-[#9b9fb3]">
            <Lock className="size-3" />
            Обязательная колонка бланка
          </div>
        ) : column.label !== column.defaultLabel && !editing ? (
          <div className="mt-0.5 text-[12px] text-[#9b9fb3]">Стандартное: {column.defaultLabel}</div>
        ) : null}
      </div>
      {!disabled ? (
        <div className="flex shrink-0 items-center gap-1">
          {column.label !== column.defaultLabel && !editing ? (
            <button
              type="button"
              onClick={() => onRename("")}
              className="rounded-xl p-2 text-[#9b9fb3] transition-colors duration-150 hover:bg-white hover:text-[#3848c7]"
              title="Вернуть стандартное название"
              aria-label="Вернуть стандартное название"
            >
              <RotateCcw className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (editing ? commit() : setEditing(true))}
            className="rounded-xl p-2 text-[#6f7282] transition-colors duration-150 hover:bg-white hover:text-[#3848c7]"
            title={editing ? "Готово" : "Переименовать колонку"}
            aria-label={editing ? "Готово" : "Переименовать колонку"}
          >
            {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Секция «Колонки таблицы» для модалки «Настройки журнала». Работает с
 * черновиком конфига: изменения уходят на сервер кнопкой «Сохранить»
 * модалки. «Применить ко всем» — сразу, через подтверждение.
 */
export function JournalColumnsSettings({
  code,
  config,
  onChange,
  canApplyToAll,
  onApplyToAll,
}: {
  code: string;
  config: Record<string, unknown>;
  onChange: (columns: JournalColumnsConfig) => void;
  /** Руководитель может сделать набор общим для журнала. */
  canApplyToAll?: boolean;
  /**
   * Секция живёт внутри модалки Radix: подтверждение поверх неё не получает
   * кликов. Страница закрывает модалку и открывает подтверждение сама
   * (`useColumnHeaderMenu().openApplyToAll`) с черновиком набора.
   */
  onApplyToAll?: (columns: JournalColumnsConfig) => void;
}) {
  const [applyOpen, setApplyOpen] = useState(false);
  const columns = useMemo(() => resolveColumns(code, config), [code, config]);
  const current = useMemo(() => columnsConfigFromResolved(columns), [columns]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">Колонки таблицы</div>
        {canApplyToAll ? (
          <button
            type="button"
            onClick={() => (onApplyToAll ? onApplyToAll(current) : setApplyOpen(true))}
            className="text-[13px] font-medium text-[#3848c7] underline-offset-2 transition-colors duration-150 hover:text-[#5566f6] hover:underline"
          >
            Применить ко всем документам…
          </button>
        ) : null}
      </div>
      <p className="flex gap-1.5 text-[12.5px] leading-[1.45] text-[#6f7282]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[#5566f6]" />
        Скрытая колонка не печатается и не видна в таблице, но записанные в ней данные сохраняются — включите её снова, и они
        вернутся. Карандаш меняет название колонки только в этом документе.
      </p>
      <div className="space-y-2">
        {columns.map((column) => (
          <ColumnRow
            key={column.key}
            column={column}
            onToggle={(hidden) => onChange(toggleColumnHidden(current, column.key, hidden))}
            onRename={(label) => onChange(renameColumn(current, column.key, label))}
          />
        ))}
      </div>
      <ApplyColumnsToAllDialog code={code} columns={current} open={applyOpen} onClose={() => setApplyOpen(false)} />
    </div>
  );
}

/** «Применить ко всем документам журнала»: объём, подтверждение, запрос, toast. */
export function ApplyColumnsToAllDialog({
  code,
  columns,
  open,
  onClose,
}: {
  code: string;
  columns: JournalColumnsConfig;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<ColumnsApplyScope>("active-any");
  const options: Array<{ value: ColumnsApplyScope; label: string; hint: string }> = [
    { value: "active-any", label: "Новые и активные документы", hint: "Закрытые документы остаются как были." },
    { value: "all", label: "Все документы журнала", hint: "Включая закрытые — перепечатка покажет новый набор." },
    { value: "new-only", label: "Только новые документы", hint: "Уже созданные документы не меняются." },
  ];

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      variant="info"
      title="Сделать набор колонок общим для журнала?"
      description="Этот набор колонок и их названия получат документы журнала в выбранном объёме и все документы, созданные после этого."
      bullets={[
        { label: "Настройка станет общей для журнала", tone: "info" },
        { label: "Личные настройки документов в выбранном объёме сбросятся", tone: "warn" },
        { label: "Данные скрытых колонок не удаляются" },
      ]}
      confirmLabel="Применить"
      onConfirm={async () => {
        const response = await fetch(`/api/settings/journal-columns/${code}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columns, applyTo: scope }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(data?.error ?? "Не удалось применить набор колонок");
          return;
        }
        const updated = typeof data?.documentsUpdated === "number" ? data.documentsUpdated : 0;
        toast.success(
          scope === "new-only"
            ? "Набор колонок сохранён для новых документов"
            : `Обновлено: ${updated} ${updated % 10 === 1 && updated % 100 !== 11 ? "документ" : updated % 10 >= 2 && updated % 10 <= 4 && (updated % 100 < 10 || updated % 100 >= 20) ? "документа" : "документов"}`
        );
        onClose();
        router.refresh();
      }}
    >
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 transition-colors duration-150",
              scope === option.value ? "border-[#5566f6] bg-[#f5f6ff]" : "border-[#ececf4] bg-white hover:bg-[#fafbff]"
            )}
          >
            <input
              type="radio"
              name="columns-apply-scope"
              checked={scope === option.value}
              onChange={() => setScope(option.value)}
              className="mt-1 size-4 accent-[#5566f6]"
            />
            <span>
              <span className="block text-[14px] font-medium text-[#0b1024]">{option.label}</span>
              <span className="block text-[12.5px] text-[#6f7282]">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </ConfirmDialog>
  );
}

type HeaderMenuState = { x: number; y: number; column: ResolvedJournalColumn } | null;

/**
 * Меню заголовка колонки: ПКМ на компьютере, долгое нажатие на телефоне.
 * Возвращает обработчики для `<th>` и готовый элемент меню.
 */
export function useColumnHeaderMenu({
  code,
  config,
  enabled,
  canApplyToAll,
  onChange,
}: {
  code: string;
  config: Record<string, unknown>;
  enabled: boolean;
  canApplyToAll?: boolean;
  /** Сохранить новый набор колонок документа (сразу, без модалки). */
  onChange: (columns: JournalColumnsConfig) => void | Promise<void>;
}) {
  const [menu, setMenu] = useState<HeaderMenuState>(null);
  const [renaming, setRenaming] = useState<ResolvedJournalColumn | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  // Набор из черновика модалки настроек; нет — сохранённый набор документа.
  const [applyColumns, setApplyColumns] = useState<JournalColumnsConfig | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; start: PressPoint } | null>(null);
  const columns = useMemo(() => resolveColumns(code, config), [code, config]);
  const current = useMemo(() => columnsConfigFromResolved(columns), [columns]);

  const cancelPress = useCallback(() => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  useEffect(() => cancelPress, [cancelPress]);

  const headerProps = useCallback(
    (key: string) => {
      const column = columns.find((item) => item.key === key);
      if (!enabled || !column) return {};
      return {
        onContextMenu: (event: React.MouseEvent) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY, column });
        },
        onTouchStart: (event: React.TouchEvent) => {
          if (event.touches.length !== 1) return cancelPress();
          const touch = event.touches[0];
          const start = { x: touch.clientX, y: touch.clientY };
          cancelPress();
          press.current = {
            start,
            timer: setTimeout(() => {
              press.current = null;
              setMenu({ x: start.x, y: start.y, column });
            }, LONG_PRESS_MS),
          };
        },
        onTouchMove: (event: React.TouchEvent) => {
          const touch = event.touches[0];
          if (press.current && touch && isLongPressCancelled(press.current.start, { x: touch.clientX, y: touch.clientY })) {
            cancelPress();
          }
        },
        onTouchEnd: cancelPress,
        onTouchCancel: cancelPress,
        title: "Правый клик или долгое нажатие — меню колонки",
      };
    },
    [cancelPress, columns, enabled]
  );

  const items: TableContextMenuItem[] = menu
    ? [
        {
          key: "rename",
          label: "Переименовать",
          onSelect: () => {
            setRenaming(menu.column);
            setRenameDraft(menu.column.label);
          },
        },
        ...(menu.column.required
          ? [{ key: "required", label: "Обязательная колонка бланка — скрыть нельзя", onSelect: () => undefined }]
          : [
              {
                key: "hide",
                label: "Скрыть колонку",
                onSelect: () => void onChange(toggleColumnHidden(current, menu.column.key, true)),
              },
            ]),
        ...(canApplyToAll
          ? [{ key: "apply", label: "Применить ко всем документам…", separatorBefore: true, onSelect: () => setApplyOpen(true) }]
          : []),
      ]
    : [];

  const element = (
    <>
      {menu ? (
        <TableContextMenu
          x={menu.x}
          y={menu.y}
          items={items}
          onClose={() => setMenu(null)}
          ariaLabel={`Колонка «${menu.column.label}»`}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        variant="info"
        icon={Pencil}
        title="Название колонки"
        description="Меняется в таблице, карточках и печати этого документа. Пустое поле — стандартное название."
        confirmLabel="Сохранить"
        onConfirm={async () => {
          if (!renaming) return;
          const value = renameDraft.trim();
          await onChange(renameColumn(current, renaming.key, value === renaming.defaultLabel ? "" : value));
          setRenaming(null);
        }}
      >
        <input
          value={renameDraft}
          maxLength={JOURNAL_COLUMN_LABEL_MAX}
          onChange={(event) => setRenameDraft(event.target.value)}
          placeholder={renaming?.defaultLabel}
          className="h-12 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          aria-label="Название колонки"
          autoFocus
        />
      </ConfirmDialog>
      <ApplyColumnsToAllDialog
        code={code}
        columns={applyColumns ?? current}
        open={applyOpen}
        onClose={() => {
          setApplyOpen(false);
          setApplyColumns(null);
        }}
      />
    </>
  );

  const openApplyToAll = useCallback((draft?: JournalColumnsConfig) => {
    setApplyColumns(draft ?? null);
    setApplyOpen(true);
  }, []);

  return { headerProps, element, columns, openApplyToAll };
}
