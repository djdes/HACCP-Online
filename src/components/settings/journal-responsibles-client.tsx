"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { RESPONSIBLE_PRESETS } from "@/lib/journal-responsible-presets";

type Position = {
  id: string;
  name: string;
  categoryKey: string;
  activeUsers: number;
};

type Journal = {
  code: string;
  name: string;
  description: string | null;
  initialPositionIds: string[];
};

type Props = {
  positions: Position[];
  journals: Journal[];
};

type Selection = Map<string, Set<string>>; // code -> positionIds

function toSelection(journals: Journal[]): Selection {
  const m: Selection = new Map();
  for (const j of journals) m.set(j.code, new Set(j.initialPositionIds));
  return m;
}

function diff(base: Selection, curr: Selection): Set<string> {
  const changed = new Set<string>();
  for (const [code, set] of curr.entries()) {
    const baseSet = base.get(code) ?? new Set<string>();
    if (set.size !== baseSet.size) {
      changed.add(code);
      continue;
    }
    for (const id of set) {
      if (!baseSet.has(id)) {
        changed.add(code);
        break;
      }
    }
  }
  return changed;
}

export function JournalResponsiblesClient({ positions, journals }: Props) {
  const router = useRouter();
  const [base, setBase] = useState<Selection>(() => toSelection(journals));
  const [curr, setCurr] = useState<Selection>(() => toSelection(journals));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const dirty = diff(base, curr);

  const q = query.trim().toLowerCase();
  const filteredJournals = useMemo(
    () =>
      journals.filter(
        (j) =>
          !q ||
          j.name.toLowerCase().includes(q) ||
          j.code.toLowerCase().includes(q)
      ),
    [journals, q]
  );

  const positionsById = useMemo(
    () => new Map(positions.map((p) => [p.id, p])),
    [positions]
  );

  function togglePosition(code: string, positionId: string) {
    setCurr((prev) => {
      const copy = new Map(prev);
      const set = new Set(copy.get(code) ?? new Set<string>());
      if (set.has(positionId)) set.delete(positionId);
      else set.add(positionId);
      copy.set(code, set);
      return copy;
    });
  }

  function applyJournalPreset(code: string) {
    const preset = RESPONSIBLE_PRESETS.find((p) =>
      p.journalCodes.includes(code)
    );
    if (!preset) {
      toast.error("Для этого журнала нет умного пресета");
      return;
    }
    const matched = positions.filter((p) => {
      if (preset.positionKeywords.length === 0) return true;
      const lower = p.name.toLowerCase();
      return preset.positionKeywords.some((kw) => lower.includes(kw));
    });
    if (matched.length === 0) {
      toast.error(
        `Не нашёл должности подходящие под «${preset.label}». Создайте/переименуйте.`
      );
      return;
    }
    setCurr((prev) => {
      const copy = new Map(prev);
      copy.set(code, new Set(matched.map((m) => m.id)));
      return copy;
    });
    toast.success(`«${preset.label}» — ${matched.length} должн.`);
  }

  async function applyAllPresets() {
    if (applying) return;
    if (
      !window.confirm(
        "Применить умные пресеты ко ВСЕМ журналам? Существующие назначения " +
          "по охваченным журналам будут перезаписаны."
      )
    )
      return;
    setApplying(true);
    try {
      const res = await fetch(
        "/api/settings/journal-responsibles/apply-presets",
        { method: "POST" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка");
        return;
      }
      toast.success(
        data?.message ??
          `Готово · обновлено журналов: ${data?.journalsUpdated ?? 0}`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setApplying(false);
    }
  }

  async function save() {
    if (saving || dirty.size === 0) return;
    setSaving(true);
    try {
      let ok = 0;
      let failed = 0;
      for (const code of dirty) {
        const set = curr.get(code) ?? new Set<string>();
        const res = await fetch(`/api/settings/journal-responsibles/${code}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionIds: [...set] }),
        });
        if (res.ok) ok += 1;
        else failed += 1;
      }
      if (failed > 0) {
        toast.error(
          `Сохранено: ${ok}, не удалось: ${failed}. Попробуйте ещё раз.`
        );
      } else {
        toast.success(`Сохранено · журналов: ${ok}`);
        setBase(new Map(curr));
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setCurr(new Map(base));
  }

  return (
    <div className="space-y-5">
      {/* Top bar: smart presets + search + save */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white p-4">
        <button
          type="button"
          onClick={applyAllPresets}
          disabled={applying}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-br from-[#5566f6] to-[#7a5cff] px-4 text-[14px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(85,102,246,0.6)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {applying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          Применить умные пресеты ко всем
        </button>

        <div className="relative ml-auto flex items-center">
          <Search className="absolute left-3 size-4 text-[#9b9fb3]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск журнала…"
            className="h-11 w-[280px] rounded-2xl border border-[#dcdfed] bg-[#fafbff] pl-9 pr-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>

        {dirty.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#a13a32]">
              Несохранённых: {dirty.size}
            </span>
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] text-[#3c4053] hover:bg-[#fafbff] disabled:opacity-60"
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white hover:bg-[#4a5bf0] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Сохранить
            </button>
          </div>
        ) : null}
      </div>

      {positions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-8 text-center text-[14px] text-[#6f7282]">
          В организации нет должностей. Сначала создайте должности и
          сотрудников в{" "}
          <a href="/settings/users" className="text-[#3848c7] hover:underline">
            Сотрудники
          </a>
          .
        </div>
      ) : null}

      {/* Journals list */}
      <div className="grid gap-3">
        {filteredJournals.map((j) => {
          const set = curr.get(j.code) ?? new Set<string>();
          const isDirty = dirty.has(j.code);
          const hasPreset = RESPONSIBLE_PRESETS.some((p) =>
            p.journalCodes.includes(j.code)
          );
          return (
            <div
              key={j.code}
              className={`rounded-2xl border bg-white p-4 transition-colors ${
                isDirty ? "border-[#ffe9b0] bg-[#fff8eb]/40" : "border-[#ececf4]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-tight text-[#0b1024]">
                    {j.name}
                  </div>
                  {j.description ? (
                    <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#6f7282]">
                      {j.description}
                    </div>
                  ) : null}
                </div>
                {hasPreset ? (
                  <button
                    type="button"
                    onClick={() => applyJournalPreset(j.code)}
                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#dcdfed] bg-white px-2.5 text-[12px] text-[#5566f6] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                    title="Подставить должности по умолчанию"
                  >
                    <Sparkles className="size-3.5" />
                    Умный пресет
                  </button>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {set.size === 0 ? (
                  <span className="rounded-full bg-[#fff4f2] px-2.5 py-1 text-[11px] font-medium text-[#a13a32]">
                    Никто не назначен
                  </span>
                ) : null}
                {[...set].map((pid) => {
                  const p = positionsById.get(pid);
                  if (!p) return null;
                  return (
                    <button
                      type="button"
                      key={pid}
                      onClick={() => togglePosition(j.code, pid)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#eef1ff] px-2.5 py-1 text-[12px] font-medium text-[#3848c7] hover:bg-[#fff4f2] hover:text-[#a13a32]"
                      title="Снять"
                    >
                      <Check className="size-3" />
                      {p.name}
                      <span className="text-[10px] text-[#9b9fb3]">
                        ({p.activeUsers})
                      </span>
                      <X className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>

              {/* Add position picker */}
              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] text-[#6f7282] hover:text-[#5566f6]">
                  <Plus className="size-3.5" />
                  Добавить должность
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {positions
                    .filter((p) => !set.has(p.id))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePosition(j.code, p.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#dcdfed] bg-[#fafbff] px-2.5 py-1 text-[12px] text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] hover:text-[#3848c7]"
                      >
                        <Plus className="size-3" />
                        {p.name}
                        <span className="text-[10px] text-[#9b9fb3]">
                          ({p.activeUsers})
                        </span>
                      </button>
                    ))}
                </div>
              </details>
            </div>
          );
        })}

        {filteredJournals.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-8 text-center text-[14px] text-[#6f7282]">
            Не найдено журналов под «{query}».
          </div>
        ) : null}
      </div>
    </div>
  );
}
