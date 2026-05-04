"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CalendarDays,
  CheckCircle2,
  GripVertical,
  Home,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Item = {
  id: string;
  label: string;
  required: boolean;
  hint: string | null;
  sortOrder: number;
  roomId: string | null;
  frequency: string;
  weekDays: number[];
  monthDay: number | null;
};

type Room = { id: string; name: string; kind: string };

type Draft = {
  /** Стейбл-ключ для рендера. */
  key: string;
  /** id=null для нового пункта (ещё не сохранён). */
  id: string | null;
  label: string;
  required: boolean;
  hint: string | null;
  sortOrder: number;
  roomId: string | null;
  frequency: string;
  weekDays: number[];
  monthDay: number | null;
  /** dirty=true если local-state расходится с сервером. */
  dirty: boolean;
  /** justCreated — для UI «новый, ещё не сохранён». */
  justCreated: boolean;
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function makeKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

type CleaningDocInfo = {
  docId: string;
  title: string;
  currentMode: "pairs" | "rooms";
} | null;

export function ChecklistEditor({
  journalCode,
  rooms,
  isCleaningJournal,
  cleaningDocInfo,
  initial,
}: {
  journalCode: string;
  rooms: Room[];
  isCleaningJournal: boolean;
  cleaningDocInfo?: CleaningDocInfo;
  initial: Item[];
}) {
  const [autoSwitching, setAutoSwitching] = useState(false);

  async function autoSwitchToRoomsMode() {
    if (!cleaningDocInfo) return;
    setAutoSwitching(true);
    try {
      const res = await fetch(`/api/journal-documents/${cleaningDocInfo.docId}`);
      if (!res.ok) throw new Error("Не удалось загрузить документ");
      const doc = await res.json();
      // Все комнаты + все юзеры с подходящей должностью.
      const usedRoomIds = [
        ...new Set(initial.filter((i) => i.roomId).map((i) => i.roomId!)),
      ];
      const targetRoomIds = usedRoomIds.length > 0
        ? usedRoomIds
        : rooms.map((r) => r.id);
      // Достанем cleaners — по responsiblePairs или existing config
      const existingCleaners =
        Array.isArray(doc?.config?.selectedCleanerUserIds) &&
        doc.config.selectedCleanerUserIds.length > 0
          ? doc.config.selectedCleanerUserIds
          : Array.isArray(doc?.config?.responsiblePairs)
            ? doc.config.responsiblePairs
                .map((p: { cleaningUserId?: string }) => p.cleaningUserId)
                .filter((x: unknown): x is string => typeof x === "string")
            : [];

      if (existingCleaners.length === 0) {
        toast.error(
          "В документе нет ни одного уборщика. Сначала открой /journals/cleaning и добавь уборщиков.",
        );
        return;
      }

      const newConfig = {
        ...doc.config,
        cleaningMode: "rooms",
        selectedRoomIds: targetRoomIds,
        selectedCleanerUserIds: existingCleaners,
      };
      const patchRes = await fetch(
        `/api/journal-documents/${cleaningDocInfo.docId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: newConfig }),
        },
      );
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => null);
        toast.error(err?.error ?? "Не удалось переключить режим");
        return;
      }
      toast.success(
        `Документ в rooms-mode! ${targetRoomIds.length} комнат × ${existingCleaners.length} уборщиков. Жми «Force-отправить в TasksFlow» на дашборде чтобы увидеть room-задачи.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setAutoSwitching(false);
    }
  }

  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(
    initial.map((i) => ({
      ...i,
      key: i.id,
      dirty: false,
      justCreated: false,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Draft | null>(null);

  // Группируем drafts по roomId для UI секций.
  const groups = useMemo(() => {
    const byRoom = new Map<string | null, Draft[]>();
    for (const d of drafts) {
      const list = byRoom.get(d.roomId) ?? [];
      list.push(d);
      byRoom.set(d.roomId, list);
    }
    // Сортировка секций: общие (null) первыми, потом по имени комнаты.
    const sections: Array<{
      roomId: string | null;
      roomName: string;
      items: Draft[];
    }> = [];
    if (byRoom.has(null)) {
      sections.push({
        roomId: null,
        roomName: "Общие пункты (для всего журнала)",
        items: byRoom.get(null)!,
      });
    }
    for (const room of rooms) {
      const items = byRoom.get(room.id);
      if (items && items.length > 0) {
        sections.push({ roomId: room.id, roomName: room.name, items });
      }
    }
    return sections;
  }, [drafts, rooms]);

  function addNew(roomId: string | null) {
    setDrafts((d) => [
      ...d,
      {
        key: makeKey(),
        id: null,
        roomId,
        label: "",
        required: true,
        hint: "",
        sortOrder: d.length,
        frequency: "daily",
        weekDays: [],
        monthDay: null,
        dirty: true,
        justCreated: true,
      },
    ]);
  }

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((d) =>
      d.map((it) => (it.key === key ? { ...it, ...patch, dirty: true } : it)),
    );
  }

  function move(key: string, dir: -1 | 1) {
    setDrafts((d) => {
      const idx = d.findIndex((it) => it.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= d.length) return d;
      // Move only within same room-group.
      if (d[idx].roomId !== d[next].roomId) return d;
      const arr = [...d];
      const [m] = arr.splice(idx, 1);
      arr.splice(next, 0, m);
      return arr.map((it, i) => ({ ...it, sortOrder: i }));
    });
  }

  async function saveAll() {
    setBusy(true);
    try {
      let savedCount = 0;
      let updatedCount = 0;
      for (const d of drafts) {
        const payload = {
          label: d.label,
          required: d.required,
          hint: d.hint || undefined,
          roomId: d.roomId,
          frequency: d.frequency,
          weekDays: d.weekDays,
          monthDay: d.monthDay,
        };
        if (d.id === null) {
          if (!d.label.trim()) continue;
          const res = await fetch(
            `/api/settings/journal-checklists/${journalCode}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          if (res.ok) savedCount += 1;
        } else {
          const res = await fetch(
            `/api/settings/journal-checklists/items/${d.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payload, sortOrder: d.sortOrder }),
            },
          );
          if (res.ok) updatedCount += 1;
        }
      }
      toast.success(
        `Сохранено: ${savedCount} новых, ${updatedCount} обновлено`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(draft: Draft) {
    if (!draft.id) {
      setDrafts((d) => d.filter((it) => it.key !== draft.key));
      return;
    }
    const res = await fetch(
      `/api/settings/journal-checklists/items/${draft.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("Не удалось удалить");
      return;
    }
    setDrafts((d) => d.filter((it) => it.key !== draft.key));
    toast.success("Пункт удалён");
    router.refresh();
  }

  const totalCount = drafts.length;
  const requiredCount = drafts.filter((d) => d.required).length;
  const hasDirty = drafts.some((d) => d.dirty || d.id === null);
  const hasPerRoomItems = drafts.some((d) => d.roomId !== null);

  return (
    <div className="space-y-5">
      {/* Hint banner для cleaning-журналов: показывает текущий режим
          документа + кнопку быстрого авто-переключения в rooms-mode
          (если документ в pairs-mode). Для других режимов — просто
          status-индикатор. */}
      {isCleaningJournal && cleaningDocInfo ? (
        cleaningDocInfo.currentMode === "rooms" ? (
          // ✅ Rooms-mode active — всё ок, per-room работают.
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-200/60 text-emerald-800">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-emerald-900">
                Документ в режиме «По комнатам» — per-room работают
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-emerald-800">
                «{cleaningDocInfo.title}» — каждая комната получит
                отдельную задачу в TasksFlow. Чек-лист внутри задачи
                фильтруется по комнате (общие пункты + per-room).
              </p>
            </div>
          </div>
        ) : (
          // ⚠️ Pairs-mode — per-room не показываются. Кнопка для
          // одного-кликом переключения.
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-start">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/60 text-amber-800">
              <Home className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-amber-900">
                Документ в режиме «Пары» — per-room пункты НЕ
                показываются
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-amber-800">
                «{cleaningDocInfo.title}» сейчас в pairs-mode (1 пара
                cleaner-control = 1 task). Чтобы каждая комната получила
                отдельную задачу с per-room чек-листом — переключи
                документ в режим «По комнатам». Существующие настройки
                (уборщики, контролёры) сохранятся.
              </p>
            </div>
            <button
              type="button"
              onClick={autoSwitchToRoomsMode}
              disabled={autoSwitching}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-amber-600 px-4 text-[13px] font-medium text-white shadow-[0_8px_22px_-12px_rgba(217,119,6,0.6)] hover:bg-amber-700 disabled:opacity-60"
            >
              {autoSwitching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Home className="size-4" />
              )}
              Переключить
            </button>
          </div>
        )
      ) : null}
      {/* Stats banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white p-4 sm:p-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-[#0b1024]">
            {totalCount === 0
              ? "Чек-лист пуст"
              : `${totalCount} пунктов в чек-листе`}
            {isCleaningJournal && rooms.length > 0
              ? ` · ${rooms.length} комнат доступно`
              : ""}
          </div>
          <p className="mt-0.5 text-[13px] text-[#6f7282]">
            {requiredCount > 0
              ? `${requiredCount} обязательных — без отметки сотрудник не сможет отправить форму.`
              : "Добавь пункты — без них чек-лист не показывается сотруднику."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => addNew(null)}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[13.5px] font-medium text-white shadow-[0_8px_22px_-12px_rgba(85,102,246,0.6)] hover:bg-[#4a5bf0] disabled:opacity-60"
        >
          <Plus className="size-4" />
          {isCleaningJournal ? "Общий пункт" : "Добавить пункт"}
        </button>
      </div>

      {/* Empty state */}
      {totalCount === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="mt-3 text-[15px] font-medium text-[#0b1024]">
            Пока нет ни одного пункта
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            {isCleaningJournal
              ? "Можно добавить общие пункты ИЛИ привязать к конкретным комнатам — для уборщицы будут разные списки в каждой задаче."
              : "Например «Разобрать оборудование», «Промыть детали»."}
          </p>
        </div>
      ) : null}

      {/* Sections (общие + per-room) */}
      {groups.map((section) => (
        <section
          key={section.roomId ?? "__null__"}
          className="rounded-3xl border border-[#ececf4] bg-white p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`flex size-8 items-center justify-center rounded-xl ${
                section.roomId
                  ? "bg-[#eef1ff] text-[#3848c7]"
                  : "bg-[#f5f6ff] text-[#9b9fb3]"
              }`}
            >
              {section.roomId ? (
                <Home className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </span>
            <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              {section.roomName}
            </h3>
            <span className="text-[12px] text-[#9b9fb3]">
              {section.items.length}{" "}
              {section.items.length === 1
                ? "пункт"
                : section.items.length < 5
                  ? "пункта"
                  : "пунктов"}
            </span>
          </div>
          <div className="space-y-2.5">
            {section.items.map((d, idxInSection) => (
              <DraftRow
                key={d.key}
                draft={d}
                isFirstInSection={idxInSection === 0}
                isLastInSection={idxInSection === section.items.length - 1}
                rooms={rooms}
                isCleaningJournal={isCleaningJournal}
                onUpdate={(patch) => update(d.key, patch)}
                onMove={(dir) => move(d.key, dir)}
                onDelete={() => setPendingDelete(d)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Add per-room section helper */}
      {isCleaningJournal && rooms.length > 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-4 sm:p-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Привязать к комнате
          </div>
          <p className="mt-1 text-[12.5px] text-[#9b9fb3]">
            Для каждой комнаты можно сделать свой набор пунктов — сотрудник
            увидит их только в задаче этой комнаты.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rooms.map((r) => {
              const hasItems = drafts.some((d) => d.roomId === r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addNew(r.id)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                    hasItems
                      ? "border-[#5566f6]/30 bg-[#eef1ff] text-[#3848c7]"
                      : "border-[#dcdfed] bg-white text-[#3c4053] hover:border-[#5566f6]/30 hover:bg-[#f5f6ff]"
                  }`}
                >
                  <Home className="size-3.5" />
                  {r.name}
                  <Plus className="size-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Save bar */}
      {hasDirty ? (
        <div className="sticky bottom-3 flex items-center justify-end gap-3 rounded-2xl border border-[#5566f6]/30 bg-[#eef1ff] p-4 shadow-[0_12px_32px_-12px_rgba(85,102,246,0.4)]">
          <span className="text-[13px] text-[#3848c7]">
            Есть несохранённые изменения
          </span>
          <button
            type="button"
            onClick={saveAll}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-br from-[#3d4efc] to-[#7a5cff] px-5 text-[14px] font-medium text-white shadow-[0_8px_22px_-12px_rgba(85,102,246,0.65)] hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Сохранить чек-лист
          </button>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          open={pendingDelete !== null}
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => {
            const d = pendingDelete;
            setPendingDelete(null);
            if (d) await confirmDelete(d);
          }}
          title="Удалить пункт?"
          description={
            <>
              Пункт «<strong>{pendingDelete.label || "(без названия)"}</strong>»
              будет архивирован — для новых задач он не показан, старые галочки
              в audit-log сохранятся.
            </>
          }
          confirmLabel="Удалить"
          variant="danger"
          icon={Trash2}
        />
      ) : null}
    </div>
  );
}

function DraftRow({
  draft: d,
  isFirstInSection,
  isLastInSection,
  rooms,
  isCleaningJournal,
  onUpdate,
  onMove,
  onDelete,
}: {
  draft: Draft;
  isFirstInSection: boolean;
  isLastInSection: boolean;
  rooms: Room[];
  isCleaningJournal: boolean;
  onUpdate: (p: Partial<Draft>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const dirtyMark = d.dirty
    ? "border-amber-200 bg-amber-50/30"
    : "border-[#ececf4]";

  function toggleWeekday(day1to7: number) {
    const set = new Set(d.weekDays);
    if (set.has(day1to7)) set.delete(day1to7);
    else set.add(day1to7);
    onUpdate({ weekDays: [...set].sort((a, b) => a - b) });
  }

  return (
    <div className={`rounded-2xl border bg-white p-4 transition-colors sm:p-5 ${dirtyMark}`}>
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg bg-[#fafbff] text-[#9b9fb3]">
          <GripVertical className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <input
            type="text"
            value={d.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Что нужно сделать?"
            className="h-12 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
          <input
            type="text"
            value={d.hint ?? ""}
            onChange={(e) => onUpdate({ hint: e.target.value })}
            placeholder="Подсказка (по желанию) — например «температура воды 65°C»"
            className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13.5px] text-[#3c4053] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />

          {/* Frequency control */}
          <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-medium text-[#6f7282]">
                Частота:
              </span>
              {(["daily", "weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onUpdate({ frequency: f })}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors ${
                    d.frequency === f
                      ? "bg-[#5566f6] text-white"
                      : "bg-white text-[#3c4053] hover:bg-[#eef1ff]"
                  }`}
                >
                  {f === "daily"
                    ? "Каждый день"
                    : f === "weekly"
                      ? "По дням недели"
                      : "Раз в месяц"}
                </button>
              ))}
            </div>

            {d.frequency === "weekly" ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((lbl, i) => {
                  const day = i + 1;
                  const active = d.weekDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`flex size-9 items-center justify-center rounded-full text-[12px] font-medium transition-colors ${
                        active
                          ? "bg-[#5566f6] text-white"
                          : "bg-white text-[#6f7282] hover:bg-[#eef1ff]"
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {d.frequency === "monthly" ? (
              <div className="mt-3 flex items-center gap-2">
                <CalendarDays className="size-4 text-[#9b9fb3]" />
                <span className="text-[12.5px] text-[#6f7282]">День месяца:</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={d.monthDay ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      monthDay: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="15"
                  className="h-9 w-20 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13.5px] tabular-nums focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                />
                <span className="text-[12px] text-[#9b9fb3]">
                  (если короткий месяц — последний день)
                </span>
              </div>
            ) : null}
          </div>

          {/* Per-room toggle (только для cleaning + если есть комнаты) */}
          {isCleaningJournal && rooms.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-medium text-[#6f7282]">
                Комната:
              </span>
              <select
                value={d.roomId ?? ""}
                onChange={(e) =>
                  onUpdate({ roomId: e.target.value || null })
                }
                className="h-8 rounded-lg border border-[#dcdfed] bg-white px-2 text-[12.5px] text-[#3c4053] focus:border-[#5566f6] focus:outline-none focus:ring-2 focus:ring-[#5566f6]/15"
              >
                <option value="">— Общий (все комнаты) —</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ required: !d.required })}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
                d.required
                  ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                  : "bg-[#f5f6ff] text-[#9b9fb3] hover:bg-[#eef1ff]"
              }`}
            >
              {d.required ? "обязательно" : "по желанию"}
            </button>
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={isFirstInSection}
              className="inline-flex size-9 items-center justify-center rounded-full bg-[#fafbff] text-[#6f7282] hover:bg-[#eef1ff] hover:text-[#3848c7] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Выше"
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={isLastInSection}
              className="inline-flex size-9 items-center justify-center rounded-full bg-[#fafbff] text-[#6f7282] hover:bg-[#eef1ff] hover:text-[#3848c7] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Ниже"
            >
              <ArrowDown className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-50 px-3 text-[12.5px] font-medium text-rose-700 hover:bg-rose-100"
            >
              <Trash2 className="size-3.5" />
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Used in shared/imports check (no-op)
export const _calendar = Calendar;
