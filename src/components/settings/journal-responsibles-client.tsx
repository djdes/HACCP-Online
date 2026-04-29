"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORY_LABELS,
  MODE_LABELS,
  getJournalResponsibilityMeta,
  matchPositionsForJournal,
  type JournalCategory,
} from "@/lib/journal-responsible-presets";

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

const CATEGORY_ORDER: JournalCategory[] = [
  "health",
  "cleaning",
  "temperature",
  "production",
  "intake",
  "equipment",
  "training",
  "incidents",
  "audit",
  "other",
];

const MODE_TONE: Record<string, string> = {
  "per-employee": "bg-[#eef1ff] text-[#3848c7]",
  shared: "bg-[#ecfdf5] text-[#136b2a]",
  single: "bg-[#fff8eb] text-[#a13a32]",
};

export function JournalResponsiblesClient({ positions, journals }: Props) {
  const router = useRouter();
  const [base, setBase] = useState<Selection>(() => toSelection(journals));
  const [curr, setCurr] = useState<Selection>(() => toSelection(journals));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyingCategory, setApplyingCategory] = useState<JournalCategory | null>(
    null
  );
  const [collapsed, setCollapsed] = useState<Set<JournalCategory>>(
    () => new Set()
  );

  // Если родительская server-component дёрнула router.refresh() и
  // обновила journals — пересинхронизируем локальный state. Без этого
  // useState остаётся со «старым» снимком на момент монтирования.
  useEffect(() => {
    const next = toSelection(journals);
    setBase(next);
    setCurr((prev) => {
      // Если у юзера есть несохранённые изменения, не сбрасываем — пусть
      // dirty-индикатор остаётся. Перезаписываем только если prev==base
      // (т.е. ничего не меняли локально).
      const prevDirty = diff(toSelection(journals), prev).size > 0;
      if (prevDirty) return prev;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journals]);

  const dirty = diff(base, curr);

  const positionsById = useMemo(
    () => new Map(positions.map((p) => [p.id, p])),
    [positions]
  );

  // Build journal entries with meta + group by category.
  const enriched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return journals
      .map((j) => {
        const meta = getJournalResponsibilityMeta(j.code);
        return {
          ...j,
          meta,
          category: (meta?.category ?? "other") as JournalCategory,
        };
      })
      .filter(
        (j) =>
          !q ||
          j.name.toLowerCase().includes(q) ||
          j.code.toLowerCase().includes(q) ||
          (j.meta?.who ?? "").toLowerCase().includes(q)
      );
  }, [journals, query]);

  const grouped = useMemo(() => {
    const map = new Map<JournalCategory, typeof enriched>();
    for (const j of enriched) {
      const list = map.get(j.category) ?? [];
      list.push(j);
      map.set(j.category, list);
    }
    return CATEGORY_ORDER.map(
      (cat) => [cat, map.get(cat) ?? []] as const
    ).filter(([, list]) => list.length > 0);
  }, [enriched]);

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
    const meta = getJournalResponsibilityMeta(code);
    if (!meta) {
      toast.error("Для этого журнала не описан умный пресет");
      return;
    }
    const matchedIds = matchPositionsForJournal(code, positions);
    if (matchedIds.length === 0) {
      toast.error(
        `Не нашёл должности под ключевые слова: ${meta.keywords.join(", ")}. Заведите подходящую должность или добавьте вручную.`
      );
      return;
    }
    setCurr((prev) => {
      const copy = new Map(prev);
      copy.set(code, new Set(matchedIds));
      return copy;
    });
    toast.success(
      `${meta.code} ← ${matchedIds.length} должн. (${meta.keywords.join(", ")})`
    );
  }

  /**
   * Считает локально что именно поменяется на наборе журналов:
   * Map<journalCode, Set<positionId>>. Если ни одна должность не
   * подошла — журнал в результат не попадает.
   */
  function computeAssignmentsFor(codes: readonly string[]): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const code of codes) {
      const matched = matchPositionsForJournal(code, positions);
      if (matched.length === 0) continue;
      result.set(code, new Set(matched));
    }
    return result;
  }

  /**
   * Вызывает PUT для каждого journal'а и возвращает число успехов/ошибок.
   * Обновляет base+curr только для тех, что прошли — мгновенный UI.
   */
  async function persistAssignments(
    assignments: Map<string, Set<string>>
  ): Promise<{ ok: number; failed: number }> {
    let ok = 0;
    let failed = 0;
    const successful = new Map<string, Set<string>>();
    for (const [code, set] of assignments) {
      try {
        const res = await fetch(
          `/api/settings/journal-responsibles/${code}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ positionIds: [...set] }),
          }
        );
        if (res.ok) {
          ok += 1;
          successful.set(code, set);
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
    if (successful.size > 0) {
      // Мгновенно обновляем локальный state — UI меняется без refresh.
      setCurr((prev) => {
        const copy = new Map(prev);
        for (const [code, set] of successful) copy.set(code, new Set(set));
        return copy;
      });
      setBase((prev) => {
        const copy = new Map(prev);
        for (const [code, set] of successful) copy.set(code, new Set(set));
        return copy;
      });
    }
    return { ok, failed };
  }

  async function applyAllPresets() {
    if (applying) return;
    if (positions.length === 0) {
      toast.error("Сначала создайте должности и сотрудников");
      return;
    }
    if (
      !window.confirm(
        "Применить умные пресеты ко ВСЕМ журналам? Существующие назначения " +
          "будут перезаписаны на каждом журнале, для которого нашлась " +
          "подходящая должность."
      )
    )
      return;
    setApplying(true);
    try {
      const allCodes = journals.map((j) => j.code);
      const assignments = computeAssignmentsFor(allCodes);
      if (assignments.size === 0) {
        toast.error(
          "Ни одна должность не подошла под пресеты. Заведите должности " +
            "вроде «Уборщица», «Повар», «Менеджер»."
        );
        return;
      }
      const { ok, failed } = await persistAssignments(assignments);
      if (failed > 0) {
        toast.error(`Готово · применено: ${ok}, не удалось: ${failed}`);
      } else {
        toast.success(`Применено к ${ok} журналам`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setApplying(false);
    }
  }

  async function applyCategoryPresets(category: JournalCategory) {
    if (applyingCategory) return;
    if (positions.length === 0) {
      toast.error("Сначала создайте должности и сотрудников");
      return;
    }
    setApplyingCategory(category);
    try {
      const codesInCategory = journals
        .filter((j) => {
          const meta = getJournalResponsibilityMeta(j.code);
          return (meta?.category ?? "other") === category;
        })
        .map((j) => j.code);
      const assignments = computeAssignmentsFor(codesInCategory);
      if (assignments.size === 0) {
        toast.error(
          `Не нашёл подходящих должностей для категории «${CATEGORY_LABELS[category]}». Заведите должность по теме (например, «Уборщица» для уборки).`
        );
        return;
      }
      const { ok, failed } = await persistAssignments(assignments);
      if (failed > 0) {
        toast.error(
          `«${CATEGORY_LABELS[category]}» · применено: ${ok}, не удалось: ${failed}`
        );
      } else {
        toast.success(
          `«${CATEGORY_LABELS[category]}» · применено к ${ok} журналам`
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setApplyingCategory(null);
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

  function toggleCategory(cat: JournalCategory) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white p-4">
        <button
          type="button"
          onClick={applyAllPresets}
          disabled={applying || positions.length === 0}
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
            placeholder="Поиск по журналу или роли…"
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

      {/* Grouped journals */}
      <div className="space-y-5">
        {grouped.map(([cat, items]) => {
          const isCollapsed = collapsed.has(cat);
          const isApplyingThis = applyingCategory === cat;
          return (
            <section key={cat} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="group flex flex-1 items-center gap-2 rounded-xl text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-[#6f7282] transition-transform" />
                  ) : (
                    <ChevronDown className="size-4 text-[#6f7282] transition-transform" />
                  )}
                  <h2 className="text-[14px] font-semibold uppercase tracking-[0.12em] text-[#0b1024]">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <span className="text-[12px] text-[#9b9fb3]">
                    · {items.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCategoryPresets(cat)}
                  disabled={
                    !!applyingCategory ||
                    applying ||
                    positions.length === 0
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-2.5 text-[12px] font-medium text-[#5566f6] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:cursor-not-allowed disabled:opacity-50"
                  title={`Применить умные пресеты для категории «${CATEGORY_LABELS[cat]}»`}
                >
                  {isApplyingThis ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="size-3.5" />
                  )}
                  Применить пресет
                </button>
              </div>

              {isCollapsed ? null : (
                <div className="grid gap-2.5">
                  {items.map((j) => {
                    const set = curr.get(j.code) ?? new Set<string>();
                    const isDirty = dirty.has(j.code);
                    const meta = j.meta;
                    return (
                      <div
                        key={j.code}
                        className={`rounded-2xl border bg-white p-4 transition-colors ${
                          isDirty
                            ? "border-[#ffe9b0] bg-[#fff8eb]/40"
                            : "border-[#ececf4]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-[15px] font-semibold leading-tight text-[#0b1024]">
                                {j.name}
                              </div>
                              {meta ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${MODE_TONE[meta.mode] ?? "bg-[#fafbff] text-[#6f7282]"}`}
                                >
                                  {MODE_LABELS[meta.mode]}
                                </span>
                              ) : null}
                            </div>
                            {meta?.who ? (
                              <p className="mt-1.5 text-[12px] leading-relaxed text-[#3c4053]">
                                {meta.who}
                              </p>
                            ) : j.description ? (
                              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#6f7282]">
                                {j.description}
                              </p>
                            ) : null}
                          </div>
                          {meta ? (
                            <button
                              type="button"
                              onClick={() => applyJournalPreset(j.code)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#dcdfed] bg-white px-2.5 text-[12px] text-[#5566f6] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                              title={`Подставить должности по keywords: ${meta.keywords.join(", ") || "(всем)"}`}
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
                                className="inline-flex items-center gap-1 rounded-full bg-[#eef1ff] px-2.5 py-1 text-[12px] font-medium text-[#3848c7] transition-colors hover:bg-[#fff4f2] hover:text-[#a13a32]"
                                title="Снять"
                              >
                                <Check className="size-3" />
                                {p.name}
                                <span className="text-[10px] text-[#9b9fb3]">
                                  ({p.activeUsers})
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <details className="mt-3">
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
                                  onClick={() =>
                                    togglePosition(j.code, p.id)
                                  }
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
                </div>
              )}
            </section>
          );
        })}

        {grouped.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-8 text-center text-[14px] text-[#6f7282]">
            Не найдено журналов под «{query}».
          </div>
        ) : null}
      </div>
    </div>
  );
}
