"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Room = { id: string; name: string; kind: string; sortOrder: number };
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

export function BuildingsClient({ initial }: { initial: Building[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddr, setNewAddr] = useState("");

  function refresh() {
    startTransition(() => router.refresh());
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

  async function deleteBuilding(id: string, name: string) {
    if (!window.confirm(`Удалить «${name}» вместе со всеми помещениями?`)) return;
    const res = await fetch(`/api/settings/buildings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Не удалось удалить");
      return;
    }
    toast.success("Здание удалено");
    refresh();
  }

  return (
    <div className="space-y-4">
      {initial.length === 0 && !adding ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <Building2 className="mx-auto mb-3 size-8 text-[#9b9fb3]" />
          <div className="text-[15px] font-medium text-[#0b1024]">
            Пока нет ни одного здания
          </div>
          <p className="mx-auto mt-1.5 max-w-[400px] text-[13px] text-[#6f7282]">
            Заведите первое — например, основную точку или цех. Внутри
            добавите помещения, по которым будут раздаваться задачи уборки.
          </p>
        </div>
      ) : null}

      {initial.map((b) => (
        <BuildingCard key={b.id} building={b} onRefresh={refresh} onDelete={() => deleteBuilding(b.id, b.name)} />
      ))}

      {adding ? (
        <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#0b1024]">Новое здание</div>
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
          Добавить здание
        </button>
      )}
    </div>
  );
}

function BuildingCard({
  building,
  onRefresh,
  onDelete,
}: {
  building: Building;
  onRefresh: () => void;
  onDelete: () => void;
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
    setRoomName("");
    setRoomKind("other");
    setAddingRoom(false);
    toast.success("Помещение добавлено");
    onRefresh();
  }

  async function deleteRoom(id: string, name: string) {
    if (!window.confirm(`Удалить помещение «${name}»?`)) return;
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
          aria-label="Удалить здание"
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
        {building.rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center justify-between rounded-2xl border border-[#ececf4] bg-[#fafbff] px-3 py-2 text-[13.5px]"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#0b1024]">{room.name}</span>
              <span className="rounded-full bg-[#eef1ff] px-2 py-0.5 text-[11px] text-[#3848c7]">
                {KIND_LABELS[room.kind] ?? room.kind}
              </span>
            </div>
            <button
              type="button"
              onClick={() => deleteRoom(room.id, room.name)}
              aria-label="Удалить помещение"
              className="rounded-full p-1 text-[#9b9fb3] hover:bg-white hover:text-[#d2453d]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
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
