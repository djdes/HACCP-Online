"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Save,
  Search,
  Sparkles,
  Network as NetworkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PositionRow = {
  id: string;
  name: string;
  categoryKey: string;
  activeUsers: number;
  initialCodes: string[];
};

type CatalogItem = { code: string; name: string };

type Props = {
  positions: PositionRow[];
  catalog: CatalogItem[];
};

type Matrix = Map<string, Set<string>>; // positionId -> templateCodes

const PRESETS: Array<{
  label: string;
  positionKeywords: string[];
  templateCodes: string[];
}> = [
  {
    label: "Уборка → уборщикам",
    positionKeywords: ["уборщ", "клинер"],
    templateCodes: [
      "cleaning",
      "general_cleaning",
      "cleaning_ventilation_checklist",
      "sanitary_day_checklist",
      "sanitation_day",
      "uv_lamp_runtime",
      "disinfectant_usage",
    ],
  },
  {
    label: "Температура → поварам",
    positionKeywords: ["повар", "шеф", "кух"],
    templateCodes: [
      "climate_control",
      "cold_equipment_control",
      "intensive_cooling",
      "fryer_oil",
      "finished_product",
    ],
  },
  {
    label: "Здоровье → всем",
    positionKeywords: [],
    templateCodes: ["hygiene", "health_check", "med_books"],
  },
  {
    label: "Приёмка → товароведам",
    positionKeywords: ["товаровед", "кладов", "снабж"],
    templateCodes: [
      "incoming_control",
      "incoming_raw_materials_control",
      "perishable_rejection",
      "metal_impurity",
      "traceability_test",
    ],
  },
];

function toMatrix(positions: PositionRow[]): Matrix {
  const m: Matrix = new Map();
  for (const p of positions) m.set(p.id, new Set(p.initialCodes));
  return m;
}

function matrixDiff(base: Matrix, curr: Matrix): Set<string> {
  const changed = new Set<string>();
  for (const [posId, currSet] of curr.entries()) {
    const baseSet = base.get(posId) ?? new Set<string>();
    if (currSet.size !== baseSet.size) {
      changed.add(posId);
      continue;
    }
    for (const code of currSet) {
      if (!baseSet.has(code)) {
        changed.add(posId);
        break;
      }
    }
  }
  return changed;
}

export function JournalsByPositionMatrix({ positions, catalog }: Props) {
  const router = useRouter();
  const [base] = useState<Matrix>(() => toMatrix(positions));
  const [curr, setCurr] = useState<Matrix>(() => toMatrix(positions));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [catFilter, setCatFilter] = useState<"all" | "staff" | "management">(
    "all"
  );

  const q = query.trim().toLowerCase();
  const filteredCatalog = useMemo(
    () =>
      catalog.filter(
        (j) =>
          !q ||
          j.name.toLowerCase().includes(q) ||
          j.code.toLowerCase().includes(q)
      ),
    [catalog, q]
  );

  const filteredPositions = useMemo(
    () =>
      positions.filter((p) => {
        if (catFilter === "staff" && p.categoryKey !== "staff") return false;
        if (catFilter === "management" && p.categoryKey !== "management")
          return false;
        return true;
      }),
    [positions, catFilter]
  );

  const dirty = matrixDiff(base, curr);

  function toggleCell(positionId: string, code: string) {
    setCurr((prev) => {
      const copy = new Map(prev);
      const set = new Set(copy.get(positionId) ?? new Set<string>());
      if (set.has(code)) set.delete(code);
      else set.add(code);
      copy.set(positionId, set);
      return copy;
    });
  }

  function setRowAll(positionId: string, value: boolean) {
    setCurr((prev) => {
      const copy = new Map(prev);
      const set = new Set<string>();
      if (value) {
        for (const j of catalog) set.add(j.code);
      }
      copy.set(positionId, set);
      return copy;
    });
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setCurr((prev) => {
      const copy = new Map(prev);
      for (const p of positions) {
        if (preset.positionKeywords.length > 0) {
          const name = p.name.toLowerCase();
          const matched = preset.positionKeywords.some((kw) =>
            name.includes(kw)
          );
          if (!matched) continue;
        }
        const set = new Set(copy.get(p.id) ?? new Set<string>());
        for (const code of preset.templateCodes) set.add(code);
        copy.set(p.id, set);
      }
      return copy;
    });
    toast.success(`Применён пресет: ${preset.label}`);
  }

  async function save() {
    if (saving || dirty.size === 0) return;
    setSaving(true);
    try {
      let ok = 0;
      let failed = 0;
      for (const positionId of dirty) {
        const set = curr.get(positionId) ?? new Set<string>();
        const res = await fetch(
          `/api/settings/positions/${positionId}/journals`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ templateCodes: [...set] }),
          }
        );
        if (res.ok) ok += 1;
        else failed += 1;
      }
      if (failed > 0) {
        toast.error(`Сохранено ${ok}, ошибок ${failed}`);
      } else {
        toast.success(`Сохранено для ${ok} ${pluralPositions(ok)}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Presets */}
      <section className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-5">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          <Sparkles className="size-3.5 text-[#5566f6]" />
          Пресеты
        </div>
        <p className="mt-1 text-[12px] text-[#6f7282]">
          Быстро назначить пакеты журналов всем подходящим должностям.
          Совпадение по подстроке имени должности.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#dcdfed] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white p-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="relative w-full flex-1 sm:w-auto sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9fb3]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Фильтр журналов"
            className="h-10 rounded-2xl border-[#dcdfed] pl-9"
          />
        </div>
        <div className="flex gap-2">
          {([
            ["all", "Все"],
            ["management", "Руководство"],
            ["staff", "Сотрудники"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setCatFilter(k)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                catFilter === k
                  ? "border-[#5566f6] bg-[#5566f6] text-white"
                  : "border-[#dcdfed] bg-white text-[#3c4053] hover:bg-[#f5f6ff]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Matrix */}
      <section className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex items-center gap-2 border-b border-[#ececf4] p-4">
          <NetworkIcon className="size-4 text-[#5566f6]" />
          <h2 className="text-[15px] font-semibold text-[#0b1024]">
            {filteredPositions.length} {pluralPositions(filteredPositions.length)}{" "}
            · {filteredCatalog.length} журнал
            {journalSuffix(filteredCatalog.length)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#ececf4]">
                <th className="sticky left-0 z-[1] bg-white px-3 py-2 text-left font-medium text-[#6f7282]">
                  Должность
                </th>
                <th className="px-2 py-2 text-center font-medium text-[#6f7282]">
                  <span className="text-[11px]">Все / Снять</span>
                </th>
                {filteredCatalog.map((j) => (
                  <th
                    key={j.code}
                    className="px-1 py-2 text-center font-medium text-[#6f7282]"
                  >
                    <div
                      className="mx-auto max-w-[80px] truncate text-[11px] leading-tight"
                      title={j.name}
                    >
                      {j.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((p) => {
                const set = curr.get(p.id) ?? new Set<string>();
                const isEmpty = set.size === 0;
                const rowAllOn = filteredCatalog.every((j) => set.has(j.code));
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-[#ececf4] last:border-b-0",
                      dirty.has(p.id) && "bg-[#fff8eb]"
                    )}
                  >
                    <td className="sticky left-0 z-[1] min-w-[200px] bg-inherit px-3 py-2">
                      <div className="font-medium text-[#0b1024]">{p.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6f7282]">
                        <span>
                          {p.activeUsers}{" "}
                          {p.activeUsers === 1
                            ? "сотрудник"
                            : pluralUsersShort(p.activeUsers)}
                        </span>
                        <span className="text-[#c7ccea]">·</span>
                        <span>
                          {p.categoryKey === "management"
                            ? "руководство"
                            : "сотрудники"}
                        </span>
                      </div>
                      {isEmpty ? (
                        <div className="mt-0.5 text-[10px] text-[#b25f00]">
                          (back-compat: получают все журналы)
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setRowAll(p.id, !rowAllOn)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          rowAllOn
                            ? "border-[#5566f6] bg-[#5566f6] text-white"
                            : "border-[#dcdfed] bg-white text-[#3c4053] hover:bg-[#f5f6ff]"
                        )}
                      >
                        {rowAllOn ? "Снять" : "Все"}
                      </button>
                    </td>
                    {filteredCatalog.map((j) => {
                      const granted = set.has(j.code);
                      return (
                        <td key={j.code} className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => toggleCell(p.id, j.code)}
                            title={j.name}
                            className={cn(
                              "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
                              granted
                                ? "border-[#7cf5c0] bg-[#ecfdf5] text-[#136b2a]"
                                : "border-[#dcdfed] bg-white text-[#c7ccea] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                            )}
                          >
                            {granted ? <Check className="size-3.5" /> : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {filteredPositions.length === 0 ? (
                <tr>
                  <td
                    colSpan={filteredCatalog.length + 2}
                    className="px-4 py-10 text-center text-[13px] text-[#9b9fb3]"
                  >
                    Нет должностей под фильтр. Создайте их в{" "}
                    <a
                      href="/settings/staff-hierarchy"
                      className="text-[#3848c7] underline-offset-2 hover:underline"
                    >
                      Иерархии
                    </a>
                    .
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white/95 px-5 py-3 shadow-[0_12px_32px_-16px_rgba(11,16,36,0.18)] backdrop-blur">
        <div className="text-[13px] text-[#3c4053]">
          {dirty.size === 0
            ? "Изменений нет"
            : `Изменено у ${dirty.size} ${pluralPositions(dirty.size)}`}
        </div>
        <Button
          type="button"
          onClick={save}
          disabled={saving || dirty.size === 0}
          className="ml-auto h-11 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] disabled:bg-[#c8cbe0]"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Сохранить
        </Button>
      </div>
    </div>
  );
}

function pluralPositions(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "должности";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100))
    return "должностей";
  return "должностей";
}
function pluralUsersShort(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100))
    return "сотрудника";
  return "сотрудников";
}
function journalSuffix(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return "а";
  return "ов";
}
