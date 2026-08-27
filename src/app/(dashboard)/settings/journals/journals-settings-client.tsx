"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  ExternalLink,
  EyeOff,
  Printer,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { FillMode } from "@/lib/journal-routing";
import { ORG_SPHERES, sphereLabel, type OrgSphere } from "@/lib/org-profile";
import {
  paperJournalsFor,
  requiredCodesFor,
  rulesFor,
} from "@/lib/sphere-journal-rules";

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
  sphere,
}: {
  items: Item[];
  positions: Position[];
  users: StaffUser[];
  sphere: OrgSphere;
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
  // Сфера в селекте живёт отдельно от сохранённой: пока человек не
  // подтвердил смену, показываем прогноз, а не переписываем набор.
  const [sphereDraft, setSphereDraft] = useState<OrgSphere>(sphere);
  const [sphereConfirmOpen, setSphereConfirmOpen] = useState(false);
  const [switchingSphere, setSwitchingSphere] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [disableRestConfirmOpen, setDisableRestConfirmOpen] = useState(false);
  /** Код обязательного журнала, который пытаются выключить. */
  const [requiredOffCode, setRequiredOffCode] = useState<string | null>(null);

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

  function forceToggle(code: string) {
    setState((prev) => ({ ...prev, [code]: !prev[code] }));
  }

  function toggle(code: string) {
    // Выключение обязательного журнала — через подтверждение: человек
    // должен увидеть, чем это грозит на проверке. Условные («нужен при
    // наличии фритюра») выключаются молча: оборудования может не быть.
    const rule = requiredMap.get(code);
    if (rule && !rule.condition && state[code]) {
      setRequiredOffCode(code);
      return;
    }
    forceToggle(code);
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

  function renderCard(item: Item) {
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
    )
  }

  // Группы: обязательные по сфере, рекомендованные, всё остальное.
  // Порядок внутри группы — как в каталоге, чтобы список не «прыгал»
  // при переключении тумблеров.
  const rules = rulesFor(sphere);
  const requiredMap = useMemo(
    () => new Map(rules.electronicRequired.map((rule) => [rule.code, rule])),
    [rules],
  );
  const recommendedSet = useMemo(
    () => new Set(rules.electronicRecommended),
    [rules],
  );
  const groups = useMemo(() => {
    const required: Item[] = [];
    const recommended: Item[] = [];
    const rest: Item[] = [];
    for (const item of items) {
      if (requiredMap.has(item.code)) required.push(item);
      else if (recommendedSet.has(item.code)) recommended.push(item);
      else rest.push(item);
    }
    return { required, recommended, rest };
  }, [items, requiredMap, recommendedSet]);

  const paperJournals = useMemo(() => paperJournalsFor(sphere), [sphere]);

  /** Сколько журналов включим/выключим, если применить набор сферы. */
  function diffFor(nextSphere: OrgSphere) {
    const nextRequired = new Set(requiredCodesFor(nextSphere));
    let willEnable = 0;
    let willDisable = 0;
    let manual = 0;
    for (const item of items) {
      const on = state[item.code];
      if (nextRequired.has(item.code)) {
        if (!on) willEnable += 1;
      } else if (on) {
        // Ручные включения вне обязательного набора сохраняем — человек
        // сам их поставил, наш пересчёт не должен их сносить.
        manual += 1;
      }
      if (requiredMap.has(item.code) && !nextRequired.has(item.code) && on) {
        willDisable += 1;
      }
    }
    return { willEnable, willDisable, manual };
  }

  function applyRequired(nextSphere: OrgSphere) {
    const nextRequired = new Set(requiredCodesFor(nextSphere));
    setState((prev) => {
      const next = { ...prev };
      for (const code of nextRequired) next[code] = true;
      return next;
    });
  }

  async function confirmSphereChange() {
    const next = sphereDraft;
    setSwitchingSphere(true);
    try {
      const response = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Не удалось сменить сферу");
      }
      applyRequired(next);
      toast.success(`Сфера: ${sphereLabel(next)}. Не забудьте сохранить набор.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
      setSphereDraft(sphere);
    } finally {
      setSwitchingSphere(false);
      setSphereConfirmOpen(false);
    }
  }

  const sphereDiff = diffFor(sphereDraft);

  return (
    <div className="space-y-6">
      {/* Шапка страницы настроек — карточка, а не тёмный hero: hero здесь
          занимал экран и ничего не сообщал, кроме счётчика. */}
      <section className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0b1024]">
                  Набор журналов
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[12px] font-medium text-[#5566f6]">
                  <CheckCircle2 className="size-3.5" />
                  Включено {enabledCount} из {totalCount}
                </span>
              </div>
              <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-[#6f7282]">
                {rules.intro}{" "}
                <a
                  href={rules.introLaw.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#5566f6] hover:underline"
                >
                  {rules.introLaw.label}
                  <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
          </div>

          <div className="w-full sm:w-[280px]">
            <label className="mb-1.5 block text-[13px] font-medium text-[#3c4053]">
              Сфера деятельности
            </label>
            <span className="relative block">
              <select
                value={sphereDraft}
                onChange={(e) => setSphereDraft(e.target.value as OrgSphere)}
                className="h-11 w-full appearance-none rounded-2xl border border-[#dcdfed] bg-white pl-4 pr-10 text-[15px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
              >
                {ORG_SPHERES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b9fb3]" />
            </span>
            {sphereDraft !== sphere ? (
              <div className="mt-2 rounded-xl bg-[#f5f6ff] p-2.5 text-[12px] leading-relaxed text-[#3c4053]">
                Включим: {sphereDiff.willEnable} · Выключим:{" "}
                {sphereDiff.willDisable} · Ваши ручные останутся:{" "}
                {sphereDiff.manual}
                <button
                  type="button"
                  onClick={() => setSphereConfirmOpen(true)}
                  className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#5566f6] text-[13px] font-medium text-white transition-colors hover:bg-[#4a5bf0]"
                >
                  Сменить сферу
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setApplyConfirmOpen(true)}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
              >
                <ShieldCheck className="size-4 text-[#5566f6]" />
                Включить обязательные
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
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

      <GroupHeading
        title="Обязательные электронные"
        hint="Роспотребнадзор"
        count={groups.required.length}
        tone="required"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.required.map((item) => renderCard(item))}
      </div>

      {groups.recommended.length > 0 ? (
        <>
          <GroupHeading
            title={`Рекомендуем для сферы «${sphereLabel(sphere)}»`}
            count={groups.recommended.length}
            tone="recommended"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.recommended.map((item) => renderCard(item))}
          </div>
        </>
      ) : null}

      <details className="group rounded-2xl border border-[#ececf4] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <span className="text-[15px] font-semibold text-[#0b1024]">
            Остальные журналы
            <span className="ml-2 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[12px] font-medium text-[#6f7282]">
              {groups.rest.length}
            </span>
          </span>
          <ChevronDown className="size-4 text-[#9b9fb3] transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-[#eef0f6] p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.rest.map((item) => renderCard(item))}
          </div>
          <button
            type="button"
            onClick={() => setDisableRestConfirmOpen(true)}
            className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-[#6f7282] transition-colors hover:text-[#d2453d]"
          >
            <EyeOff className="size-4" />
            Отключить все, кроме обязательных
          </button>
        </div>
      </details>

      <section id="paper" className="scroll-mt-24 space-y-3">
        <GroupHeading
          title="Обязательные бумажные"
          hint="электронная форма не принимается"
          count={paperJournals.length}
          tone="paper"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {paperJournals.map((journal) => (
            <div
              key={journal.id}
              className="flex h-full flex-col rounded-2xl border border-[#ffd9d0] bg-[#fff8f6] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#fff4f2] text-[#a13a32]">
                  <Printer className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-snug text-[#0b1024]">
                    {journal.name}
                  </div>
                  <span className="mt-1.5 inline-flex items-center rounded-full bg-[#fff4f2] px-2 py-0.5 text-[11px] font-medium text-[#a13a32]">
                    Только на бумаге
                  </span>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#6f7282]">
                    {journal.why} Штраф {journal.fineHint}.
                  </p>
                  <a
                    href={journal.law.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-[#5566f6] hover:underline"
                  >
                    {journal.law.label}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`/api/settings/journals/paper/${journal.id}/pdf`}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                >
                  <Download className="size-3.5 text-[#5566f6]" />
                  Скачать бланк
                </a>
                <Link
                  href={`/settings/journals/paper/${journal.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#4a5bf0]"
                >
                  <Printer className="size-3.5" />
                  Заполнить и распечатать
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={requiredOffCode !== null}
        onClose={() => setRequiredOffCode(null)}
        onConfirm={() => {
          if (requiredOffCode) forceToggle(requiredOffCode);
          setRequiredOffCode(null);
        }}
        variant="warn"
        title={`Выключить обязательный журнал?`}
        description={`Журнал обязателен для сферы «${sphereLabel(sphere)}».`}
        bullets={[
          { label: "Исчезнет из дашборда и из задач сотрудникам", tone: "warn" },
          { label: "Перестанет учитываться в готовности", tone: "default" },
          { label: `Проверка Роспотребнадзора — ${rules.introLaw.label}, до 50 000 ₽`, tone: "warn" },
        ]}
        confirmLabel="Всё равно выключить"
      />

      <ConfirmDialog
        open={sphereConfirmOpen}
        onClose={() => {
          setSphereConfirmOpen(false);
          setSphereDraft(sphere);
        }}
        onConfirm={confirmSphereChange}
        variant="info"
        title={`Сменить сферу на «${sphereLabel(sphereDraft)}»?`}
        description="Пересчитаем обязательный набор журналов. Всё, что вы включили руками, останется."
        bullets={[
          { label: `Включим: ${sphereDiff.willEnable}`, tone: "info" },
          { label: `Выключим: ${sphereDiff.willDisable}`, tone: "default" },
          { label: `Ваши ручные останутся: ${sphereDiff.manual}`, tone: "default" },
        ]}
        confirmLabel={switchingSphere ? "Меняю…" : "Сменить"}
      />

      <ConfirmDialog
        open={applyConfirmOpen}
        onClose={() => setApplyConfirmOpen(false)}
        onConfirm={() => {
          applyRequired(sphere);
          setApplyConfirmOpen(false);
        }}
        variant="info"
        title="Включить обязательные журналы?"
        description={`Минимум для сферы «${sphereLabel(sphere)}». Остальное не трогаем.`}
        bullets={[{ label: `Включим: ${diffFor(sphere).willEnable}`, tone: "info" }]}
        confirmLabel="Включить"
      />

      <ConfirmDialog
        open={disableRestConfirmOpen}
        onClose={() => setDisableRestConfirmOpen(false)}
        onConfirm={() => {
          setState(
            Object.fromEntries(
              items.map((item) => [item.code, requiredMap.has(item.code)]),
            ),
          );
          setDisableRestConfirmOpen(false);
        }}
        variant="warn"
        title="Отключить все, кроме обязательных?"
        description="Останется только минимум для вашей сферы."
        bullets={[
          { label: "Отключённые журналы исчезнут из дашборда", tone: "warn" },
          { label: "Записи останутся в архиве — ничего не удаляем", tone: "default" },
        ]}
        confirmLabel="Отключить"
      />
    </div>
  );
}

function GroupHeading({
  title,
  hint,
  count,
  tone,
}: {
  title: string;
  hint?: string;
  count: number;
  tone: "required" | "recommended" | "paper";
}) {
  const dot =
    tone === "required"
      ? "bg-[#5566f6]"
      : tone === "paper"
        ? "bg-[#d2453d]"
        : "bg-[#9b9fb3]";
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      <h2 className="text-[15px] font-semibold text-[#0b1024]">{title}</h2>
      {hint ? <span className="text-[13px] text-[#9b9fb3]">· {hint}</span> : null}
      <span className="rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[12px] font-medium text-[#6f7282]">
        {count}
      </span>
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
