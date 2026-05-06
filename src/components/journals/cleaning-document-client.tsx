"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, GripVertical, LayoutGrid, Pencil, Plus, Printer, RefreshCw, Rows3, Trash2, UserPlus, X } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  applyCleaningAutoFillToConfig,
  applyRoomScheduleToMatrix,
  CLEANING_DOCUMENT_TITLE,
  CLEANING_PAGE_TITLE,
  createCleaningResponsibleRow,
  createCleaningRoomRow,
  deleteCleaningResponsibleRow,
  deleteCleaningRoomRow,
  getCleaningPeriodLabel,
  normalizeCleaningDocumentConfig,
  setCleaningMatrixValue,
  toggleCleaningMatrixValue,
  type CleaningDocumentConfig,
  type CleaningMatrixValue,
  type CleaningResponsible,
  type CleaningResponsibleKind,
  type CleaningRoomItem,
} from "@/lib/cleaning-document";
import { buildDateKeys, isWeekend, toDateKey } from "@/lib/hygiene-document";
import { getCalendarDayKind } from "@/lib/production-calendar-data";
import {
  WEEKDAY_LABELS_RU,
  WEEKDAY_MASK_ALL,
  WEEKDAY_MASK_NONE,
  WEEKDAY_MASK_WEEKENDS,
  WEEKDAY_MASK_WORKDAYS,
  describeMask,
  isMaskedWeekday,
  normalizeMask,
  toggleWeekdayBit,
} from "@/lib/weekday-mask";
import { getDistinctRoleLabels, getUsersForRoleLabel } from "@/lib/user-roles";
import { DocumentBackLink } from "@/components/journals/document-back-link";
import { DocumentCloseButton } from "@/components/journals/document-close-button";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { PositionNativeOptions, PositionSelectItems } from "@/components/shared/position-select";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";

type UserItem = { id: string; name: string; role: string };
type EntryItem = { id: string; employeeId: string; date: string; data: unknown };
type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  autoFill: boolean;
  users: UserItem[];
  config: CleaningDocumentConfig;
  initialEntries: EntryItem[];
  /**
   * True when the org has connected TasksFlow. Reserved for the upcoming
   * auto-poll on mount + manual «Sync from TasksFlow» button. Optional
   * so existing callers (no integration) keep compiling without
   * touching every render site.
   */
  hasTasksFlowIntegration?: boolean;
  /**
   * Зарегистрированные в /settings/buildings корпуса и помещения.
   * Используется для нового rooms-режима (race-задачи). Старые
   * caller'ы могут не передавать — режим pairs работает как раньше.
   */
  buildings?: Array<{
    id: string;
    name: string;
    rooms: Array<{ id: string; name: string; kind: string }>;
  }>;
  /**
   * Если true — рендерим Settings dialog в Design v2 стиле через
   * `<JournalSettingsModal>`. Сама механика и data-flow остаются
   * прежними; меняется только обёртка модалки. Включается через
   * `Organization.experimentalUiV2`. Default true с 2026-05 — V2.
   * См. docs/PIPELINE-VISION.md раздел P3.
   */
  useV2?: boolean;
};
type SettingsState = { title: string; cleaningRole: string; cleaningUserId: string; controlRole: string; controlUserId: string };
type RoomFormState = { id: string | null; name: string; detergent: string; currentScope: string[]; generalScope: string[]; currentDays: number; generalDays: number };
type ResponsibleFormState = { id: string | null; kind: CleaningResponsibleKind; title: string; userId: string };
type RowDescriptor =
  | { id: string; kind: "room"; room: CleaningRoomItem }
  | { id: string; kind: "cleaning"; responsible: CleaningResponsible }
  | { id: string; kind: "control"; responsible: CleaningResponsible };

// Pipeline-style редактор списка подзадач — drag-handle + reorder + add/remove.
// Использует @dnd-kit/sortable как в /settings/journal-pipelines-tree.
// Каждая строка — sortable-item с GripVertical-ручкой слева, нумерованным
// бейджем, inline-input'ом, и кнопкой удаления справа.
//
// Хранится как string[]; пустые строки фильтруются на submit. Каждой строке
// присваивается стабильный uid для @dnd-kit (значения сами по себе могут
// дублироваться, поэтому нельзя key={value} — используем uid из state).
type ScopeListItem = { uid: string; text: string };
const SCOPE_UID_PREFIX = "scope-uid-";
let SCOPE_UID_COUNTER = 0;
function nextScopeUid() {
  SCOPE_UID_COUNTER += 1;
  return `${SCOPE_UID_PREFIX}${SCOPE_UID_COUNTER}-${Math.random().toString(36).slice(2, 7)}`;
}

function SortableScopeRow(props: {
  item: ScopeListItem;
  index: number;
  total: number;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (text: string) => void;
  onRemove: () => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  placeholder?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.item.uid });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 rounded-2xl border bg-white pl-1 pr-2 py-1.5 transition-colors ${
        isDragging
          ? "border-[#5566f6] bg-[#f5f6ff] shadow-[0_16px_40px_-24px_rgba(85,102,246,0.55)]"
          : "border-[#ececf4] focus-within:border-[#5566f6] focus-within:ring-4 focus-within:ring-[#5566f6]/15"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Перетащить шаг"
        className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-[#9b9fb3] hover:bg-[#f5f6ff] hover:text-[#5566f6] active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-[12px] font-semibold text-[#3848c7] tabular-nums">
        {props.index + 1}
      </span>
      <Input
        ref={props.inputRef}
        value={props.item.text}
        onChange={(event) => props.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            props.onEnter();
          }
          if (event.key === "Backspace" && props.item.text === "" && props.total > 1) {
            event.preventDefault();
            props.onBackspaceEmpty();
          }
        }}
        placeholder={props.placeholder}
        className="h-9 flex-1 rounded-xl border-0 bg-transparent px-2 text-[14px] shadow-none focus-visible:ring-0"
      />
      <button
        type="button"
        onClick={props.onRemove}
        className="flex size-8 shrink-0 items-center justify-center rounded-xl text-[#9b9fb3] transition-colors hover:bg-[#fff4f2] hover:text-[#a13a32]"
        aria-label="Удалить шаг"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

function ScopeListEditor(props: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  emptyHint?: string;
}) {
  // Связываем стабильные uid с values из props. Когда внешний массив
  // меняется по длине (родитель добавил/удалил), пересинхронизируем
  // — но только если длина не совпадает; иначе оставляем как есть.
  const [items, setItems] = useState<ScopeListItem[]>(() =>
    props.value.map((text) => ({ uid: nextScopeUid(), text }))
  );
  // Reset при внешнем изменении длины (например, шаблон загрузился).
  useEffect(() => {
    setItems((prev) => {
      if (prev.length === props.value.length && prev.every((it, i) => it.text === props.value[i])) {
        return prev;
      }
      // Стараемся переиспользовать uid'ы по индексу.
      return props.value.map((text, i) => ({
        uid: prev[i]?.uid ?? nextScopeUid(),
        text,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function pushChange(next: ScopeListItem[]) {
    setItems(next);
    props.onChange(next.map((it) => it.text));
  }
  function update(uid: string, text: string) {
    pushChange(items.map((it) => (it.uid === uid ? { ...it, text } : it)));
  }
  function remove(uid: string) {
    pushChange(items.filter((it) => it.uid !== uid));
  }
  function add() {
    const newItem: ScopeListItem = { uid: nextScopeUid(), text: "" };
    const next = [...items, newItem];
    pushChange(next);
    setTimeout(() => {
      inputRefs.current.get(newItem.uid)?.focus();
    }, 0);
  }
  function focusPrev(uid: string) {
    const idx = items.findIndex((it) => it.uid === uid);
    const prev = items[Math.max(0, idx - 1)];
    if (prev) {
      setTimeout(() => inputRefs.current.get(prev.uid)?.focus(), 0);
    }
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.uid === active.id);
    const newIndex = items.findIndex((it) => it.uid === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    pushChange(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-3 text-[13px] text-[#6f7282]">
          {props.emptyHint ?? "Шагов пока нет — добавьте первый шаг ниже."}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((it) => it.uid)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((it, index) => (
                <SortableScopeRow
                  key={it.uid}
                  item={it}
                  index={index}
                  total={items.length}
                  inputRef={(el) => {
                    inputRefs.current.set(it.uid, el);
                  }}
                  onChange={(text) => update(it.uid, text)}
                  onRemove={() => remove(it.uid)}
                  onEnter={() => add()}
                  onBackspaceEmpty={() => {
                    focusPrev(it.uid);
                    remove(it.uid);
                  }}
                  placeholder={props.placeholder}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#dcdfed] bg-white px-3 py-2 text-[13px] font-medium text-[#3848c7] transition-colors hover:border-[#5566f6] hover:bg-[#f5f6ff]"
      >
        <Plus className="size-4" />
        {props.addLabel ?? "Добавить шаг"}
      </button>
    </div>
  );
}

/** Picker для bitmask дней недели — 7 чипов Пн-Вс + быстрые пресеты. */
function WeekdayMaskPicker(props: {
  value: number;
  onChange: (next: number) => void;
}) {
  const mask = normalizeMask(props.value, 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_LABELS_RU.map((label, idx) => {
          const isOn = isMaskedWeekday(mask, idx);
          const isWeekendChip = idx >= 5;
          return (
            <button
              key={label}
              type="button"
              onClick={() => props.onChange(toggleWeekdayBit(mask, idx))}
              className={`flex h-9 min-w-10 items-center justify-center rounded-xl border px-2.5 text-[13px] font-medium transition-colors ${
                isOn
                  ? "border-[#5566f6] bg-[#5566f6] text-white shadow-[0_6px_16px_-8px_rgba(85,102,246,0.55)]"
                  : isWeekendChip
                    ? "border-[#fff4f2] bg-[#fff4f2] text-[#a13a32] hover:border-[#a13a32]/40"
                    : "border-[#dcdfed] bg-white text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
              }`}
              aria-pressed={isOn}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5 text-[12px]">
        <button
          type="button"
          onClick={() => props.onChange(WEEKDAY_MASK_ALL)}
          className="rounded-full border border-[#dcdfed] bg-white px-2.5 py-1 text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          Каждый день
        </button>
        <button
          type="button"
          onClick={() => props.onChange(WEEKDAY_MASK_WORKDAYS)}
          className="rounded-full border border-[#dcdfed] bg-white px-2.5 py-1 text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          По будням
        </button>
        <button
          type="button"
          onClick={() => props.onChange(WEEKDAY_MASK_WEEKENDS)}
          className="rounded-full border border-[#dcdfed] bg-white px-2.5 py-1 text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          По выходным
        </button>
        <button
          type="button"
          onClick={() => props.onChange(WEEKDAY_MASK_NONE)}
          className="rounded-full border border-[#dcdfed] bg-white px-2.5 py-1 text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          Очистить
        </button>
        <span className="ml-auto text-[#6f7282]">{describeMask(mask)}</span>
      </div>
    </div>
  );
}
const primaryUserId = (users: UserItem[], roleLabel: string) => getUsersForRoleLabel(users, roleLabel)[0]?.id || "";
const userNameById = (users: UserItem[], userId: string) => users.find((user) => user.id === userId)?.name || "";
const buildSettingsState = (config: CleaningDocumentConfig): SettingsState => ({
  title: config.documentTitle || config.title || CLEANING_DOCUMENT_TITLE,
  cleaningRole: config.cleaningResponsibles[0]?.title || "",
  cleaningUserId: config.cleaningResponsibles[0]?.userId || "",
  controlRole: config.controlResponsibles[0]?.title || "",
  controlUserId: config.controlResponsibles[0]?.userId || "",
});
const buildRoomState = (room?: CleaningRoomItem): RoomFormState => ({
  id: room?.id || null,
  name: room?.name || "",
  detergent: room?.detergent || "",
  currentScope: room?.currentScope ? [...room.currentScope] : [],
  generalScope: room?.generalScope ? [...room.generalScope] : [],
  // Defaults: текущая ежедневно, генеральная не запланирована.
  currentDays: typeof room?.currentDays === "number" ? room.currentDays : 127,
  generalDays: typeof room?.generalDays === "number" ? room.generalDays : 0,
});
const buildResponsibleState = (kind: CleaningResponsibleKind, responsible?: CleaningResponsible): ResponsibleFormState => ({
  id: responsible?.id || null,
  kind,
  title: responsible?.title || "",
  userId: responsible?.userId || "",
});

function ConfirmDialog(props: { open: boolean; title: string; submitLabel: string; onOpenChange: (open: boolean) => void; onSubmit: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b px-5 py-6 sm:px-10 sm:py-8">
          <div className="flex items-start justify-between gap-6">
            <DialogTitle className="text-[24px] font-semibold text-black">{props.title}</DialogTitle>
            <button type="button" className="rounded-xl p-2 hover:bg-black/5" onClick={() => props.onOpenChange(false)}><X className="size-7" /></button>
          </div>
        </DialogHeader>
        <div className="flex justify-end px-5 py-6 sm:px-10 sm:py-8">
          <Button type="button" disabled={submitting} onClick={async () => { setSubmitting(true); try { await props.onSubmit(); props.onOpenChange(false); } finally { setSubmitting(false); } }} className="h-11 rounded-2xl bg-[#5563ff] px-4 text-[15px] text-white hover:bg-[#4554ff]">{submitting ? "Сохранение..." : props.submitLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CleaningDocumentClient(props: Props) {
  const router = useRouter();
  const printMode = false;
  const normalized = useMemo(() => normalizeCleaningDocumentConfig(props.config, { users: props.users }), [props.config, props.users]);
  const [config, setConfig] = useState(normalized);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  // Multi-select cells (rowId::dateKey) для bulk-edit. Когда `cellSelectMode`
  // ON: клик по ячейке добавляет/убирает её из selection, mousedown+drag
  // выделяет диапазон (как в Excel).
  const [cellSelectMode, setCellSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  // Drag-state хранится в refs (а не useState), чтобы read из mouseenter
  // handler'а был синхронным. setState async и handler читал бы stale
  // значение между ячейками, drag «терял» промежуточные.
  //
  // Excel-style rectangle drag-select:
  //   • mousedown на ячейке A → anchor = A, base = текущая selectedCells,
  //     mode = "remove" если A уже в base, иначе "add"
  //   • mousemove на ячейку B → applyRect(A, B): selectedCells = base ± cells_in_rect(A,B)
  //   • mouseup → очищает anchor; selectedCells уже финальный
  type CellPos = { rowId: string; dateKey: string };
  const dragAnchorRef = useRef<CellPos | null>(null);
  const dragBaseRef = useRef<Set<string>>(new Set());
  const dragModeRef = useRef<"add" | "remove" | null>(null);
  // Refs с актуальным порядком rows / dayKeys — нужны applyRectToSelection,
  // который вызывается из mouseenter handler'ов и должен читать самую
  // свежую раскладку (rows может пересчитаться при патче config).
  // Сами `rows` и `dayKeys` объявлены ниже как useMemo; sync через useEffect.
  const rowIdToIndexRef = useRef<Map<string, number>>(new Map());
  const dateKeyToIndexRef = useRef<Map<string, number>>(new Map());
  const rowsOrderRef = useRef<RowDescriptor[]>([]);
  const dateOrderRef = useRef<string[]>([]);
  // Дополнительный counter — для re-render UI «выделено N» в realtime
  // (selectedCells changes уже триггерят re-render, dragAnchorRef нет).
  const [, setDragTick] = useState(0);
  const cellKey = (rowId: string, dateKey: string) => `${rowId}::${dateKey}`;
  function clearCellSelection() {
    setSelectedCells(new Set());
  }
  // Mouse-up listener — снимает drag-state. Глобальный (на window),
  // чтобы работало даже если кнопка отпущена за пределами grid'а
  // (после того как пользователь утащил курсор за viewport).
  useEffect(() => {
    function handleUp() {
      dragAnchorRef.current = null;
      dragBaseRef.current = new Set();
      dragModeRef.current = null;
      setDragTick((n) => n + 1);
    }
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, []);
  // Drag-helpers. ref-based для синхронного read'а в mouseenter.
  // Применяет «прямоугольник от anchor до end» к selectedCells.
  // base — снимок selection в момент mousedown; mode — добавляем или убираем.
  function applyRectToSelection(anchor: CellPos, end: CellPos) {
    const aRow = rowIdToIndexRef.current.get(anchor.rowId);
    const eRow = rowIdToIndexRef.current.get(end.rowId);
    const aDate = dateKeyToIndexRef.current.get(anchor.dateKey);
    const eDate = dateKeyToIndexRef.current.get(end.dateKey);
    if (aRow == null || eRow == null || aDate == null || eDate == null) return;
    const r0 = Math.min(aRow, eRow);
    const r1 = Math.max(aRow, eRow);
    const d0 = Math.min(aDate, eDate);
    const d1 = Math.max(aDate, eDate);
    const base = dragBaseRef.current;
    const mode = dragModeRef.current ?? "add";
    const next = new Set(base);
    const rowsArr = rowsOrderRef.current;
    const dateArr = dateOrderRef.current;
    for (let i = r0; i <= r1; i += 1) {
      for (let j = d0; j <= d1; j += 1) {
        const row = rowsArr[i];
        const day = dateArr[j];
        if (!row || !day) continue;
        const k = cellKey(row.id, day);
        if (mode === "add") next.add(k);
        else next.delete(k);
      }
    }
    setSelectedCells(next);
  }
  function startDragOnCell(rowId: string, dateKey: string) {
    if (!cellSelectMode) return;
    const anchor: CellPos = { rowId, dateKey };
    const k = cellKey(rowId, dateKey);
    dragAnchorRef.current = anchor;
    dragBaseRef.current = new Set(selectedCells);
    dragModeRef.current = selectedCells.has(k) ? "remove" : "add";
    applyRectToSelection(anchor, anchor);
    setDragTick((n) => n + 1);
  }
  function continueDragOnCell(rowId: string, dateKey: string) {
    if (!cellSelectMode) return;
    const anchor = dragAnchorRef.current;
    if (!anchor || !dragModeRef.current) return;
    applyRectToSelection(anchor, { rowId, dateKey });
  }
  const [roomDialog, setRoomDialog] = useState<RoomFormState | null>(null);
  const [responsibleDialog, setResponsibleDialog] = useState<ResponsibleFormState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsState, setSettingsState] = useState(buildSettingsState(normalized));
  const [deleteOpen, setDeleteOpen] = useState(false);
  // «Сохранить как шаблон по умолчанию» — confirm dialog для записи
  // текущего config'а в Organization.defaultCleaningDocumentConfig.
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [saveAsTemplateBusy, setSaveAsTemplateBusy] = useState(false);

  // «Заполнить по плану» — применяет weekday-маски всех помещений к
  // матрице. По умолчанию fill-empty (только пустые), но если зажат
  // shift / есть отметки → confirm-dialog с overwrite.
  const [scheduleApplyOpen, setScheduleApplyOpen] = useState(false);
  const [scheduleApplyMode, setScheduleApplyMode] = useState<"fill-empty" | "overwrite">("fill-empty");
  async function applySchedulePlan(mode: "fill-empty" | "overwrite") {
    const next = applyRoomScheduleToMatrix(config, dayKeys, mode);
    await patchDocument(next);
    const planned = next.rooms.reduce((acc, room) => {
      const row = next.matrix[room.id] ?? {};
      return acc + Object.keys(row).length;
    }, 0);
    toast.success(
      mode === "overwrite"
        ? `План применён заново: ${planned} ячеек`
        : `План применён к пустым ячейкам: ${planned} запланировано всего`,
    );
    setScheduleApplyOpen(false);
  }

  // Pipeline-mode setters — патчат config и persist'ят сразу.
  // perRoom = у каждой комнаты свой scope (текущее поведение)
  // global  = один общий список для всех комнат
  // legacy  = без подзадач, чек-лист отключён
  async function setCleaningSubtaskMode(mode: "perRoom" | "global" | "legacy") {
    const next = normalizeCleaningDocumentConfig(
      { ...config, cleaningSubtaskMode: mode },
      { users: props.users },
    );
    await patchDocument(next);
  }
  async function setGlobalSubtasks(value: { current?: string[]; general?: string[] }) {
    const prev = config.globalSubtasks ?? { current: [], general: [] };
    const merged = {
      current: value.current ?? prev.current,
      general: value.general ?? prev.general,
    };
    const next = normalizeCleaningDocumentConfig(
      { ...config, globalSubtasks: merged },
      { users: props.users },
    );
    await patchDocument(next);
  }
  async function handleSaveAsTemplate() {
    setSaveAsTemplateBusy(true);
    try {
      const response = await fetch("/api/journals/cleaning/default-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error || "Не удалось сохранить шаблон");
        return;
      }
      toast.success("Шаблон сохранён — новые журналы уборки будут создаваться с этими настройками");
      setSaveAsTemplateOpen(false);
    } catch (err) {
      console.error("[cleaning] save-as-template failed", err);
      toast.error("Сетевая ошибка");
    } finally {
      setSaveAsTemplateBusy(false);
    }
  }
  // Mobile-only preference — Cards default. See hygiene-document-client.tsx
  // for the full rationale; the 920-px grid behind horizontal scroll is
  // unusable on a 320-px phone, so we collapse it into a per-row accordion
  // with tap-to-cycle day buttons. Desktop / print always use the table.
  const [mobileView, setMobileView] = useState<"cards" | "table">("cards");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cleaning-mobile-view");
      if (saved === "table" || saved === "cards") setMobileView(saved);
    } catch {
      /* localStorage blocked — fall back to 'cards' */
    }
  }, []);
  function switchMobileView(next: "cards" | "table") {
    setMobileView(next);
    try {
      window.localStorage.setItem("cleaning-mobile-view", next);
    } catch {
      /* ignore */
    }
  }
  const roleOptions = useMemo(() => getDistinctRoleLabels(props.users), [props.users]);
  const dayKeys = useMemo(() => buildDateKeys(props.dateFrom, props.dateTo), [props.dateFrom, props.dateTo]);

  const isRoomsMode = config.cleaningMode === "rooms";

  // Для rooms-mode: подгружаем имя комнаты из buildings и инициалы юзеров.
  const buildingsRoomMap = useMemo(() => {
    const m = new Map<string, string>();
    (props.buildings ?? []).forEach((b) =>
      b.rooms.forEach((r) => m.set(r.id, r.name))
    );
    return m;
  }, [props.buildings]);
  const userInitialsById = useMemo(() => {
    const m = new Map<string, string>();
    props.users.forEach((u) => {
      const parts = u.name.trim().split(/\s+/);
      const ini = parts
        .map((p) => p[0]?.toUpperCase() ?? "")
        .slice(0, 3)
        .join("");
      m.set(u.id, ini);
    });
    return m;
  }, [props.users]);

  const rows = useMemo<RowDescriptor[]>(() => {
    if (isRoomsMode) {
      // Rooms-mode: row = одно помещение из selectedRoomIds.
      return (config.selectedRoomIds ?? []).map((roomId) => {
        const stub: CleaningRoomItem = {
          id: roomId,
          areaId: null,
          name: buildingsRoomMap.get(roomId) ?? "Помещение",
          detergent: "",
          currentScope: [],
          generalScope: [],
        };
        return { id: roomId, kind: "room" as const, room: stub };
      });
    }
    return [
      ...config.rooms.map((room) => ({ id: room.id, kind: "room" as const, room })),
      ...config.cleaningResponsibles.map((responsible) => ({ id: responsible.id, kind: "cleaning" as const, responsible })),
      ...config.controlResponsibles.map((responsible) => ({ id: responsible.id, kind: "control" as const, responsible })),
    ];
  }, [config, isRoomsMode, buildingsRoomMap]);

  // Синкаем refs для rect-drag-select. Без этого applyRectToSelection
  // может прочитать stale rows при быстром переключении.
  useEffect(() => {
    rowsOrderRef.current = rows;
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i));
    rowIdToIndexRef.current = m;
  }, [rows]);
  useEffect(() => {
    dateOrderRef.current = dayKeys;
    const m = new Map<string, number>();
    dayKeys.forEach((d, i) => m.set(d, i));
    dateKeyToIndexRef.current = m;
  }, [dayKeys]);

  /** Выделить ВСЕ ячейки (rows × dates). Используется для bulk-«Применить». */
  function selectAllCells() {
    const next = new Set<string>();
    for (const row of rows) {
      for (const day of dayKeys) {
        next.add(cellKey(row.id, day));
      }
    }
    setSelectedCells(next);
    setCellSelectMode(true);
  }

  /** Значение ячейки. В rooms-mode — инициалы cleaner-а из
   *  JournalDocumentEntry с kind=cleaning_room. В pairs-mode — старая
   *  config.matrix логика. */
  function cellValue(row: RowDescriptor, dateKey: string): string {
    if (!isRoomsMode || row.kind !== "room") {
      return config.matrix[row.id]?.[dateKey] || "";
    }
    for (const e of props.initialEntries) {
      const d = e.data as Record<string, unknown> | null;
      if (
        d?.kind === "cleaning_room" &&
        d?.roomId === row.id &&
        d?.dateKey === dateKey
      ) {
        const cleanerId = String(d.cleanerUserId ?? "");
        return userInitialsById.get(cleanerId) ?? "";
      }
    }
    return "";
  }

  useEffect(() => { setConfig(normalized); setSettingsState(buildSettingsState(normalized)); }, [normalized]);

  // TasksFlow round-trip:
  //   1. On mount, if the org has the integration, ask the server to
  //      pull task statuses from TasksFlow. If anything is newly
  //      completed, the server has already written the cell — we just
  //      router.refresh() to re-render.
  //   2. The action button calls the same endpoint with explicit toast
  //      so the user can force a refresh after closing a task in the
  //      cleaner's app without leaving the page.
  // Guarded by `hasTasksFlowIntegration` so orgs without integration
  // pay zero cost.
  const [tasksFlowSyncing, setTasksFlowSyncing] = useState(false);
  async function syncFromTasksFlow(opts?: { silent?: boolean }) {
    if (!props.hasTasksFlowIntegration || tasksFlowSyncing) return;
    setTasksFlowSyncing(true);
    try {
      const response = await fetch(
        "/api/integrations/tasksflow/sync-tasks",
        { method: "POST" }
      );
      if (!response.ok) {
        if (!opts?.silent) {
          toast.error("Не удалось обновить статусы из TasksFlow");
        }
        return;
      }
      const data = (await response.json()) as {
        checked: number;
        newlyCompleted: number;
        reopened: number;
        errors: number;
      };
      if (data.newlyCompleted > 0 || data.reopened > 0) {
        router.refresh();
      }
      if (!opts?.silent) {
        if (data.errors > 0) {
          toast.error("TasksFlow временно недоступен. Журнал продолжает работать.");
        } else if (data.newlyCompleted > 0) {
          toast.success(
            `Из TasksFlow подтянуто выполненных: ${data.newlyCompleted}`
          );
        } else if (data.checked === 0) {
          toast.info("Связанных задач в TasksFlow пока нет");
        } else {
          toast.info("Все задачи уже актуальны");
        }
      }
    } catch (error) {
      if (!opts?.silent) {
        toast.error(
          error instanceof Error ? error.message : "Ошибка обновления"
        );
      }
    } finally {
      setTasksFlowSyncing(false);
    }
  }
  useEffect(() => {
    if (!props.hasTasksFlowIntegration) return;
    void syncFromTasksFlow({ silent: true });
    // Intentionally fires once per mount; do not re-run on every props
    // change or we'd hammer TasksFlow on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function patchDocument(nextConfig: CleaningDocumentConfig, overrides?: Record<string, unknown>) {
    setSaving(true);
    try {
      const payload = normalizeCleaningDocumentConfig(nextConfig, { users: props.users });
      const response = await fetch(`/api/journal-documents/${props.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.documentTitle || payload.title,
          config: payload,
          responsibleTitle: payload.controlResponsibles[0]?.title || props.responsibleTitle || null,
          responsibleUserId: payload.controlResponsibles[0]?.userId || props.responsibleUserId || null,
          autoFill: payload.autoFill.enabled,
          ...overrides,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setConfig(payload);
      setSettingsState(buildSettingsState(payload));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updateSettings(patch: Partial<SettingsState>) {
    const nextState = { ...settingsState, ...patch };
    setSettingsState(nextState);
    // Upsert ответственных:
    //   • если массив непустой — обновляем index 0 (как раньше)
    //   • если массив пустой и пользователь выбрал role+userId — создаём
    //     новую запись через createCleaningResponsibleRow (это и был
    //     баг P0.2: пустой .map() возвращал пустой массив, и сохранение
    //     терялось — settings-modal/banner-select показывали выбор, но
    //     после router.refresh() значение слетало)
    //   • если массив пустой и role+userId тоже пустые — оставляем как есть
    function upsertResponsible(
      kind: "cleaning" | "control",
      items: CleaningResponsible[],
      role: string,
      userId: string
    ): CleaningResponsible[] {
      const userName = userNameById(props.users, userId);
      if (items.length > 0) {
        return items.map((item, index) =>
          index === 0
            ? { ...item, title: role, userId, userName }
            : item
        );
      }
      // empty array
      if (!role && !userId) return items;
      return [
        createCleaningResponsibleRow({
          kind,
          title: role,
          userId,
          userName,
        }),
      ];
    }
    const nextConfig = normalizeCleaningDocumentConfig({
      ...config,
      title: nextState.title.trim() || CLEANING_DOCUMENT_TITLE,
      documentTitle: nextState.title.trim() || CLEANING_DOCUMENT_TITLE,
      cleaningResponsibles: upsertResponsible(
        "cleaning",
        config.cleaningResponsibles,
        nextState.cleaningRole,
        nextState.cleaningUserId
      ),
      controlResponsibles: upsertResponsible(
        "control",
        config.controlResponsibles,
        nextState.controlRole,
        nextState.controlUserId
      ),
    }, { users: props.users });
    await patchDocument(nextConfig);
  }

  async function toggleAutoFill(checked: boolean) {
    const baseConfig = normalizeCleaningDocumentConfig({
      ...config,
      settings: { ...config.settings, autoFillEnabled: checked },
      autoFill: { ...config.autoFill, enabled: checked },
    }, { users: props.users });
    const nextConfig = checked ? applyCleaningAutoFillToConfig({ config: baseConfig, dateFrom: props.dateFrom, dateTo: props.dateTo }) : baseConfig;
    await patchDocument(nextConfig, { autoFill: checked });
  }

  async function toggleSkipWeekends(checked: boolean) {
    const nextConfig = normalizeCleaningDocumentConfig({
      ...config,
      settings: { ...config.settings, skipWeekends: checked },
      autoFill: { ...config.autoFill, skipWeekends: checked },
      skipWeekends: checked,
    }, { users: props.users });
    await patchDocument(nextConfig);
  }

  async function updateCell(row: RowDescriptor, dateKey: string) {
    if (props.status !== "active") return;
    // В rooms-mode ячейки read-only — заполняются TasksFlow webhook'ом
    // когда уборщик закрывает свою задачу. Прямой клик игнорируем.
    if (isRoomsMode) return;
    // В режиме выделения клик игнорируется — drag-handlers (mousedown +
    // mouseenter) добавляют/убирают ячейки в selection.
    if (cellSelectMode) return;
    const currentValue = config.matrix[row.id]?.[dateKey] || "";
    const nextValue = row.kind === "room" ? toggleCleaningMatrixValue(currentValue) : currentValue ? "" : row.responsible.code;
    await patchDocument(setCleaningMatrixValue({ config, rowId: row.id, dateKey, value: nextValue }));
  }

  /**
   * Bulk-set значения для ВСЕХ выходных и праздников периода (для всех
   * room-rows). Не требует выделения. Использует production calendar.
   */
  async function bulkSetHolidaysAndWeekends(value: CleaningMatrixValue) {
    if (props.status !== "active" || isRoomsMode) return;
    const rooms = config.rooms;
    if (rooms.length === 0) return;
    const offDays = dayKeys.filter((dk) => {
      const k = getCalendarDayKind(dk).kind;
      return k === "weekend" || k === "holiday";
    });
    if (offDays.length === 0) {
      toast.info("В периоде нет выходных или праздников");
      return;
    }
    let nextConfig = config;
    let cellsUpdated = 0;
    for (const room of rooms) {
      for (const dateKey of offDays) {
        nextConfig = setCleaningMatrixValue({
          config: nextConfig,
          rowId: room.id,
          dateKey,
          value,
        });
        cellsUpdated += 1;
      }
    }
    try {
      await patchDocument(nextConfig);
      const action = value === "/" ? "помечены «Не проводилась»" : value === "" ? "очищены" : "обновлены";
      toast.success(
        `Выходных и праздников: ${offDays.length} дн. × ${rooms.length} помещ. = ${cellsUpdated} ячеек ${action}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось обновить ячейки",
      );
    }
  }

  /**
   * Bulk-set значения для всех selectedCells (rowId::dateKey). Один
   * patchDocument вместо N — быстрее и атомарно. После успеха выделение
   * сбрасывается.
   */
  async function bulkSetSelectedCells(value: CleaningMatrixValue) {
    if (props.status !== "active" || isRoomsMode) return;
    if (selectedCells.size === 0) return;
    let nextConfig = config;
    for (const k of selectedCells) {
      const [rowId, dateKey] = k.split("::");
      if (!rowId || !dateKey) continue;
      // responsible-rows используют свой code как значение, не T/G/«/».
      // Bulk-edit предназначен для room-rows; для responsible пропустим.
      const isRoom = config.rooms.some((r) => r.id === rowId);
      if (!isRoom) continue;
      nextConfig = setCleaningMatrixValue({
        config: nextConfig,
        rowId,
        dateKey,
        value,
      });
    }
    try {
      await patchDocument(nextConfig);
      const labelMap: Record<CleaningMatrixValue, string> = {
        "": "очищены",
        T: "помечены «Текущая»",
        G: "помечены «Генеральная»",
        "/": "помечены «Не проводилась»",
      };
      toast.success(
        `Ячеек обновлено: ${selectedCells.size} (${labelMap[value] ?? "обновлены"})`,
      );
      clearCellSelection();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось обновить ячейки",
      );
    }
  }

  async function deleteSelectedRows() {
    const count = selection.length;
    try {
      let nextConfig = config;
      for (const rowId of selection) {
        if (nextConfig.rooms.some((item) => item.id === rowId)) nextConfig = deleteCleaningRoomRow(nextConfig, rowId);
        else if (nextConfig.cleaningResponsibles.some((item) => item.id === rowId)) nextConfig = deleteCleaningResponsibleRow(nextConfig, "cleaning", rowId);
        else if (nextConfig.controlResponsibles.some((item) => item.id === rowId)) nextConfig = deleteCleaningResponsibleRow(nextConfig, "control", rowId);
      }
      setSelection([]);
      await patchDocument(nextConfig);
      toast.success(`Удалено строк: ${count}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить выбранные строки");
    }
  }

  async function submitRoom() {
    if (!roomDialog) return;
    const currentScopeArr = roomDialog.currentScope.map((s) => s.trim()).filter(Boolean);
    const generalScopeArr = roomDialog.generalScope.map((s) => s.trim()).filter(Boolean);
    const room = createCleaningRoomRow({
      id: roomDialog.id || undefined,
      name: roomDialog.name,
      detergent: roomDialog.detergent,
      currentScope: currentScopeArr,
      generalScope: generalScopeArr,
      currentDays: roomDialog.currentDays,
      generalDays: roomDialog.generalDays,
    });
    let nextConfig = normalizeCleaningDocumentConfig({
      ...config,
      rooms: roomDialog.id ? config.rooms.map((item) => item.id === roomDialog.id ? room : item) : [...config.rooms, room],
    }, { users: props.users });
    // Auto-apply weekday-плана к матрице — заполняем ПУСТЫЕ ячейки по
    // currentDays/generalDays. Уже отмеченные ячейки не трогаем (вдруг
    // менеджер вручную исправил «не проводилась»).
    if (props.status === "active" && !isRoomsMode) {
      nextConfig = applyRoomScheduleToMatrix(nextConfig, dayKeys, "fill-empty");
    }
    setRoomDialog(null);
    await patchDocument(nextConfig);
    // Sync строк из currentScope/generalScope в JournalChecklistItem'ы
    // — каждая строка станет подзадачей в TasksFlow task-fill flow.
    // Делается best-effort: ошибка sync не блокирует основное
    // сохранение config (комната уже сохранена выше).
    try {
      const response = await fetch(
        `/api/journals/cleaning/documents/${props.documentId}/room-scopes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: room.id,
            currentScope: currentScopeArr,
            generalScope: generalScopeArr,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.warn(
          "[cleaning] room-scopes sync failed",
          data?.error ?? response.status,
        );
      }
    } catch (err) {
      console.warn("[cleaning] room-scopes sync exception", err);
    }
  }

  async function submitResponsible() {
    if (!responsibleDialog) return;
    const responsible = createCleaningResponsibleRow({ kind: responsibleDialog.kind, title: responsibleDialog.title, userId: responsibleDialog.userId, userName: userNameById(props.users, responsibleDialog.userId) });
    const key = responsibleDialog.kind === "cleaning" ? "cleaningResponsibles" : "controlResponsibles";
    const currentItems = config[key];
    const nextConfig = normalizeCleaningDocumentConfig({
      ...config,
      [key]: responsibleDialog.id ? currentItems.map((item) => item.id === responsibleDialog.id ? { ...responsible, id: responsibleDialog.id } : item) : [...currentItems, responsible],
    }, { users: props.users });
    setResponsibleDialog(null);
    await patchDocument(nextConfig);
  }

  const cleaningUsers = getUsersForRoleLabel(props.users, settingsState.cleaningRole);
  const controlUsers = getUsersForRoleLabel(props.users, settingsState.controlRole);
  const responsibleUsers = responsibleDialog ? getUsersForRoleLabel(props.users, responsibleDialog.title) : [];

  return (
    <>
      <div className="space-y-8">
        <FocusTodayScroller />
        {!printMode ? (
          <>
            <DocumentBackLink href="/journals/cleaning" documentId={props.documentId} />
            <div className="flex flex-wrap items-center justify-end gap-3">
              {props.hasTasksFlowIntegration ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={tasksFlowSyncing}
                  className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none hover:bg-[#f5f6ff]"
                  onClick={() => syncFromTasksFlow()}
                  title="Подтянуть отметки выполнения из TasksFlow"
                >
                  <RefreshCw
                    className={`size-4 ${tasksFlowSyncing ? "animate-spin" : ""}`}
                  />
                  {tasksFlowSyncing ? "Обновляю…" : "Обновить из TasksFlow"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                title="Распечатать журнал"
                className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none hover:bg-[#f5f6ff] print:hidden"
              >
                <Printer className="size-4" />
                Печать
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none hover:bg-[#f5f6ff]"
                onClick={() => setSettingsOpen(true)}
              >
                Настройки журнала
              </Button>
              <Button
                type="button"
                variant="outline"
                title="Сохранить помещения, ответственных и шаги уборки как шаблон по умолчанию для новых журналов уборки"
                className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none hover:bg-[#f5f6ff] print:hidden"
                onClick={() => setSaveAsTemplateOpen(true)}
              >
                Сохранить как шаблон
              </Button>
              {props.status === "active" ? (
                <DocumentCloseButton
                  documentId={props.documentId}
                  title={config.documentTitle || CLEANING_PAGE_TITLE}
                  variant="outline"
                  className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none hover:bg-[#f5f6ff]"
                >
                  Закончить журнал
                </DocumentCloseButton>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="flex items-start justify-between gap-6">
          <div><h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">{config.documentTitle || CLEANING_PAGE_TITLE}</h1><p className="mt-2 text-[18px] text-[#6d7285]">{getCleaningPeriodLabel(props.dateFrom, props.dateTo)}</p></div>
          {!printMode && saving ? <div className="text-[16px] text-[#6d7285]">Сохранение...</div> : null}
        </div>

        <section className="rounded-[24px] bg-[#f5f6ff] px-8 py-6">
          <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-start">
            <div className="flex items-center gap-4"><Switch checked={config.autoFill.enabled} onCheckedChange={toggleAutoFill} disabled={props.status !== "active" || saving} className="data-[state=checked]:bg-[#5863f8] data-[state=unchecked]:bg-[#d4d8ec]" /><span className="text-[20px] font-semibold text-black">Автоматически заполнять журнал</span></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Ответственный за уборку</Label><Select value={settingsState.cleaningUserId} disabled={props.status !== "active" || saving} onValueChange={(value) => updateSettings({ cleaningUserId: value })}><SelectTrigger className="h-14 rounded-[16px] border-[#d7dcec] bg-white text-[18px]"><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger><SelectContent>{cleaningUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Ответственный за контроль</Label><Select value={settingsState.controlUserId} disabled={props.status !== "active" || saving} onValueChange={(value) => updateSettings({ controlUserId: value })}><SelectTrigger className="h-14 rounded-[16px] border-[#d7dcec] bg-white text-[18px]"><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger><SelectContent>{controlUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-3"><Checkbox checked={config.autoFill.skipWeekends} onCheckedChange={(checked) => toggleSkipWeekends(Boolean(checked))} disabled={props.status !== "active" || saving} className="size-7 rounded-[10px]" /><span className="text-[18px] text-black">Не заполнять в выходные дни</span></div>
          </div>
        </section>

        {!printMode ? (
          // Sticky под dashboard-хедером (он `sticky top-0 z-30 h-14`).
          // top-14 чтобы не перекрывать хедер; z-20 чтобы хедер всегда был выше
          // (без этого dropdown-trigger перекрывался невидимыми элементами хедера
          // и клик «Добавить» не регистрировался).
          <div className="sticky top-14 z-20 -mx-4 space-y-2 border-b border-[#dcdfed] bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button className="h-11 rounded-2xl bg-[#5863f8] px-7 text-[15px] text-white hover:bg-[#4756f6]"><Plus className="size-6" />Добавить<ChevronDown className="size-5" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-3 shadow-xl sm:w-[340px]">
                    <DropdownMenuItem className="h-11 rounded-2xl text-[18px]" onSelect={() => setRoomDialog(buildRoomState())}><Plus className="mr-3 size-5 text-[#5863f8]" />Добавить помещение</DropdownMenuItem>
                    <DropdownMenuItem className="h-11 rounded-2xl text-[18px]" onSelect={() => setResponsibleDialog(buildResponsibleState("cleaning"))}><UserPlus className="mr-3 size-5 text-[#5863f8]" />Добавить отв. за уборку</DropdownMenuItem>
                    <DropdownMenuItem className="h-11 rounded-2xl text-[18px]" onSelect={() => setResponsibleDialog(buildResponsibleState("control"))}><UserPlus className="mr-3 size-5 text-[#5863f8]" />Добавить отв. за контроль</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selection.length > 0 ? <Button type="button" variant="outline" className="h-11 rounded-2xl border-[#ffd6d3] bg-[#fff6f5] px-4 text-[15px] text-[#ff4d3d]" onClick={() => setDeleteOpen(true)}><Trash2 className="size-5" />Удалить</Button> : null}
              </div>
              {selection.length > 0 ? <div className="text-[18px] text-[#5863f8]">Выбрано: {selection.length}</div> : null}
            </div>
            {/* Bulk-cell toolbar (выходные / выделение / bulk-set) — sticky
                ВМЕСТЕ с add-toolbar выше, чтобы быть всегда видимым над
                таблицей при scroll'е по дате. Только для room-mode active. */}
            {props.status === "active" && !isRoomsMode ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <button
                  type="button"
                  onClick={() => applySchedulePlan("fill-empty")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#5566f6] bg-[#5566f6] px-3 py-1.5 font-medium text-white shadow-[0_6px_16px_-8px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
                  title="Поставить T (текущая) и G (генеральная) во все пустые ячейки согласно weekday-плану помещений"
                >
                  Заполнить по плану
                </button>
                <button
                  type="button"
                  onClick={() => { setScheduleApplyMode("overwrite"); setScheduleApplyOpen(true); }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                  title="Перезаписать все ячейки матрицы по weekday-плану помещений (включая уже отмеченные — пользовательские отметки будут потеряны)"
                >
                  План заново
                </button>
                <button
                  type="button"
                  onClick={() => bulkSetHolidaysAndWeekends("/" as CleaningMatrixValue)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#ffd7d3] bg-[#fff4f2] px-3 py-1.5 font-medium text-[#a13a32] transition-colors hover:bg-[#fff2f1]"
                  title="Поставить «/» (не проводилась) на все выходные и праздники периода"
                >
                  Отметить выходные «/»
                </button>
                <button
                  type="button"
                  onClick={() => bulkSetHolidaysAndWeekends("" as CleaningMatrixValue)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#6f7282] transition-colors hover:bg-[#fafbff]"
                  title="Очистить ячейки выходных и праздников периода"
                >
                  Очистить выходные
                </button>
                <span className="hidden text-[#dcdfed] sm:inline">·</span>
                <button
                  type="button"
                  onClick={() => {
                    if (cellSelectMode) {
                      setCellSelectMode(false);
                      clearCellSelection();
                    } else {
                      setCellSelectMode(true);
                    }
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-medium transition-colors ${cellSelectMode ? "bg-[#5566f6] text-white" : "bg-[#f5f6ff] text-[#5566f6] hover:bg-[#eef1ff]"}`}
                  title="ВКЛ: тяните мышью / пальцем от одного угла к другому, выделится прямоугольник как в Excel"
                >
                  {cellSelectMode ? "Выделение: ВКЛ" : "Выделить мышкой"}
                </button>
                <button
                  type="button"
                  onClick={selectAllCells}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                  title="Выделить все ячейки матрицы"
                >
                  Выделить всё
                </button>
                {cellSelectMode ? (
                  <>
                    <span className="text-[12px] text-[#6f7282]">
                      Выделено: <span className="font-semibold tabular-nums text-[#0b1024]">{selectedCells.size}</span>
                    </span>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("T" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#0b1024] transition-colors hover:bg-[#f5f6ff] disabled:opacity-40"
                    >
                      T · Текущая
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("G" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#0b1024] transition-colors hover:bg-[#f5f6ff] disabled:opacity-40"
                    >
                      G · Генеральная
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("/" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#ffd7d3] bg-[#fff4f2] px-3 py-1.5 font-medium text-[#a13a32] transition-colors hover:bg-[#fff2f1] disabled:opacity-40"
                    >
                      / · Не проводилась
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#6f7282] transition-colors hover:bg-[#fafbff] disabled:opacity-40"
                    >
                      Очистить
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={clearCellSelection}
                      className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[12px] text-[#6f7282] hover:text-[#0b1024] disabled:opacity-40"
                    >
                      Сбросить
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {!printMode && props.buildings && props.buildings.length > 0 ? (
          <RoomsModeCard
            buildings={props.buildings}
            users={props.users}
            disabled={props.status !== "active" || saving}
            cleaningMode={config.cleaningMode ?? "pairs"}
            selectedRoomIds={config.selectedRoomIds ?? []}
            selectedCleanerUserIds={config.selectedCleanerUserIds ?? []}
            controlUserId={config.controlUserId ?? null}
            verifierByRoomId={config.verifierByRoomId ?? {}}
            onSave={async (patch) => {
              await patchDocument({
                ...config,
                cleaningMode: patch.cleaningMode,
                selectedRoomIds: patch.selectedRoomIds,
                selectedCleanerUserIds: patch.selectedCleanerUserIds,
                controlUserId: patch.controlUserId,
                verifierByRoomId: patch.verifierByRoomId,
              });
            }}
          />
        ) : null}

        {!printMode ? (
          <div role="tablist" aria-label="Режим отображения" className="flex w-full rounded-2xl border border-[#ececf4] bg-white p-1 text-[13px] font-medium sm:hidden">
            <button type="button" role="tab" aria-selected={mobileView === "cards"} onClick={() => switchMobileView("cards")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors ${mobileView === "cards" ? "bg-[#f5f6ff] text-[#5566f6]" : "text-[#6f7282]"}`}>
              <LayoutGrid className="size-4" />Карточки
            </button>
            <button type="button" role="tab" aria-selected={mobileView === "table"} onClick={() => switchMobileView("table")} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 transition-colors ${mobileView === "table" ? "bg-[#f5f6ff] text-[#5566f6]" : "text-[#6f7282]"}`}>
              <Rows3 className="size-4" />Таблица
            </button>
          </div>
        ) : null}


        {/* Mobile Cards view — hidden on sm+ and print. Each row (room or
            responsible) is an accordion with per-day tap-to-cycle cells. */}
        {!printMode && mobileView === "cards" ? (
          <div className="space-y-2 sm:hidden print:hidden">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5 text-center text-[13px] text-[#6f7282]">
                Добавьте помещение или ответственного через меню «Добавить».
              </div>
            ) : null}
            {rows.map((row) => {
              const expanded = expandedRowId === row.id;
              const title = row.kind === "room" ? row.room.name : row.kind === "cleaning" ? "Ответственный за уборку" : "Ответственный за контроль";
              const subtitle = row.kind === "room" ? row.room.detergent : `${row.responsible.code} · ${row.responsible.userName || "—"}`;
              const filledCount = dayKeys.reduce((acc, dk) => acc + (cellValue(row, dk) ? 1 : 0), 0);
              const isSelected = selection.includes(row.id);
              return (
                <div key={row.id} className="rounded-2xl border border-[#ececf4] bg-white">
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span onClick={(event) => event.stopPropagation()} className="shrink-0">
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => setSelection((current) => Boolean(checked) ? [...current, row.id].filter((value, index, list) => list.indexOf(value) === index) : current.filter((id) => id !== row.id))} disabled={props.status !== "active"} className="size-5" />
                    </span>
                    <button type="button" onClick={() => setExpandedRowId(expanded ? null : row.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[#0b1024]">{title}</div>
                        {subtitle ? <div className="truncate text-[12px] text-[#6f7282]">{subtitle}</div> : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] font-semibold text-[#5566f6]">{filledCount}/{dayKeys.length}</span>
                      <ChevronDown className={`size-4 shrink-0 text-[#6f7282] transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {expanded ? (
                    <div className="border-t border-[#ececf4] p-3">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
                        {dayKeys.map((dateKey) => {
                          const cellVal = cellValue(row, dateKey);
                          const dayKind = getCalendarDayKind(dateKey);
                          const isOff = dayKind.kind === "holiday" || dayKind.kind === "weekend";
                          const isShort = dayKind.kind === "short";
                          const isSelected = selectedCells.has(cellKey(row.id, dateKey));
                          // Mobile-card cell — приоритет: selected > filled > off-day color > short > workday.
                          const cellCls = isSelected
                            ? "ring-2 ring-[#5566f6] border-[#5566f6] bg-[#eef1ff] text-[#5566f6]"
                            : cellVal
                              ? "border-[#5566f6] bg-[#f5f6ff] text-[#5566f6]"
                              : isOff
                                ? "border-[#ffd7d3] bg-[#fff4f2] text-[#a13a32]"
                                : isShort
                                  ? "border-[#ffe9b0] bg-[#fff8eb] text-[#b25f00]"
                                  : "border-[#ececf4] bg-white text-[#3c4053] hover:bg-[#f5f6ff]";
                          return (
                            <button
                              key={dateKey}
                              type="button"
                              title={dayKind.name ?? undefined}
                              onClick={() => { updateCell(row, dateKey).catch(() => {}); }}
                              onTouchStart={() => {
                                if (cellSelectMode) startDragOnCell(row.id, dateKey);
                              }}
                              onTouchMove={(e) => {
                                if (!cellSelectMode || !dragModeRef.current) return;
                                const touch = e.touches[0];
                                if (!touch) return;
                                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                                const cellEl = target?.closest?.("[data-cell-key]");
                                const k = cellEl?.getAttribute("data-cell-key");
                                if (!k) return;
                                const [r, d] = k.split("::");
                                if (r && d) continueDragOnCell(r, d);
                              }}
                              data-cell-key={cellKey(row.id, dateKey)}
                              disabled={props.status !== "active" || isRoomsMode}
                              className={`flex h-11 flex-col items-center justify-center rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-60 select-none ${cellCls}`}
                            >
                              <span className="text-[12px] font-semibold tabular-nums">{Number(dateKey.slice(-2))}</span>
                              <span className="text-[11px] leading-none">{cellVal || "—"}</span>
                            </button>
                          );
                        })}
                      </div>
                      {props.status === "active" ? (
                        <div className="mt-3 text-[11px] text-[#6f7282]">
                          {row.kind === "room" ? "Тап по дню перебирает Т / Г / пусто." : "Тап по дню переключает отметку ответственного."}
                        </div>
                      ) : null}
                      {row.kind === "room" ? (
                        <div className="mt-3 space-y-1 rounded-xl border border-[#ececf4] bg-[#fafbff] p-3 text-[12px] leading-5 text-[#3c4053]">
                          <div className="font-semibold text-[#0b1024]">Текущая:</div>
                          <div>{row.room.currentScope.join(", ") || "—"}</div>
                          <div className="mt-2 font-semibold text-[#0b1024]">Генеральная:</div>
                          <div>{row.room.generalScope.join(", ") || "—"}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className={mobileView === "cards" && !printMode ? "hidden sm:block print:block" : ""}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"><div className="min-w-[920px] space-y-8 sm:min-w-[1200px]">
          <table className="w-full border-collapse text-center"><thead><tr><th className="border border-black p-5 text-[24px] font-semibold">{props.organizationName}</th><th className="border border-black p-3 text-[22px] font-medium" colSpan={dayKeys.length + 1}>СИСТЕМА ХАССП<div className="mt-3 border-t border-black pt-3 italic">ЖУРНАЛ УБОРКИ</div></th><th className="border border-black p-5 text-[20px] font-medium">СТР. 1 ИЗ 1</th></tr></thead></table>
          <h2 className="text-center text-[28px] font-semibold uppercase">Журнал уборки</h2>
          <table className="w-full border-collapse text-[16px]"><thead><tr><th className="w-12 border border-black bg-white p-2">{!printMode ? <Checkbox checked={rows.length > 0 && selection.length === rows.length} onCheckedChange={(checked) => setSelection(Boolean(checked) ? rows.map((r) => r.id) : [])} className="size-5" disabled={props.status !== "active"} /> : null}</th><th className="border border-black bg-[#f6f6f6] p-3 font-semibold">Наименование помещения</th><th className="border border-black bg-[#f6f6f6] p-3 font-semibold">Моющие и дезинфицирующие средства</th><th className="border border-black bg-[#f6f6f6] p-3 font-semibold" colSpan={dayKeys.length}>Месяц {getCleaningPeriodLabel(props.dateFrom, props.dateTo)}</th></tr><tr><th className="border border-black bg-white p-2" /><th className="border border-black bg-white p-2" /><th className="border border-black bg-white p-2" />{dayKeys.map((dateKey) => <th key={dateKey} data-focus-today={dateKey === toDateKey(new Date()) ? "" : undefined} className="border border-black bg-white p-2 text-[18px] font-semibold">{Number(dateKey.slice(-2))}</th>)}</tr></thead><tbody>
            {rows.map((row) => {
              const title = row.kind === "room" ? row.room.name : row.kind === "cleaning" ? "Ответственный за уборку" : "Ответственный за контроль";
              const secondColumn = row.kind === "room" ? row.room.detergent : `${row.responsible.code} - ${row.responsible.userName || "—"}`;
              return <tr key={row.id}>
                <td className="border border-black p-2 text-center">{!printMode ? <Checkbox checked={selection.includes(row.id)} onCheckedChange={(checked) => setSelection((current) => Boolean(checked) ? [...current, row.id].filter((value, index, list) => list.indexOf(value) === index) : current.filter((id) => id !== row.id))} className="size-5" /> : null}</td>
                <td className="border border-black p-3 align-middle"><div className="flex items-center justify-between gap-3"><button type="button" className="text-left hover:text-[#5863f8]" disabled={printMode || props.status !== "active"} onClick={() => row.kind === "room" ? setRoomDialog(buildRoomState(row.room)) : setResponsibleDialog(buildResponsibleState(row.kind, row.responsible))}>{title}</button>{!printMode && props.status === "active" ? <Pencil className="size-4 text-[#7a7f93]" /> : null}</div></td>
                <td className="border border-black p-3">{secondColumn}</td>
                {dayKeys.map((dateKey) => {
                  const isSelected = selectedCells.has(cellKey(row.id, dateKey));
                  const dayKind = getCalendarDayKind(dateKey);
                  // Pastel-окраска по производственному календарю:
                  //   • holiday/weekend → красный пастель (#fff4f2)
                  //   • short          → жёлтый пастель (#fff8eb)
                  //   • workday        → белый
                  // Selected outline overlays поверх любого фона.
                  const dayBg =
                    dayKind.kind === "holiday" || dayKind.kind === "weekend"
                      ? "bg-[#fff4f2]"
                      : dayKind.kind === "short"
                        ? "bg-[#fff8eb]"
                        : "bg-white";
                  const interactive = !printMode && props.status === "active" && !isRoomsMode;
                  return (
                    <td
                      key={dateKey}
                      data-cell-key={cellKey(row.id, dateKey)}
                      title={dayKind.name ?? undefined}
                      className={`border border-black p-2 text-center text-[18px] select-none ${interactive ? "cursor-pointer hover:bg-[#f5f6ff]" : ""} ${dayBg} ${isSelected ? "outline outline-2 outline-offset-[-2px] outline-[#5566f6] !bg-[#eef1ff]" : ""}`}
                      onClick={() => {
                        // Если только что был drag — onClick после mouseup
                        // тоже срабатывает. Защищаемся: если в режиме
                        // selection и drag завершился, click игнорируем.
                        if (cellSelectMode) return;
                        updateCell(row, dateKey);
                      }}
                      onMouseDown={(e) => {
                        if (!cellSelectMode) return;
                        e.preventDefault();
                        startDragOnCell(row.id, dateKey);
                      }}
                      onMouseEnter={() => continueDragOnCell(row.id, dateKey)}
                      onTouchStart={() => {
                        if (!cellSelectMode) return;
                        startDragOnCell(row.id, dateKey);
                      }}
                    >
                      {cellValue(row, dateKey)}
                    </td>
                  );
                })}
              </tr>;
            })}
          </tbody></table>
          <div className="space-y-2 text-[18px] italic">{Array.from(new Set(config.legend)).map((item) => <div key={item}>{item}</div>)}</div>
          <table className="w-full border-collapse text-[16px]"><thead><tr><th className="border border-black bg-[#f6f6f6] p-3 font-semibold">Наименование помещения</th><th className="border border-black bg-[#f6f6f6] p-3 font-semibold">Текущая уборка</th><th className="border border-black bg-[#f6f6f6] p-3 font-semibold">Генеральная уборка</th></tr></thead><tbody>{config.rooms.map((room) => <tr key={room.id}><td className="border border-black p-3">{room.name}</td><td className="border border-black p-3">{room.currentScope.join(", ")}</td><td className="border border-black p-3">{room.generalScope.join(", ")}</td></tr>)}</tbody></table>
        </div></div>
        </div>
      </div>

      <Dialog open={!!roomDialog} onOpenChange={(open) => !open && setRoomDialog(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden rounded-[24px] border-0 p-0 sm:max-w-[640px]">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              {roomDialog?.id ? "Редактирование помещения" : "Добавление нового помещения"}
            </DialogTitle>
          </DialogHeader>
          {roomDialog ? (
            <>
              <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-[#3c4053]">Название помещения</Label>
                  <Input
                    value={roomDialog.name}
                    onChange={(event) => setRoomDialog((current) => current ? { ...current, name: event.target.value } : current)}
                    placeholder="Введите название помещения"
                    className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-[#3c4053]">Моющие и дезинфицирующие средства</Label>
                  <Textarea
                    value={roomDialog.detergent}
                    onChange={(event) => setRoomDialog((current) => current ? { ...current, detergent: event.target.value } : current)}
                    placeholder="Моющие и дезинфицирующие средства"
                    className="rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px]"
                    rows={3}
                  />
                </div>
                {(config.cleaningSubtaskMode ?? "perRoom") !== "perRoom" ? (
                  <div className="rounded-2xl border border-[#ffe9b0] bg-[#fff8eb] px-4 py-3 text-[12px] leading-[1.55] text-[#7a5500]">
                    <strong>Чек-лист этого помещения отключён.</strong> В настройках журнала выбран
                    {(config.cleaningSubtaskMode ?? "perRoom") === "global" ? " «Общий список»" : " режим «без чек-листа»"}.
                    Шаги ниже сохранятся, но в TasksFlow сотрудник увидит
                    {(config.cleaningSubtaskMode ?? "perRoom") === "global" ? " общий список из настроек журнала." : " задачу без подзадач."}
                    Чтобы у каждой комнаты был свой чек-лист — переключите на «По помещениям» в настройках журнала.
                  </div>
                ) : null}
                <div className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-[13px] font-semibold text-[#0b1024]">Текущая уборка</Label>
                      <p className="mt-0.5 text-[12px] leading-[1.55] text-[#6f7282]">
                        Пошаговый чек-лист — каждый шаг станет подзадачей в TasksFlow.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-medium text-[#3848c7] tabular-nums">
                      {roomDialog.currentScope.filter((s) => s.trim()).length} шаг.
                    </span>
                  </div>
                  <ScopeListEditor
                    value={roomDialog.currentScope}
                    onChange={(next) => setRoomDialog((current) => current ? { ...current, currentScope: next } : current)}
                    placeholder="Например: Протереть рабочие поверхности"
                    addLabel="Добавить шаг текущей уборки"
                    emptyHint="Шагов текущей уборки пока нет — добавьте первый шаг ниже."
                  />
                  <div className="space-y-1.5 border-t border-[#ececf4] pt-3">
                    <Label className="text-[12px] font-medium text-[#3c4053]">Дни проведения текущей уборки</Label>
                    <p className="text-[11px] leading-[1.45] text-[#6f7282]">
                      На сером фоне в матрице будут подсвечены дни, когда уборка должна проводиться.
                    </p>
                    <WeekdayMaskPicker
                      value={roomDialog.currentDays}
                      onChange={(next) => setRoomDialog((current) => current ? { ...current, currentDays: next } : current)}
                    />
                  </div>
                </div>
                <div className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-[13px] font-semibold text-[#0b1024]">Генеральная уборка</Label>
                      <p className="mt-0.5 text-[12px] leading-[1.55] text-[#6f7282]">
                        Подробный список — что моется/дезинфицируется в день генеральной.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-medium text-[#3848c7] tabular-nums">
                      {roomDialog.generalScope.filter((s) => s.trim()).length} шаг.
                    </span>
                  </div>
                  <ScopeListEditor
                    value={roomDialog.generalScope}
                    onChange={(next) => setRoomDialog((current) => current ? { ...current, generalScope: next } : current)}
                    placeholder="Например: Демонтировать съёмные части и промыть в горячей воде"
                    addLabel="Добавить шаг генеральной уборки"
                    emptyHint="Шагов генеральной уборки пока нет — добавьте первый шаг ниже."
                  />
                  <div className="space-y-1.5 border-t border-[#ececf4] pt-3">
                    <Label className="text-[12px] font-medium text-[#3c4053]">Дни проведения генеральной уборки</Label>
                    <p className="text-[11px] leading-[1.45] text-[#6f7282]">
                      Обычно — раз в неделю. Например, только Сб или только Пн.
                    </p>
                    <WeekdayMaskPicker
                      value={roomDialog.generalDays}
                      onChange={(next) => setRoomDialog((current) => current ? { ...current, generalDays: next } : current)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-2xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
                  onClick={() => setRoomDialog(null)}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  className="h-11 w-full rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
                  onClick={submitRoom}
                >
                  Сохранить
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={!!responsibleDialog} onOpenChange={(open) => !open && setResponsibleDialog(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden rounded-[24px] border-0 p-0 sm:max-w-[640px]">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Добавление ответственного лица
            </DialogTitle>
          </DialogHeader>
          {responsibleDialog ? (
            <>
              <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-[#3c4053]">Должность ответственного</Label>
                    <select
                      className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024]"
                      value={responsibleDialog.title}
                      onChange={(event) => {
                        const value = event.target.value;
                        setResponsibleDialog((current) => current ? { ...current, title: value, userId: primaryUserId(props.users, value) } : current);
                      }}
                    >
                      <option value="">— выберите —</option>
                      <PositionNativeOptions users={props.users} />
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
                    <select
                      className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024]"
                      value={responsibleDialog.userId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setResponsibleDialog((current) => current ? { ...current, userId: value } : current);
                      }}
                    >
                      <option value="">— выберите —</option>
                      {responsibleUsers.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-2xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
                  onClick={() => setResponsibleDialog(null)}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  className="h-11 w-full rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
                  onClick={submitResponsible}
                >
                  {responsibleDialog.id ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      {props.useV2 ? (
        <JournalSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          title="Настройки документа"
          description="Название журнала и ответственные. Изменения применяются ко всему периоду документа."
          size="md"
          isSaving={saving}
          onSave={async () => {
            await updateSettings({});
            setSettingsOpen(false);
          }}
          onCancel={() => setSettingsOpen(false)}
        >
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Название документа
            </Label>
            <Input
              value={settingsState.title}
              onChange={(event) =>
                setSettingsState((current) => ({ ...current, title: event.target.value }))
              }
              className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Должность ответственного за уборку
            </Label>
            <Select
              value={settingsState.cleaningRole}
              onValueChange={(value) =>
                setSettingsState((current) => ({
                  ...current,
                  cleaningRole: value,
                  cleaningUserId: primaryUserId(props.users, value),
                }))
              }
            >
              <SelectTrigger className="h-11 rounded-2xl border-[#dcdfed] bg-white text-[15px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={props.users} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Сотрудник
            </Label>
            <Select
              value={settingsState.cleaningUserId}
              onValueChange={(value) =>
                setSettingsState((current) => ({ ...current, cleaningUserId: value }))
              }
            >
              <SelectTrigger className="h-11 rounded-2xl border-[#dcdfed] bg-white text-[15px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                {getUsersForRoleLabel(props.users, settingsState.cleaningRole).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Должность ответственного за контроль
            </Label>
            <Select
              value={settingsState.controlRole}
              onValueChange={(value) =>
                setSettingsState((current) => ({
                  ...current,
                  controlRole: value,
                  controlUserId: primaryUserId(props.users, value),
                }))
              }
            >
              <SelectTrigger className="h-11 rounded-2xl border-[#dcdfed] bg-white text-[15px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={props.users} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Сотрудник
            </Label>
            <Select
              value={settingsState.controlUserId}
              onValueChange={(value) =>
                setSettingsState((current) => ({ ...current, controlUserId: value }))
              }
            >
              <SelectTrigger className="h-11 rounded-2xl border-[#dcdfed] bg-white text-[15px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                {getUsersForRoleLabel(props.users, settingsState.controlRole).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline mode — определяет, как сотрудник видит подзадачи в TasksFlow.
              Раньше всегда был perRoom (у каждой комнаты свой scope). Теперь
              менеджер может выбрать один общий список или отключить вовсе. */}
          <div className="space-y-3 rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4">
            <div>
              <Label className="text-[13px] font-semibold text-[#0b1024]">
                Подзадачи в TasksFlow (pipeline)
              </Label>
              <p className="mt-1 text-[12px] leading-[1.55] text-[#6f7282]">
                Как сотрудник видит чек-лист в задаче на уборку:
              </p>
            </div>
            <div className="grid gap-2">
              {([
                {
                  value: "perRoom" as const,
                  title: "По помещениям (рекомендуется)",
                  desc: "У каждой комнаты свой список шагов. Удобно когда уборка в кухне отличается от уборки в баре.",
                },
                {
                  value: "global" as const,
                  title: "Общий список",
                  desc: "Один список шагов, одинаковый для всех помещений. Удобно когда протокол простой и единый.",
                },
                {
                  value: "legacy" as const,
                  title: "Без чек-листа (legacy)",
                  desc: "Сотрудник просто отмечает «сделано», без разбивки на шаги. Подзадач в TasksFlow не будет.",
                },
              ]).map((opt) => {
                const isActive = (config.cleaningSubtaskMode ?? "perRoom") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCleaningSubtaskMode(opt.value)}
                    disabled={saving}
                    className={`text-left rounded-2xl border px-4 py-3 transition-colors disabled:opacity-60 ${
                      isActive
                        ? "border-[#5566f6] bg-white shadow-[0_0_0_4px_rgba(85,102,246,0.12)]"
                        : "border-[#ececf4] bg-white hover:border-[#5566f6]/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          isActive ? "border-[#5566f6] bg-[#5566f6]" : "border-[#dcdfed] bg-white"
                        }`}
                      >
                        {isActive ? <div className="size-1.5 rounded-full bg-white" /> : null}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-[#0b1024]">{opt.title}</div>
                        <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6f7282]">{opt.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {(config.cleaningSubtaskMode ?? "perRoom") === "global" ? (
              <div className="space-y-3 rounded-2xl border border-[#dcdfed] bg-white p-3">
                <div>
                  <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                    Общий список — текущая уборка
                  </Label>
                  <p className="mt-1 text-[12px] leading-[1.5] text-[#6f7282]">
                    Эти шаги увидит каждый сотрудник при уборке любого помещения (текущая).
                  </p>
                </div>
                <ScopeListEditor
                  value={config.globalSubtasks?.current ?? []}
                  onChange={(next) => { void setGlobalSubtasks({ current: next }); }}
                  placeholder="Например: Протереть рабочие поверхности"
                  addLabel="Добавить шаг текущей"
                  emptyHint="Шагов пока нет — добавьте первый шаг ниже."
                />
                <div className="border-t border-[#ececf4] pt-3">
                  <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                    Общий список — генеральная уборка
                  </Label>
                </div>
                <ScopeListEditor
                  value={config.globalSubtasks?.general ?? []}
                  onChange={(next) => { void setGlobalSubtasks({ general: next }); }}
                  placeholder="Например: Демонтировать съёмные части и промыть в горячей воде"
                  addLabel="Добавить шаг генеральной"
                  emptyHint="Шагов пока нет — добавьте первый шаг ниже."
                />
              </div>
            ) : null}
          </div>
        </JournalSettingsModal>
      ) : (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-0 sm:max-w-[760px]"><DialogHeader className="border-b px-5 py-6 sm:px-10 sm:py-8"><div className="flex items-center justify-between"><DialogTitle className="text-[22px] font-semibold text-black">Настройки документа</DialogTitle><button type="button" className="rounded-xl p-2 hover:bg-black/5" onClick={() => setSettingsOpen(false)}><X className="size-7" /></button></div></DialogHeader><div className="space-y-5 px-5 py-6 sm:px-10 sm:py-8"><Input value={settingsState.title} onChange={(event) => setSettingsState((current) => ({ ...current, title: event.target.value }))} className="h-11 rounded-2xl border-[#dfe1ec] px-4 text-[15px]" /><Select value={settingsState.cleaningRole} onValueChange={(value) => setSettingsState((current) => ({ ...current, cleaningRole: value, cleaningUserId: primaryUserId(props.users, value) }))}><SelectTrigger className="h-11 rounded-2xl border-[#dfe1ec] bg-[#f2f3f8] text-[18px]"><SelectValue placeholder="Должность ответственного за уборку" /></SelectTrigger><SelectContent><PositionSelectItems users={props.users} /></SelectContent></Select><Select value={settingsState.cleaningUserId} onValueChange={(value) => setSettingsState((current) => ({ ...current, cleaningUserId: value }))}><SelectTrigger className="h-11 rounded-2xl border-[#dfe1ec] bg-[#f2f3f8] text-[18px]"><SelectValue placeholder="Сотрудник" /></SelectTrigger><SelectContent>{getUsersForRoleLabel(props.users, settingsState.cleaningRole).map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><Select value={settingsState.controlRole} onValueChange={(value) => setSettingsState((current) => ({ ...current, controlRole: value, controlUserId: primaryUserId(props.users, value) }))}><SelectTrigger className="h-11 rounded-2xl border-[#dfe1ec] bg-[#f2f3f8] text-[18px]"><SelectValue placeholder="Должность ответственного за контроль" /></SelectTrigger><SelectContent><PositionSelectItems users={props.users} /></SelectContent></Select><Select value={settingsState.controlUserId} onValueChange={(value) => setSettingsState((current) => ({ ...current, controlUserId: value }))}><SelectTrigger className="h-11 rounded-2xl border-[#dfe1ec] bg-[#f2f3f8] text-[18px]"><SelectValue placeholder="Сотрудник" /></SelectTrigger><SelectContent>{getUsersForRoleLabel(props.users, settingsState.controlRole).map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><div className="flex justify-end"><Button type="button" className="h-11 rounded-2xl bg-[#5563ff] px-4 text-[15px] text-white hover:bg-[#4554ff]" onClick={async () => { await updateSettings({}); setSettingsOpen(false); }}>Сохранить</Button></div></div></DialogContent></Dialog>
      )}
      <ConfirmDialog open={deleteOpen} title="Удалить выбранные строки?" submitLabel="Удалить" onOpenChange={setDeleteOpen} onSubmit={deleteSelectedRows} />
      <ConfirmDialog
        open={scheduleApplyOpen}
        title="Применить план заново ко всей матрице?"
        submitLabel="Перезаписать"
        onOpenChange={setScheduleApplyOpen}
        onSubmit={async () => { await applySchedulePlan(scheduleApplyMode); }}
      />
      <Dialog open={saveAsTemplateOpen} onOpenChange={setSaveAsTemplateOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-0 sm:max-w-[520px]">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Сохранить как шаблон по умолчанию
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 py-5">
            <p className="text-[14px] leading-[1.55] text-[#3c4053]">
              Текущие настройки журнала будут сохранены как шаблон для всей организации.
              Все <strong>новые</strong> журналы уборки будут автоматически создаваться с этими помещениями, ответственными, шагами и днями уборки.
            </p>
            <ul className="space-y-1.5 rounded-2xl bg-[#fafbff] px-4 py-3 text-[13px] text-[#3c4053]">
              <li>• Помещений: <strong>{config.rooms.length}</strong></li>
              <li>• Ответственных за уборку: <strong>{config.cleaningResponsibles.length}</strong></li>
              <li>• Ответственных за контроль: <strong>{config.controlResponsibles.length}</strong></li>
              <li>• Шагов текущей уборки (всего): <strong>{config.rooms.reduce((acc, r) => acc + r.currentScope.length, 0)}</strong></li>
              <li>• Шагов генеральной уборки (всего): <strong>{config.rooms.reduce((acc, r) => acc + r.generalScope.length, 0)}</strong></li>
            </ul>
            <p className="text-[12px] leading-[1.5] text-[#6f7282]">
              Текущий журнал и матрица отметок не изменятся. Шаблон не затронет уже созданные журналы.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-2xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
              onClick={() => setSaveAsTemplateOpen(false)}
              disabled={saveAsTemplateBusy}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="h-11 w-full rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
              onClick={handleSaveAsTemplate}
              disabled={saveAsTemplateBusy}
            >
              {saveAsTemplateBusy ? "Сохранение..." : "Сохранить шаблон"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Карточка настройки rooms-режима для journal-уборки.
 * Появляется только если у org заведены здания/помещения в /settings/buildings.
 *
 * При cleaningMode="rooms" daily fan-out создаст одну race-задачу на
 * каждое выбранное помещение (на каждого выбранного уборщика). Кто
 * первый закроет — забрал. В конце дня контролёр получит сводную
 * задачу о том что нужно проверить.
 *
 * Сейчас (Этап 2a/b) сохраняем только конфиг. Race-логика подключится
 * в Этапе 2c вместе с расширением cleaning adapter.
 */
type RoomsModeCardProps = {
  buildings: Array<{
    id: string;
    name: string;
    rooms: Array<{ id: string; name: string; kind: string }>;
  }>;
  users: UserItem[];
  disabled: boolean;
  cleaningMode: "pairs" | "rooms";
  selectedRoomIds: string[];
  selectedCleanerUserIds: string[];
  controlUserId: string | null;
  /** Per-room overrides контролёра. Map roomId → userId. */
  verifierByRoomId: Record<string, string>;
  onSave: (patch: {
    cleaningMode: "pairs" | "rooms";
    selectedRoomIds: string[];
    selectedCleanerUserIds: string[];
    controlUserId: string | null;
    verifierByRoomId: Record<string, string>;
  }) => Promise<void>;
};

function RoomsModeCard(props: RoomsModeCardProps) {
  const [mode, setMode] = useState<"pairs" | "rooms">(props.cleaningMode);
  const [rooms, setRooms] = useState<string[]>(props.selectedRoomIds);
  const [cleaners, setCleaners] = useState<string[]>(
    props.selectedCleanerUserIds
  );
  const [control, setControl] = useState<string | null>(props.controlUserId);
  const [verifierByRoomId, setVerifierByRoomId] = useState<
    Record<string, string>
  >(props.verifierByRoomId ?? {});
  const [showPerRoomVerifiers, setShowPerRoomVerifiers] = useState(
    Object.keys(props.verifierByRoomId ?? {}).length > 0,
  );
  const [busy, setBusy] = useState(false);

  function toggleRoom(id: string) {
    setRooms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function toggleCleaner(id: string) {
    setCleaners((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function setRoomVerifier(roomId: string, userId: string | "") {
    setVerifierByRoomId((prev) => {
      const next = { ...prev };
      if (userId) next[roomId] = userId;
      else delete next[roomId];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    try {
      await props.onSave({
        cleaningMode: mode,
        selectedRoomIds: rooms,
        selectedCleanerUserIds: cleaners,
        controlUserId: control,
        verifierByRoomId,
      });
    } finally {
      setBusy(false);
    }
  }

  // Все комнаты org для UI per-room verifier (не только selected).
  const allRooms = props.buildings.flatMap((b) =>
    b.rooms.map((r) => ({ ...r, buildingName: b.name })),
  );
  const selectedRoomList = allRooms.filter((r) => rooms.includes(r.id));

  // Кандидаты на role «cleaner»: позиция «Уборщик» + cook-роль.
  // Кандидаты на role «control»: management roles.
  const cleanerCandidates = props.users.filter((u) =>
    /уборщик|cleaner/i.test(`${u.name} ${u.role}`)
  );
  const allStaffCandidates = props.users; // fallback — если фильтр пустой
  const cleanersList =
    cleanerCandidates.length > 0 ? cleanerCandidates : allStaffCandidates;

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3848c7]">
            Режим уборки
          </div>
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
            Race-задачи на помещения
          </h3>
          <p className="mt-1 max-w-[640px] text-[13px] leading-[1.55] text-[#6f7282]">
            Если включить — каждое выбранное помещение в каждый рабочий
            день станет отдельной задачей. Любой из выбранных уборщиков
            может её закрыть; кто первый — тот и закрепил за собой
            (остальные у него исчезают). Контролёр получит одну сводную
            задачу в конце дня.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-[#0b1024]">
          <input
            type="checkbox"
            checked={mode === "rooms"}
            disabled={props.disabled}
            onChange={(e) => setMode(e.target.checked ? "rooms" : "pairs")}
            className="size-4 cursor-pointer accent-[#5566f6]"
          />
          Включить
        </label>
      </div>

      {mode === "rooms" ? (
        <div className="space-y-5">
          {/* Помещения */}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Помещения, по которым раздавать задачи
            </div>
            {props.buildings.map((b) => (
              <div key={b.id} className="mb-3">
                <div className="mb-1.5 text-[13px] font-medium text-[#3c4053]">
                  {b.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {b.rooms.length === 0 ? (
                    <span className="text-[12px] text-[#9b9fb3]">
                      Нет помещений в этом здании. Заведите в{" "}
                      <a href="/settings/buildings" className="text-[#5566f6] underline">
                        /settings/buildings
                      </a>
                      .
                    </span>
                  ) : (
                    b.rooms.map((r) => {
                      const active = rooms.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={props.disabled}
                          onClick={() => toggleRoom(r.id)}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-2xl border px-3 text-[13px] font-medium transition-colors ${
                            active
                              ? "border-[#5566f6] bg-[#f5f6ff] text-[#3848c7]"
                              : "border-[#dcdfed] bg-white text-[#6f7282] hover:border-[#5566f6]/50 hover:bg-[#f5f6ff]"
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Уборщики */}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Уборщики (race) — кто может забирать задачи
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cleanersList.map((u) => {
                const active = cleaners.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={props.disabled}
                    onClick={() => toggleCleaner(u.id)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-2xl border px-3 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-[#5566f6] bg-[#f5f6ff] text-[#3848c7]"
                        : "border-[#dcdfed] bg-white text-[#6f7282] hover:border-[#5566f6]/50 hover:bg-[#f5f6ff]"
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Контролёр (общий) */}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Ответственный за контроль (общий)
            </div>
            <select
              value={control ?? ""}
              disabled={props.disabled}
              onChange={(e) => setControl(e.target.value || null)}
              className="h-11 w-full max-w-md rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            >
              <option value="">— выберите —</option>
              {props.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11.5px] text-[#9b9fb3]">
              Применяется к комнатам у которых не задан per-room контролёр.
            </p>
          </div>

          {/* Per-room контролёры (override) */}
          {selectedRoomList.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                  Контролёры по комнатам (по желанию)
                </div>
                <button
                  type="button"
                  onClick={() => setShowPerRoomVerifiers((s) => !s)}
                  className="text-[12px] font-medium text-[#5566f6] hover:text-[#4a5bf0]"
                >
                  {showPerRoomVerifiers ? "Скрыть" : "Настроить"}
                </button>
              </div>
              {showPerRoomVerifiers ? (
                <div className="space-y-2 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-3">
                  <p className="mb-1 text-[11.5px] text-[#6f7282]">
                    Если разные комнаты должен проверять разный сотрудник —
                    выбери здесь. Пусто = используется общий контролёр выше.
                  </p>
                  {selectedRoomList.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5"
                    >
                      <span className="min-w-[140px] text-[12.5px] font-medium text-[#0b1024]">
                        {r.name}
                        <span className="ml-1.5 text-[11px] font-normal text-[#9b9fb3]">
                          ({r.buildingName})
                        </span>
                      </span>
                      <select
                        value={verifierByRoomId[r.id] ?? ""}
                        disabled={props.disabled}
                        onChange={(e) => setRoomVerifier(r.id, e.target.value)}
                        className="h-9 flex-1 min-w-[160px] rounded-lg border border-[#dcdfed] bg-white px-2 text-[12.5px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-2 focus:ring-[#5566f6]/15"
                      >
                        <option value="">— общий контролёр —</option>
                        {props.users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-3 text-[13px] text-[#6f7282]">
          Выключено — журнал работает в классическом режиме «1 задача на
          пару уборщик-контролёр в день».
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={props.disabled || busy}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#c8cbe0]"
        >
          {busy ? "Сохраняем…" : "Сохранить настройки"}
        </button>
      </div>
    </section>
  );
}
