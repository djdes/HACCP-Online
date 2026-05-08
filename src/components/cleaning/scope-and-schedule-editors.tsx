"use client";

/**
 * Shared editors for cleaning per-room configuration:
 *   • <ScopeListEditor>  — drag/drop bullet-list (currentScope/generalScope)
 *   • <WeekdayMaskPicker> — Mon-Sun chips + presets (currentDays/generalDays)
 *
 * Cleaning unification 2026-05-08: эти компоненты раньше жили в
 * cleaning-document-client.tsx (~2000 строк). Извлечены чтобы
 * /settings/buildings и журнал уборки могли пользоваться одним и тем же
 * UI (см. docs/superpowers/specs/2026-05-08-cleaning-unification.md
 * stages 2-3).
 */

import { useEffect, useRef, useState } from "react";
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
import { GripVertical, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
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
          if (
            event.key === "Backspace" &&
            props.item.text === "" &&
            props.total > 1
          ) {
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

export function ScopeListEditor(props: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  emptyHint?: string;
}) {
  const [items, setItems] = useState<ScopeListItem[]>(() =>
    props.value.map((text) => ({ uid: nextScopeUid(), text })),
  );
  useEffect(() => {
    setItems((prev) => {
      if (
        prev.length === props.value.length &&
        prev.every((it, i) => it.text === props.value[i])
      ) {
        return prev;
      }
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((it) => it.uid)}
            strategy={verticalListSortingStrategy}
          >
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

export function WeekdayMaskPicker(props: {
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
