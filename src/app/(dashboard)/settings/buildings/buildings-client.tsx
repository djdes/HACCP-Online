"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { confirmAsync } from "@/components/ui/confirm-async";
import {
  RoomEditorDialog,
  type RoomEditorInitial,
} from "@/components/cleaning/room-editor-dialog";
import {
  countRoomsPerUser,
  toUserIdList,
} from "@/lib/cleaning-room-responsibles";
import type { RoomResponsibleUser } from "@/lib/room-responsible-candidates";

// Cleaning unification 2026-05-08: Room теперь хранит scope/days/detergent.
// RoomEditorDialog позволяет редактировать всё это в /settings/buildings.
type Room = {
  id: string;
  name: string;
  kind: string;
  sortOrder: number;
  // 2026-09-04: кто убирает / кто проверяет.
  cleanerUserIds?: string[];
  verifierUserIds?: string[];
  detergent?: string | null;
  currentScope?: unknown;
  generalScope?: unknown;
  currentDays?: number;
  generalDays?: number;
  currentScheduleType?: string;
  generalScheduleType?: string;
  currentMonthDays?: unknown;
  generalMonthDays?: unknown;
  requirePhoto?: boolean;
};
type Building = {
  id: string;
  name: string;
  address: string | null;
  sortOrder: number;
  rooms: Room[];
};

const KIND_LABELS: Record<string, string> = {
  guest: "Гостевая зона",
  kitchen: "Кухня / горячий цех",
  wash: "Мойка",
  bar: "Бар",
  storage: "Склад",
  other: "Другое",
};

export function BuildingsClient({
  initial,
  users,
  perLocationJournals = false,
}: {
  initial: Building[];
  users: RoomResponsibleUser[];
  /** Точки (2026-09-05): документы журналов ведутся отдельно по зданиям. */
  perLocationJournals?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [flagPending, setFlagPending] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [editorRoom, setEditorRoom] = useState<RoomEditorInitial | null>(null);
  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  // Нагрузка по ДРУГИМ помещениям — подсказка в мультивыборе.
  const otherRooms = initial
    .flatMap((b) => b.rooms)
    .filter((r) => r.id !== editorRoom?.id)
    .map((r) => ({
      id: r.id,
      cleanerUserIds: toUserIdList(r.cleanerUserIds),
      verifierUserIds: toUserIdList(r.verifierUserIds),
    }));
  const roomsPerCleaner = countRoomsPerUser(otherRooms, "cleaner");
  const roomsPerVerifier = countRoomsPerUser(otherRooms, "verifier");

  function refresh() {
    startTransition(() => router.refresh());
  }

  function openEditor(room: Room) {
    setEditorRoom({
      id: room.id,
      name: room.name,
      kind: room.kind,
      cleanerUserIds: toUserIdList(room.cleanerUserIds),
      verifierUserIds: toUserIdList(room.verifierUserIds),
      detergent: room.detergent ?? "",
      // Передаём scope как-есть — RoomEditorDialog.parseScopeSteps
      // нормализует и legacy string[] и новый ScopeStep[] (с per-step
      // requirePhoto). Раньше фильтровали по typeof === "string" → новые
      // объект-шаги дропались, и юзер видел пустой pipeline после
      // первого save (баг сообщён 2026-05-10).
      currentScope: Array.isArray(room.currentScope)
        ? (room.currentScope as Array<string | { label: string; requirePhoto?: boolean }>).filter(
            (s) =>
              typeof s === "string" ||
              (s && typeof s === "object" && typeof (s as { label?: unknown }).label === "string"),
          )
        : [],
      generalScope: Array.isArray(room.generalScope)
        ? (room.generalScope as Array<string | { label: string; requirePhoto?: boolean }>).filter(
            (s) =>
              typeof s === "string" ||
              (s && typeof s === "object" && typeof (s as { label?: unknown }).label === "string"),
          )
        : [],
      currentDays: typeof room.currentDays === "number" ? room.currentDays : 127,
      generalDays: typeof room.generalDays === "number" ? room.generalDays : 0,
      currentScheduleType:
        room.currentScheduleType === "monthly" ? "monthly" : "weekly",
      generalScheduleType:
        room.generalScheduleType === "monthly" ? "monthly" : "weekly",
      currentMonthDays: Array.isArray(room.currentMonthDays)
        ? (room.currentMonthDays as string[]).filter(
            (s) => typeof s === "string",
          )
        : [],
      generalMonthDays: Array.isArray(room.generalMonthDays)
        ? (room.generalMonthDays as string[]).filter(
            (s) => typeof s === "string",
          )
        : [],
      requirePhoto: room.requirePhoto === true,
    });
  }

  async function addBuilding() {
    if (!newName.trim()) return;
    const res = await fetch("/api/settings/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), address: newAddr.trim() || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? "Не удалось создать");
      return;
    }
    setNewName("");
    setNewAddr("");
    setAdding(false);
    toast.success("Здание создано");
    refresh();
  }

  // Тумблер «Вести журналы отдельно по точкам» — единственный переключатель
  // режима точек: после включения в шапке появляется выбор точки, а ночное
  // автосоздание делает документ на каждую.
  async function togglePerLocation(next: boolean) {
    setFlagPending(true);
    try {
      const res = await fetch("/api/settings/buildings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perLocationJournals: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Не удалось сохранить");
      toast.success(
        next
          ? "Журналы ведутся отдельно по точкам — переключатель в шапке"
          : "Журналы снова общие для всех зданий",
      );
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setFlagPending(false);
    }
  }

  async function deleteBuilding(id: string, name: string) {
    const ok = await confirmAsync({
      title: "Удалить точку?",
      description: `Точка «${name}» и её помещения будут удалены. Документы журналов этой точки останутся в организации и станут общими — видимыми на каждой точке.`,
      variant: "danger",
      confirmLabel: "Удалить точку",
    });
    if (!ok) return;
    const res = await fetch(`/api/settings/buildings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Не удалось удалить");
      return;
    }
    toast.success("Точка удалена");
    refresh();
  }

  return (
    <div className="space-y-5">
      {initial.length === 0 && !adding ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <Building2 className="mx-auto mb-3 size-8 text-[#9b9fb3]" />
          <div className="text-[15px] font-medium text-[#0b1024]">
            Пока нет ни одной точки
          </div>
          <p className="mx-auto mt-1.5 max-w-[400px] text-[13px] text-[#6f7282]">
            Заведите первое — например, основную точку или цех. Внутри
            добавите помещения, по которым будут раздаваться задачи уборки.
          </p>
        </div>
      ) : null}

      {initial.length >= 2 ? (
        <div className="flex items-start justify-between gap-4 rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0b1024]">
              <MapPin className="size-4 text-[#5566f6]" />
              Вести журналы отдельно по точкам
            </div>
            <p className="mt-1 text-[13px] leading-[1.55] text-[#6f7282]">
              {perLocationJournals
                ? "Включено: в шапке есть выбор точки, документы журналов создаются на каждую точку, сотрудники и настройки общие."
                : "Сейчас здания — просто группы помещений, документы общие. Включите, если это разные точки: у каждой будут свои документы, а в шапке появится выбор точки."}
            </p>
          </div>
          <Switch
            checked={perLocationJournals}
            disabled={flagPending}
            onCheckedChange={(next) => void togglePerLocation(next)}
            aria-label="Вести журналы отдельно по точкам"
          />
        </div>
      ) : null}

      {initial.map((b) => (
        <BuildingCard
          key={b.id}
          building={b}
          userNameById={userNameById}
          onRefresh={refresh}
          onDelete={() => deleteBuilding(b.id, b.name)}
          onEditRoom={openEditor}
        />
      ))}

      <RoomEditorDialog
        open={editorRoom !== null}
        onOpenChange={(o) => {
          if (!o) setEditorRoom(null);
        }}
        initial={editorRoom}
        onSaved={refresh}
        users={users}
        roomsPerCleaner={roomsPerCleaner}
        roomsPerVerifier={roomsPerVerifier}
      />

      {adding ? (
        <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#0b1024]">Новая точка</div>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full p-1 text-[#9b9fb3] hover:bg-[#fafbff] hover:text-[#0b1024]"
            >
              <X className="size-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Название (например, «Основная точка»)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mb-2 h-11 w-full rounded-2xl border border-[#dcdfed] px-4 text-[14px] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
          <input
            type="text"
            placeholder="Адрес (необязательно)"
            value={newAddr}
            onChange={(e) => setNewAddr(e.target.value)}
            className="mb-3 h-11 w-full rounded-2xl border border-[#dcdfed] px-4 text-[14px] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
          <button
            type="button"
            onClick={addBuilding}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0]"
          >
            Создать
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-[#dcdfed] bg-white px-5 text-[14px] font-medium text-[#3c4053] hover:border-[#5566f6]/50 hover:bg-[#f5f6ff] hover:text-[#5566f6]"
        >
          <Plus className="size-4" />
          Добавить точку
        </button>
      )}
    </div>
  );
}

function BuildingCard({
  building,
  userNameById,
  onRefresh,
  onDelete,
  onEditRoom,
}: {
  building: Building;
  userNameById: Map<string, string>;
  onRefresh: () => void;
  onDelete: () => void;
  onEditRoom: (room: Room) => void;
}) {
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomKind, setRoomKind] = useState<string>("other");

  async function addRoom() {
    if (!roomName.trim()) return;
    const res = await fetch("/api/settings/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buildingId: building.id,
        name: roomName.trim(),
        kind: roomKind,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? "Не удалось добавить");
      return;
    }
    const created = (await res.json().catch(() => ({}))) as { room?: Room };
    setRoomName("");
    setRoomKind("other");
    setAddingRoom(false);
    toast.success("Помещение добавлено — назначьте, кто убирает");
    onRefresh();
    // «При добавлении»: сразу открываем карточку нового помещения —
    // уборщики, проверяющие и состав уборки настраиваются в одном окне.
    if (created.room?.id) onEditRoom(created.room);
  }

  async function deleteRoom(id: string, name: string) {
    const ok = await confirmAsync({
      title: "Удалить помещение?",
      description: `Помещение «${name}» будет удалено. Связанные записи журналов потеряют ссылку на зону.`,
      variant: "danger",
      confirmLabel: "Удалить помещение",
    });
    if (!ok) return;
    const res = await fetch(`/api/settings/rooms/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Не удалось удалить");
      return;
    }
    toast.success("Помещение удалено");
    onRefresh();
  }

  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-[#5566f6]" />
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              {building.name}
            </h2>
          </div>
          {building.address ? (
            <div className="mt-0.5 text-[13px] text-[#6f7282]">{building.address}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Удалить точку"
          className="rounded-full p-1.5 text-[#9b9fb3] hover:bg-[#fff4f2] hover:text-[#d2453d]"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        {building.rooms.length === 0 && !addingRoom ? (
          <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-3 text-center text-[13px] text-[#6f7282]">
            Помещений пока нет — добавьте, чтобы они появились в журналах
            уборки.
          </div>
        ) : null}
        {building.rooms.map((room) => {
          const currentLen = Array.isArray(room.currentScope)
            ? (room.currentScope as unknown[]).length
            : 0;
          const generalLen = Array.isArray(room.generalScope)
            ? (room.generalScope as unknown[]).length
            : 0;
          const hasCleaningCfg =
            currentLen + generalLen > 0 ||
            (room.detergent && room.detergent.length > 0);
          const nameOf = (id: string) => userNameById.get(id) ?? "—";
          const cleanerNames = toUserIdList(room.cleanerUserIds).map(nameOf);
          const verifierNames = toUserIdList(room.verifierUserIds).map(nameOf);
          return (
            <div
              key={room.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-3 py-2 text-[13.5px]"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-2 flex-wrap">
                  <span className="font-medium text-[#0b1024]">{room.name}</span>
                  <span className="rounded-full bg-[#eef1ff] px-2 py-0.5 text-[11px] text-[#3848c7]">
                    {KIND_LABELS[room.kind] ?? room.kind}
                  </span>
                  {hasCleaningCfg ? (
                    <span
                      className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] text-[#136b2a]"
                      title={`Текущая: ${currentLen} шаг(ов), Генеральная: ${generalLen}`}
                    >
                      🧽 Уборка настроена ({currentLen}/{generalLen})
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#fff8eb] px-2 py-0.5 text-[11px] text-[#a16d32]">
                      Уборка не настроена
                    </span>
                  )}
                </div>
                {/* Кто убирает / кто проверяет — видно без открытия карточки. */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                  {cleanerNames.length > 0 ? (
                    <span className="rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[#3848c7]">
                      Убирает: {cleanerNames.join(", ")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[#9b9fb3] ring-1 ring-inset ring-[#ececf4]">
                      Уборщики не назначены
                    </span>
                  )}
                  {verifierNames.length > 0 ? (
                    <span className="rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[#3848c7]">
                      Проверяет: {verifierNames.join(", ")}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditRoom(room)}
                  aria-label="Настроить уборку"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-[#3848c7] transition-colors hover:bg-white"
                >
                  <Pencil className="size-3.5" />
                  Настроить
                </button>
                <button
                  type="button"
                  onClick={() => deleteRoom(room.id, room.name)}
                  aria-label="Удалить помещение"
                  className="rounded-full p-1 text-[#9b9fb3] hover:bg-white hover:text-[#d2453d]"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {addingRoom ? (
        <div className="mt-3 rounded-2xl border border-[#dcdfed] bg-white p-3">
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Название помещения"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="h-10 flex-1 rounded-xl border border-[#dcdfed] px-3 text-[13.5px] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />
            <select
              value={roomKind}
              onChange={(e) => setRoomKind(e.target.value)}
              className="h-10 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13.5px] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            >
              {Object.entries(KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addRoom}
              className="inline-flex h-9 items-center rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white hover:bg-[#4a5bf0]"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingRoom(false);
                setRoomName("");
              }}
              className="inline-flex h-9 items-center rounded-xl px-3 text-[13px] text-[#6f7282] hover:bg-[#f5f6ff] hover:text-[#0b1024]"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingRoom(true)}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-[#dcdfed] px-3 text-[13px] text-[#3c4053] hover:border-[#5566f6]/50 hover:bg-[#f5f6ff] hover:text-[#5566f6]"
        >
          <Plus className="size-3.5" />
          Добавить помещение
        </button>
      )}
    </div>
  );
}
