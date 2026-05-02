"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
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
};

type Draft = {
  /** Стейбл-ключ для рендера (id если уже сохранён, локальный uid если новый). */
  key: string;
  id: string | null;
  label: string;
  required: boolean;
  hint: string;
  /** dirty=true если local-state расходится с сервером. */
  dirty: boolean;
};

function makeKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ChecklistEditor({
  journalCode,
  initial,
}: {
  journalCode: string;
  initial: Item[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(
    initial.map((i) => ({
      key: i.id,
      id: i.id,
      label: i.label,
      required: i.required,
      hint: i.hint ?? "",
      dirty: false,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Draft | null>(null);

  function addNew() {
    setDrafts((d) => [
      ...d,
      {
        key: makeKey(),
        id: null,
        label: "",
        required: true,
        hint: "",
        dirty: true,
      },
    ]);
  }

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((d) =>
      d.map((it) =>
        it.key === key ? { ...it, ...patch, dirty: true } : it,
      ),
    );
  }

  function move(key: string, dir: -1 | 1) {
    setDrafts((d) => {
      const idx = d.findIndex((it) => it.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= d.length) return d;
      const arr = [...d];
      const [m] = arr.splice(idx, 1);
      arr.splice(next, 0, m);
      return arr;
    });
  }

  async function saveAll() {
    setBusy(true);
    try {
      let savedCount = 0;
      let updatedCount = 0;
      // 1. Создать новые.
      for (const d of drafts) {
        if (d.id !== null) continue;
        if (!d.label.trim()) continue; // пустые игнорим
        const res = await fetch(
          `/api/settings/journal-checklists/${journalCode}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: d.label,
              required: d.required,
              hint: d.hint || undefined,
            }),
          },
        );
        if (res.ok) savedCount += 1;
      }
      // 2. Обновить существующие dirty (sortOrder тоже синкаем
      //    т.к. порядок мог поменяться из-за move()).
      for (let i = 0; i < drafts.length; i += 1) {
        const d = drafts[i];
        if (!d.id) continue;
        const res = await fetch(
          `/api/settings/journal-checklists/items/${d.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: d.label,
              required: d.required,
              hint: d.hint || null,
              sortOrder: i,
            }),
          },
        );
        if (res.ok) updatedCount += 1;
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
      // Локальный пункт — просто убираем из state.
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

  const requiredCount = drafts.filter((d) => d.required).length;
  const totalCount = drafts.length;

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white p-4 sm:p-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-[#0b1024]">
            {totalCount === 0
              ? "Чек-лист пуст"
              : `${totalCount} ${totalCount === 1 ? "пункт" : totalCount < 5 ? "пункта" : "пунктов"} в чек-листе`}
          </div>
          <p className="mt-0.5 text-[13px] text-[#6f7282]">
            {requiredCount > 0
              ? `${requiredCount} обязательных — без отметки сотрудник не сможет отправить форму.`
              : "Все пункты — по желанию. Можно сделать обязательными для строгого контроля."}
          </p>
        </div>
        <button
          type="button"
          onClick={addNew}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[13.5px] font-medium text-white shadow-[0_8px_22px_-12px_rgba(85,102,246,0.6)] hover:bg-[#4a5bf0] disabled:opacity-60"
        >
          <Plus className="size-4" />
          Добавить пункт
        </button>
      </div>

      {/* Items */}
      {drafts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="mt-3 text-[15px] font-medium text-[#0b1024]">
            Пока нет ни одного пункта
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            Добавь первый пункт — например «Разобрать оборудование» —
            и сотрудник увидит его в форме заполнения этого журнала.
          </p>
          <button
            type="button"
            onClick={addNew}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[13.5px] font-medium text-white shadow-[0_8px_22px_-12px_rgba(85,102,246,0.6)] hover:bg-[#4a5bf0]"
          >
            <Plus className="size-4" />
            Добавить первый пункт
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {drafts.map((d, idx) => (
            <div
              key={d.key}
              className={`rounded-2xl border bg-white p-4 transition-colors sm:p-5 ${
                d.dirty
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-[#ececf4]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg bg-[#fafbff] text-[#9b9fb3]">
                  <GripVertical className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <input
                    type="text"
                    value={d.label}
                    onChange={(e) => update(d.key, { label: e.target.value })}
                    placeholder="Что нужно сделать?"
                    className="h-12 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                  />
                  <input
                    type="text"
                    value={d.hint}
                    onChange={(e) => update(d.key, { hint: e.target.value })}
                    placeholder="Подсказка (по желанию) — например «температура воды 65°C»"
                    className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13.5px] text-[#3c4053] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        update(d.key, { required: !d.required })
                      }
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
                      onClick={() => move(d.key, -1)}
                      disabled={idx === 0}
                      className="inline-flex size-9 items-center justify-center rounded-full bg-[#fafbff] text-[#6f7282] hover:bg-[#eef1ff] hover:text-[#3848c7] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Выше"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(d.key, 1)}
                      disabled={idx === drafts.length - 1}
                      className="inline-flex size-9 items-center justify-center rounded-full bg-[#fafbff] text-[#6f7282] hover:bg-[#eef1ff] hover:text-[#3848c7] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Ниже"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(d)}
                      className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-50 px-3 text-[12.5px] font-medium text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="size-3.5" />
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save bar (sticky bottom когда есть изменения) */}
      {drafts.some((d) => d.dirty || d.id === null) ? (
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
              будет архивирован — для новых задач он не будет показан, но
              старые галочки в audit-log сохранятся.
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
