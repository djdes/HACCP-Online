"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { FillMode } from "@/lib/journal-routing";

type Position = { id: string; name: string; categoryKey: string };
type StaffUser = { id: string; name: string; jobPositionId: string | null };

type Item = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isMandatorySanpin: boolean;
  isMandatoryHaccp: boolean;
  enabled: boolean;
  fillMode: FillMode;
  defaultAssigneeId: string | null;
  allowedPositionIds: string[];
  bonusAmountKopecks: number;
};

const FILL_MODE_LABELS: Record<FillMode, { label: string; hint: string; icon: typeof Users }> = {
  "per-employee": {
    label: "Каждый сотрудник",
    hint: "Все подходящие — отдельная задача каждому",
    icon: Users,
  },
  single: {
    label: "Один исполнитель",
    hint: "Один человек заполняет за всю смену",
    icon: UserRound,
  },
  sensor: {
    label: "Датчик",
    hint: "Заполнит IoT — людям не приходит",
    icon: Wifi,
  },
};

export function JournalsSettingsClient({
  items,
  positions,
  users,
}: {
  items: Item[];
  positions: Position[];
  users: StaffUser[];
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((item) => [item.code, item.enabled]))
  );
  const [saving, setSaving] = useState(false);
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [distState, setDistState] = useState<
    Record<
      string,
      {
        fillMode: FillMode;
        defaultAssigneeId: string | null;
        allowedPositionIds: string[];
        bonusAmountKopecks: number;
      }
    >
  >(
    Object.fromEntries(
      items.map((item) => [
        item.code,
        {
          fillMode: item.fillMode,
          defaultAssigneeId: item.defaultAssigneeId,
          allowedPositionIds: item.allowedPositionIds,
          bonusAmountKopecks: item.bonusAmountKopecks,
        },
      ])
    )
  );
  const [distSavingCode, setDistSavingCode] = useState<string | null>(null);

  // Anchor-deep-link from disabled-card "Включить" buttons:
  //   /settings/journals#journal-<code>
  // Scrolls the matching card into view and flashes a ring around it so
  // the user immediately sees which switch to flip on small screens where
  // the list is long.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#journal-")) return;
    const code = hash.slice("#journal-".length);
    if (!code) return;
    const target = document.getElementById(`journal-${code}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightCode(code);
    const t = window.setTimeout(() => setHighlightCode(null), 2400);
    return () => window.clearTimeout(t);
  }, []);

  const enabledCount = useMemo(
    () => Object.values(state).filter(Boolean).length,
    [state]
  );
  const totalCount = items.length;

  const dirty = useMemo(
    () =>
      items.some((item) => state[item.code] !== item.enabled),
    [items, state]
  );

  function toggle(code: string) {
    setState((prev) => ({ ...prev, [code]: !prev[code] }));
  }

  function toggleExpanded(code: string) {
    setExpandedCode((prev) => (prev === code ? null : code));
  }

  function setItemFillMode(code: string, mode: FillMode) {
    setDistState((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        fillMode: mode,
        // sensor + per-employee режимы не используют defaultAssigneeId —
        // обнуляем чтобы не сохранять stale значение.
        defaultAssigneeId:
          mode === "single" ? prev[code].defaultAssigneeId : null,
      },
    }));
  }

  function setItemAssignee(code: string, userId: string | null) {
    setDistState((prev) => ({
      ...prev,
      [code]: { ...prev[code], defaultAssigneeId: userId },
    }));
  }

  function setItemBonus(code: string, kopecks: number) {
    const safe = Math.max(0, Math.round(kopecks));
    setDistState((prev) => ({
      ...prev,
      [code]: { ...prev[code], bonusAmountKopecks: safe },
    }));
  }

  function togglePosition(code: string, positionId: string) {
    setDistState((prev) => {
      const current = prev[code];
      const has = current.allowedPositionIds.includes(positionId);
      return {
        ...prev,
        [code]: {
          ...current,
          allowedPositionIds: has
            ? current.allowedPositionIds.filter((id) => id !== positionId)
            : [...current.allowedPositionIds, positionId],
        },
      };
    });
  }

  async function saveDistribution(code: string) {
    setDistSavingCode(code);
    try {
      const item = distState[code];
      const response = await fetch(
        `/api/settings/journals/${encodeURIComponent(code)}/distribution`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Не удалось сохранить распределение");
      }
      toast.success("Распределение обновлено");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ошибка сохранения"
      );
    } finally {
      setDistSavingCode(null);
    }
  }

  function selectAll() {
    setState(Object.fromEntries(items.map((item) => [item.code, true])));
  }
  function deselectAll() {
    setState(Object.fromEntries(items.map((item) => [item.code, false])));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const disabledCodes = items
        .filter((item) => !state[item.code])
        .map((item) => item.code);
      const response = await fetch("/api/settings/journals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledCodes }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Не удалось сохранить настройки");
      }
      toast.success(
        enabledCount === totalCount
          ? "Все журналы включены"
          : `Включено ${enabledCount} из ${totalCount} журналов`
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Dark hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Настройки
          </Link>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ClipboardList className="size-6" />
              </div>
              <div>
                <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                  Набор журналов
                </h1>
                <p className="mt-2 max-w-[560px] text-[15px] text-white/70">
                  Выберите журналы, которые ваша компания реально ведёт.
                  Отключённые не будут отображаться в дашборде и не пойдут в
                  расчёт готовности. Их всегда можно включить обратно.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              <CheckCircle2 className="size-3.5" />
              Включено: {enabledCount} / {totalCount}
            </div>
          </div>
        </div>
      </section>

      {/* Bulk toggles + save */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            <Eye className="size-4 text-[#5566f6]" />
            Включить все
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#d2453d]/40 hover:bg-[#fff4f2]"
          >
            <EyeOff className="size-4 text-[#d2453d]" />
            Отключить все
          </button>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-11 w-full rounded-2xl bg-[#5566f6] px-5 text-[15px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
        >
          <Save className="size-4" />
          {saving ? "Сохраняю…" : dirty ? "Сохранить" : "Сохранено"}
        </Button>
      </div>

      {/* Items grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const enabled = state[item.code];
          const isHighlighted = highlightCode === item.code;
          const isExpanded = expandedCode === item.code;
          const dist = distState[item.code];
          const ModeIcon = FILL_MODE_LABELS[dist.fillMode].icon;
          return (
            <div
              key={item.code}
              id={`journal-${item.code}`}
              className={`flex h-full flex-col scroll-mt-24 rounded-2xl border bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:shadow-[0_8px_24px_-12px_rgba(85,102,246,0.18)] ${
                enabled
                  ? "border-[#ececf4] hover:border-[#d6d9ee]"
                  : "border-[#ececf4] opacity-60 hover:opacity-90"
              } ${
                isHighlighted
                  ? "ring-2 ring-[#5566f6] ring-offset-2 ring-offset-white"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(item.code)}
                className="flex items-start gap-4 px-5 py-5 text-left"
              >
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggle(item.code)}
                  className="mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-snug text-[#0b1024]">
                    {item.name}
                  </div>
                  {item.description ? (
                    <div className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#6f7282]">
                      {item.description}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {item.isMandatorySanpin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4f2] px-2 py-0.5 text-[11px] font-medium text-[#d2453d]">
                        <ShieldCheck className="size-3" />
                        СанПиН
                      </span>
                    ) : null}
                    {item.isMandatoryHaccp ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1ff] px-2 py-0.5 text-[11px] font-medium text-[#5566f6]">
                        <ShieldAlert className="size-3" />
                        ХАССП
                      </span>
                    ) : null}
                    <span className="ml-auto rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#9b9fb3]">
                      {item.code}
                    </span>
                  </div>
                </div>
              </button>

              {/* Distribution settings — раскрывается по кнопке */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(item.code);
                }}
                className="mx-5 mb-3 inline-flex items-center justify-between gap-2 rounded-xl border border-[#ececf4] bg-[#fafbff] px-3 py-2 text-[12px] font-medium text-[#3848c7] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
              >
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="size-3.5" />
                  <span className="font-semibold">Распределение:</span>
                  <ModeIcon className="size-3.5" />
                  {FILL_MODE_LABELS[dist.fillMode].label}
                  {dist.bonusAmountKopecks > 0 ? (
                    <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-medium text-[#116b2a]">
                      +{(dist.bonusAmountKopecks / 100).toFixed(0)} ₽
                    </span>
                  ) : null}
                </span>
                {isExpanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>

              <Link
                href={`/settings/journals/${item.code}/scope`}
                onClick={(e) => e.stopPropagation()}
                className="mx-5 mb-3 inline-flex items-center justify-between gap-2 rounded-xl border border-[#ececf4] bg-[#fafbff] px-3 py-2 text-[12px] font-medium text-[#3848c7] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
              >
                <span className="inline-flex items-center gap-2">
                  <ClipboardList className="size-3.5" />
                  <span className="font-semibold">Тип задачи и кнопки</span>
                  <span className="text-[#6f7282]">— настроить</span>
                </span>
                <span className="text-[10px] text-[#9b9fb3]">→</span>
              </Link>

              {isExpanded ? (
                <DistributionEditor
                  item={item}
                  dist={dist}
                  positions={positions}
                  users={users}
                  onModeChange={(mode) => setItemFillMode(item.code, mode)}
                  onAssigneeChange={(id) =>
                    setItemAssignee(item.code, id)
                  }
                  onPositionToggle={(id) =>
                    togglePosition(item.code, id)
                  }
                  onBonusChange={(rub) =>
                    setItemBonus(item.code, Math.round(rub * 100))
                  }
                  onSave={() => saveDistribution(item.code)}
                  saving={distSavingCode === item.code}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DistributionEditor({
  item,
  dist,
  positions,
  users,
  onModeChange,
  onAssigneeChange,
  onPositionToggle,
  onBonusChange,
  onSave,
  saving,
}: {
  item: Item;
  dist: {
    fillMode: FillMode;
    defaultAssigneeId: string | null;
    allowedPositionIds: string[];
    bonusAmountKopecks: number;
  };
  positions: Position[];
  users: StaffUser[];
  onModeChange: (mode: FillMode) => void;
  onAssigneeChange: (id: string | null) => void;
  onPositionToggle: (id: string) => void;
  /// rub — значение в рублях из инпута; преобразуется в копейки в state.
  onBonusChange: (rub: number) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const dirty =
    dist.fillMode !== item.fillMode ||
    dist.defaultAssigneeId !== item.defaultAssigneeId ||
    dist.bonusAmountKopecks !== item.bonusAmountKopecks ||
    dist.allowedPositionIds.slice().sort().join(",") !==
      item.allowedPositionIds.slice().sort().join(",");
  const bonusRub = (dist.bonusAmountKopecks / 100).toFixed(2);

  // Фильтруем сотрудников по white-list-у должностей если он задан —
  // в селекте «исполнитель по умолчанию» показываем только тех, кто
  // в принципе eligible.
  const eligibleUsers =
    dist.allowedPositionIds.length === 0
      ? users
      : users.filter(
          (u) => u.jobPositionId && dist.allowedPositionIds.includes(u.jobPositionId)
        );

  return (
    <div className="border-t border-[#ececf4] bg-[#fafbff] px-5 py-4 text-[13px]">
      {/* Fill mode selector */}
      <div className="mb-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
          Режим распределения
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {(Object.keys(FILL_MODE_LABELS) as FillMode[]).map((mode) => {
            const meta = FILL_MODE_LABELS[mode];
            const Icon = meta.icon;
            const active = dist.fillMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[#5566f6] bg-[#eef1ff]"
                    : "border-[#ececf4] bg-white hover:border-[#dcdfed]"
                }`}
              >
                <Icon
                  className={`mt-0.5 size-4 shrink-0 ${
                    active ? "text-[#5566f6]" : "text-[#6f7282]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[13px] font-medium ${
                      active ? "text-[#3848c7]" : "text-[#0b1024]"
                    }`}
                  >
                    {meta.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#6f7282]">
                    {meta.hint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Default assignee — только для single */}
      {dist.fillMode === "single" ? (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
            Исполнитель по умолчанию
          </div>
          <select
            value={dist.defaultAssigneeId ?? ""}
            onChange={(e) =>
              onAssigneeChange(e.target.value === "" ? null : e.target.value)
            }
            className="h-9 w-full rounded-lg border border-[#dcdfed] bg-white px-3 text-[13px] text-[#0b1024]"
          >
            <option value="">— Авто (round-robin) —</option>
            {eligibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-[#9b9fb3]">
            Если не указан — система чередует подходящих сотрудников
            по последним 7 дням.
          </div>
        </div>
      ) : null}

      {/* Position whitelist — для всех режимов кроме sensor */}
      {dist.fillMode !== "sensor" ? (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
            Кому можно отправлять
          </div>
          {positions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#dcdfed] bg-white px-3 py-2 text-[12px] text-[#6f7282]">
              Должности ещё не созданы. Добавьте на странице «Сотрудники».
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {positions.map((pos) => {
                const checked = dist.allowedPositionIds.includes(pos.id);
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => onPositionToggle(pos.id)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                      checked
                        ? "border-[#5566f6] bg-[#eef1ff] text-[#3848c7]"
                        : "border-[#ececf4] bg-white text-[#6f7282] hover:border-[#dcdfed]"
                    }`}
                  >
                    {pos.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-1 text-[11px] text-[#9b9fb3]">
            Пусто — разрешено всем должностям.
          </div>
        </div>
      ) : null}

      {/* Bonus — для всех режимов кроме sensor */}
      {dist.fillMode !== "sensor" ? (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
            Премия за выполнение
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={bonusRub}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                onBonusChange(Number.isFinite(parsed) ? parsed : 0);
              }}
              className="h-9 w-28 rounded-lg border border-[#dcdfed] bg-white px-3 text-[13px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none"
            />
            <span className="text-[13px] text-[#6f7282]">₽</span>
            {dist.bonusAmountKopecks > 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-medium text-[#116b2a]">
                Премиальный журнал
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11px] text-[#9b9fb3]">
            0 ₽ — обычное обязательство. Если &gt; 0 — у сотрудника
            появится кнопка «Взять с бонусом» с фото-доказательством;
            бонус начисляется первому, кто выполнил.
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#5566f6] px-4 text-[13px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(85,102,246,0.6)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {saving ? "Сохраняю…" : dirty ? "Сохранить" : "Сохранено"}
        </button>
      </div>
    </div>
  );
}
