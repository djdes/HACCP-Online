"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Save,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Position = {
  id: string;
  name: string;
  categoryKey: string;
  activeUsers: number;
  visibleUserIds: string[];
};

type Employee = {
  id: string;
  name: string;
  positionName: string | null;
  positionCategory: string | null;
};

type Props = {
  positions: Position[];
  employees: Employee[];
};

type VisibilityMap = Map<string, Set<string>>; // positionId → Set of userIds

function toMap(positions: Position[]): VisibilityMap {
  const m: VisibilityMap = new Map();
  for (const p of positions) m.set(p.id, new Set(p.visibleUserIds));
  return m;
}

function diff(base: VisibilityMap, curr: VisibilityMap): Set<string> {
  const changed = new Set<string>();
  for (const [posId, currSet] of curr.entries()) {
    const baseSet = base.get(posId) ?? new Set<string>();
    if (currSet.size !== baseSet.size) {
      changed.add(posId);
      continue;
    }
    for (const id of currSet) {
      if (!baseSet.has(id)) {
        changed.add(posId);
        break;
      }
    }
  }
  return changed;
}

const PRESETS: Array<{
  label: string;
  /** Лейбл должности по подстроке */
  positionKeywords: string[];
  /** Лейбл подчинённого по подстроке (positionName сотрудника) */
  employeePositionKeywords: string[];
}> = [
  {
    label: "Шеф → поварам",
    positionKeywords: ["шеф", "су-шеф"],
    employeePositionKeywords: ["повар", "кух"],
  },
  {
    label: "Технолог → всем кухне",
    positionKeywords: ["технолог"],
    employeePositionKeywords: ["повар", "кух", "пекар"],
  },
  {
    label: "Менеджер → всем",
    positionKeywords: ["менеджер", "управ"],
    employeePositionKeywords: [],
  },
];

export function PositionStaffVisibilityClient({ positions, employees }: Props) {
  const router = useRouter();
  const [base] = useState<VisibilityMap>(() => toMap(positions));
  const [curr, setCurr] = useState<VisibilityMap>(() => toMap(positions));
  const [query, setQuery] = useState("");
  const [posCatFilter, setPosCatFilter] = useState<
    "all" | "management" | "staff"
  >("all");
  const [empCatFilter, setEmpCatFilter] = useState<
    "all" | "management" | "staff"
  >("all");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const dirty = useMemo(() => diff(base, curr), [base, curr]);

  const q = query.trim().toLowerCase();

  const filteredPositions = useMemo(
    () =>
      positions.filter((p) => {
        if (posCatFilter !== "all" && p.categoryKey !== posCatFilter)
          return false;
        if (q && !p.name.toLowerCase().includes(q)) return false;
        return true;
      }),
    [positions, posCatFilter, q]
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (empCatFilter === "management" && e.positionCategory !== "management")
          return false;
        if (empCatFilter === "staff" && e.positionCategory !== "staff")
          return false;
        return true;
      }),
    [employees, empCatFilter]
  );

  function toggleCell(positionId: string, userId: string) {
    setCurr((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(positionId) ?? new Set<string>());
      if (set.has(userId)) set.delete(userId);
      else set.add(userId);
      next.set(positionId, set);
      return next;
    });
  }

  function setRowAll(positionId: string, value: boolean) {
    setCurr((prev) => {
      const next = new Map(prev);
      const set = new Set<string>();
      if (value) {
        for (const e of filteredEmployees) set.add(e.id);
      }
      next.set(positionId, set);
      return next;
    });
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setCurr((prev) => {
      const next = new Map(prev);
      for (const p of positions) {
        const matchPos = preset.positionKeywords.some((kw) =>
          p.name.toLowerCase().includes(kw)
        );
        if (!matchPos) continue;
        const set = new Set(next.get(p.id) ?? new Set<string>());
        for (const e of employees) {
          if (preset.employeePositionKeywords.length === 0) {
            set.add(e.id);
            continue;
          }
          const empPos = (e.positionName ?? "").toLowerCase();
          if (preset.employeePositionKeywords.some((kw) => empPos.includes(kw))) {
            set.add(e.id);
          }
        }
        next.set(p.id, set);
      }
      return next;
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
          `/api/settings/positions/${positionId}/visible-users`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: [...set] }),
          }
        );
        if (res.ok) ok += 1;
        else failed += 1;
      }
      if (failed > 0) toast.error(`Сохранено ${ok}, ошибок ${failed}`);
      else toast.success(`Сохранено для ${ok} ${pluralPos(ok)}`);
      // Auto-push в TasksFlow — пользователю не нужно жать вторую
      // кнопку. Если интеграция отключена, sync вернёт 0 — это OK.
      pushToTasksflow(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  async function pushToTasksflow(showError: boolean) {
    setSyncing(true);
    try {
      const res = await fetch(
        "/api/integrations/tasksflow/sync-hierarchy",
        { method: "POST" }
      );
      if (!res.ok && showError) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? `Sync ${res.status}`);
      } else if (res.ok) {
        const data = (await res.json()) as {
          managersUpdated: number;
          managersSkipped: number;
          errors: number;
        };
        toast.success(
          `TasksFlow обновлён: ${data.managersUpdated}${
            data.managersSkipped ? ` · пропущено ${data.managersSkipped}` : ""
          }${data.errors ? ` · ошибок ${data.errors}` : ""}`
        );
      }
    } catch {
      if (showError) toast.error("TasksFlow недоступен");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Presets + sync */}
      <section className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4 dark:border-white/10 dark:bg-white/5 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282] dark:text-white/60">
              <Sparkles className="size-3.5 text-[#5566f6]" />
              Быстрые пресеты
            </div>
            <p className="mt-1 text-[12px] text-[#6f7282] dark:text-white/60">
              Типовые связки — нажал, получил готовый scope. Можно
              докрутить вручную после.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#dcdfed] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3c4053] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] dark:border-white/15 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => pushToTasksflow(true)}
            disabled={syncing}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13px] font-medium text-[#3848c7] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-[#c4b5fd] dark:hover:bg-white/10"
          >
            {syncing ? <Loader2 className="size-4 animate-spin" /> : null}
            Применить в TasksFlow сейчас
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white p-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
        <div className="relative w-full min-w-[200px] flex-1 sm:w-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9fb3] dark:text-white/50" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Фильтр должностей"
            className="h-10 rounded-2xl border-[#dcdfed] pl-9 dark:border-white/15"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-semibold uppercase tracking-wider text-[#9b9fb3] dark:text-white/50">
            Должности:
          </span>
          {(
            [
              ["all", "Все"],
              ["management", "Руковод."],
              ["staff", "Сотруд."],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPosCatFilter(k)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                posCatFilter === k
                  ? "border-[#5566f6] bg-[#5566f6] text-white"
                  : "border-[#dcdfed] bg-white text-[#3c4053] hover:bg-[#f5f6ff] dark:border-white/15 dark:bg-white/10 dark:text-white/85 dark:hover:bg-white/15"
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-semibold uppercase tracking-wider text-[#9b9fb3] dark:text-white/50">
            Сотруд.:
          </span>
          {(
            [
              ["all", "Все"],
              ["management", "Руковод."],
              ["staff", "Сотруд."],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setEmpCatFilter(k)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                empCatFilter === k
                  ? "border-[#5566f6] bg-[#5566f6] text-white"
                  : "border-[#dcdfed] bg-white text-[#3c4053] hover:bg-[#f5f6ff] dark:border-white/15 dark:bg-white/10 dark:text-white/85 dark:hover:bg-white/15"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      {/* Matrix */}
      <section className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
        <div className="flex items-center gap-2 border-b border-[#ececf4] p-4 dark:border-white/10">
          <Users className="size-4 text-[#5566f6]" />
          <h2 className="text-[15px] font-semibold text-[#0b1024] dark:text-white">
            {filteredPositions.length}{" "}
            {pluralPos(filteredPositions.length)} ·{" "}
            {filteredEmployees.length}{" "}
            {pluralEmp(filteredEmployees.length)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#ececf4] dark:border-white/5">
                <th className="sticky left-0 z-[1] bg-white px-3 py-2 text-left font-medium text-[#6f7282] dark:bg-[#0b1024] dark:text-white/60">
                  Должность видит ↓
                </th>
                <th className="px-2 py-2 text-center font-medium text-[#6f7282] dark:text-white/60">
                  <span className="text-[11px]">Все / Снять</span>
                </th>
                {filteredEmployees.map((e) => (
                  <th
                    key={e.id}
                    className="px-1 py-2 text-center font-medium text-[#6f7282] dark:text-white/60"
                  >
                    <div
                      className="mx-auto max-w-[80px] truncate text-[11px] leading-tight"
                      title={`${e.name}${e.positionName ? " · " + e.positionName : ""}`}
                    >
                      {shortName(e.name)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPositions.map((p) => {
                const set = curr.get(p.id) ?? new Set<string>();
                const isEmpty = set.size === 0;
                const rowAllOn = filteredEmployees.every((e) => set.has(e.id));
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-[#ececf4] last:border-b-0 dark:border-white/5",
                      dirty.has(p.id) && "bg-[#fff8eb] dark:bg-amber-500/10"
                    )}
                  >
                    <td className="sticky left-0 z-[1] min-w-[180px] bg-inherit px-3 py-2">
                      <div className="font-medium text-[#0b1024] dark:text-white">
                        {p.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6f7282] dark:text-white/60">
                        <span>
                          {p.activeUsers} {pluralActive(p.activeUsers)}
                        </span>
                        <span className="text-[#c7ccea] dark:text-white/30">·</span>
                        <span>
                          {p.categoryKey === "management"
                            ? "руководство"
                            : "сотрудники"}
                        </span>
                      </div>
                      {isEmpty ? (
                        <div className="mt-0.5 text-[10px] text-[#b25f00] dark:text-amber-300/80">
                          (никого не видит — только свои задачи)
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
                            : "border-[#dcdfed] bg-white text-[#3c4053] hover:bg-[#f5f6ff] dark:border-white/15 dark:bg-white/10 dark:text-white/85 dark:hover:bg-white/15"
                        )}
                      >
                        {rowAllOn ? "Снять" : "Все"}
                      </button>
                    </td>
                    {filteredEmployees.map((e) => {
                      const granted = set.has(e.id);
                      return (
                        <td key={e.id} className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => toggleCell(p.id, e.id)}
                            title={`${e.name}${e.positionName ? " · " + e.positionName : ""}`}
                            className={cn(
                              "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
                              granted
                                ? "border-[#7cf5c0] bg-[#ecfdf5] text-[#136b2a] dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                                : "border-[#dcdfed] bg-white text-[#c7ccea] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/30 dark:hover:bg-white/10"
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
                    colSpan={filteredEmployees.length + 2}
                    className="px-4 py-12 text-center text-[13px] text-[#9b9fb3] dark:text-white/50"
                  >
                    Под фильтр не попало ни одной должности.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-3xl border border-[#ececf4] bg-white/95 px-4 py-3 shadow-[0_12px_32px_-16px_rgba(11,16,36,0.18)] backdrop-blur dark:border-white/10 dark:bg-[#0b1024]/85 dark:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.6)] sm:px-5">
        <div className="text-[13px] text-[#3c4053] dark:text-white/80">
          {dirty.size === 0
            ? "Изменений нет"
            : `Изменено: ${dirty.size} ${pluralPos(dirty.size)}`}
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

function shortName(full: string): string {
  // Сокращаем для column-header'а: «Иванов Сергей Петрович» → «Иванов С.»
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function pluralPos(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "должность";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100))
    return "должности";
  return "должностей";
}
function pluralEmp(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "сотрудник";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100))
    return "сотрудника";
  return "сотрудников";
}
function pluralActive(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "активный";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100))
    return "активных";
  return "активных";
}
