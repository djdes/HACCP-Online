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
  Trash2,
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
import { getSchemaForJournal } from "@/lib/journal-responsible-schemas";

type Position = {
  id: string;
  name: string;
  categoryKey: string;
  activeUsers: number;
};

type UserItem = {
  id: string;
  name: string;
  jobPositionId: string | null;
};

type SlotUserMap = Record<string, string | null>;

type Journal = {
  code: string;
  name: string;
  description: string | null;
  initialPositionIds: string[];
  initialSlotUsers: SlotUserMap;
};

type Props = {
  positions: Position[];
  users: UserItem[];
  journals: Journal[];
};

type Selection = {
  positions: Map<string, Set<string>>; // code -> positionIds
  slots: Map<string, SlotUserMap>; // code -> { slotId: userId }
};

function toSelection(journals: Journal[]): Selection {
  const positions = new Map<string, Set<string>>();
  const slots = new Map<string, SlotUserMap>();
  for (const j of journals) {
    positions.set(j.code, new Set(j.initialPositionIds));
    slots.set(j.code, { ...j.initialSlotUsers });
  }
  return { positions, slots };
}

function slotMapsEqual(a: SlotUserMap, b: SlotUserMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? null) !== (b[k] ?? null)) return false;
  }
  return true;
}

function diff(base: Selection, curr: Selection): Set<string> {
  const changed = new Set<string>();
  for (const [code, set] of curr.positions.entries()) {
    const baseSet = base.positions.get(code) ?? new Set<string>();
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
  for (const [code, slotMap] of curr.slots.entries()) {
    if (!slotMapsEqual(base.slots.get(code) ?? {}, slotMap)) {
      changed.add(code);
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

export function JournalResponsiblesClient({
  positions,
  users,
  journals,
}: Props) {
  const router = useRouter();
  const [base, setBase] = useState<Selection>(() => toSelection(journals));
  const [curr, setCurr] = useState<Selection>(() => toSelection(journals));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyingCategory, setApplyingCategory] = useState<JournalCategory | null>(
    null
  );
  const [resyncing, setResyncing] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<JournalCategory>>(
    () => new Set()
  );

  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
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
  }, [journals]);

  const dirty = diff(base, curr);

  const positionsById = useMemo(
    () => new Map(positions.map((p) => [p.id, p])),
    [positions]
  );

  /**
   * Сотрудники для конкретного слота: фильтр по выбранным должностям +
   * по slot.positionKeywords (если заданы). Если ничего не подошло — всех.
   * Исключаем ids, которые уже взяты другими слотами этого же журнала.
   */
  function eligibleUsersForSlot(
    journalCode: string,
    slotId: string
  ): UserItem[] {
    const schema = getSchemaForJournal(journalCode);
    const slot = schema.slots.find((s) => s.id === slotId);
    const positionSet = curr.positions.get(journalCode);
    const slotMap = curr.slots.get(journalCode) ?? {};
    const usedIds = new Set(
      Object.entries(slotMap)
        .filter(([sid, uid]) => sid !== slotId && uid)
        .map(([, uid]) => uid as string)
    );

    let pool = users;
    if (positionSet && positionSet.size > 0) {
      pool = pool.filter(
        (u) => u.jobPositionId && positionSet.has(u.jobPositionId)
      );
    }
    if (slot?.positionKeywords && slot.positionKeywords.length > 0) {
      const positionsById = new Map(positions.map((p) => [p.id, p]));
      const filtered = pool.filter((u) => {
        if (!u.jobPositionId) return false;
        const pos = positionsById.get(u.jobPositionId);
        if (!pos) return false;
        const lower = pos.name.toLowerCase();
        return slot.positionKeywords!.some((kw) => lower.includes(kw));
      });
      // Если по keywords никого нет — даём весь pool, не оставляем
      // юзера с пустым select'ом.
      if (filtered.length > 0) pool = filtered;
    }
    return [...pool]
      .filter((u) => !usedIds.has(u.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }

  /**
   * Авто-подбор слотов на стороне клиента — для UI feedback после
   * presets. Сервер делает то же независимо. Алгоритм: пробегаем по
   * слотам, для каждого ищем подходящего без дубликатов.
   */
  function pickSlotUsersForJournal(
    journalCode: string,
    positionIds: Set<string>
  ): SlotUserMap {
    const schema = getSchemaForJournal(journalCode);
    const positionsById = new Map(positions.map((p) => [p.id, p]));
    const result: SlotUserMap = {};
    const usedIds = new Set<string>();
    for (const slot of schema.slots) {
      let pool = users;
      if (positionIds.size > 0) {
        pool = pool.filter(
          (u) => u.jobPositionId && positionIds.has(u.jobPositionId)
        );
      }
      if (slot.positionKeywords && slot.positionKeywords.length > 0) {
        const filtered = pool.filter((u) => {
          if (!u.jobPositionId) return false;
          const pos = positionsById.get(u.jobPositionId);
          if (!pos) return false;
          const lower = pos.name.toLowerCase();
          return slot.positionKeywords!.some((kw) => lower.includes(kw));
        });
        if (filtered.length > 0) pool = filtered;
      }
      const sorted = [...pool].sort((a, b) =>
        a.name.localeCompare(b.name, "ru")
      );
      const pick = sorted.find((u) => !usedIds.has(u.id));
      if (pick) {
        result[slot.id] = pick.id;
        usedIds.add(pick.id);
      } else {
        result[slot.id] = null;
      }
    }
    return result;
  }

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
      const positions = new Map(prev.positions);
      const set = new Set(positions.get(code) ?? new Set<string>());
      if (set.has(positionId)) set.delete(positionId);
      else set.add(positionId);
      positions.set(code, set);

      // Если кто-то из текущих slot users не помещается в новые
      // должности — снимаем его. Сервер при сохранении подберёт нового.
      const slots = new Map(prev.slots);
      const slotMap = { ...(slots.get(code) ?? {}) };
      let mutated = false;
      for (const [slotId, userId] of Object.entries(slotMap)) {
        if (!userId) continue;
        const u = usersById.get(userId);
        if (
          set.size > 0 &&
          (!u?.jobPositionId || !set.has(u.jobPositionId))
        ) {
          slotMap[slotId] = null;
          mutated = true;
        }
      }
      if (mutated) slots.set(code, slotMap);
      return { positions, slots };
    });
  }

  function setSlotUser(code: string, slotId: string, userId: string | null) {
    setCurr((prev) => {
      const slots = new Map(prev.slots);
      const slotMap = { ...(slots.get(code) ?? {}) };
      slotMap[slotId] = userId;
      slots.set(code, slotMap);
      return { positions: prev.positions, slots };
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
    const matchedSet = new Set(matchedIds);
    const slotMap = pickSlotUsersForJournal(code, matchedSet);
    setCurr((prev) => {
      const positions = new Map(prev.positions);
      const slots = new Map(prev.slots);
      positions.set(code, matchedSet);
      slots.set(code, slotMap);
      return { positions, slots };
    });
    const filledSlots = Object.values(slotMap).filter(Boolean).length;
    toast.success(
      filledSlots > 0
        ? `${meta.code} ← ${matchedIds.length} должн., ${filledSlots} ответственн.`
        : `${meta.code} ← ${matchedIds.length} должн. (нет подходящих сотрудников)`
    );
  }

  type Assignment = {
    positionIds: Set<string>;
    slotUsers: SlotUserMap;
  };

  function computeAssignmentsFor(
    codes: readonly string[]
  ): Map<string, Assignment> {
    const result = new Map<string, Assignment>();
    for (const code of codes) {
      const matched = matchPositionsForJournal(code, positions);
      if (matched.length === 0) continue;
      const positionSet = new Set(matched);
      result.set(code, {
        positionIds: positionSet,
        slotUsers: pickSlotUsersForJournal(code, positionSet),
      });
    }
    return result;
  }

  async function persistAssignments(
    assignments: Map<string, Assignment>
  ): Promise<{ ok: number; failed: number }> {
    let ok = 0;
    let failed = 0;
    const successful = new Map<string, Assignment>();
    for (const [code, a] of assignments) {
      try {
        const res = await fetch(
          `/api/settings/journal-responsibles/${code}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              positionIds: [...a.positionIds],
              slotUsers: a.slotUsers,
            }),
          }
        );
        if (res.ok) {
          ok += 1;
          // Сервер мог авто-подобрать недостающие slot users.
          const data = await res.json().catch(() => null);
          const serverSlots = (data?.slotUsers ?? a.slotUsers) as SlotUserMap;
          successful.set(code, {
            positionIds: a.positionIds,
            slotUsers: serverSlots,
          });
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
    if (successful.size > 0) {
      const updateBoth = (prev: Selection): Selection => {
        const positions = new Map(prev.positions);
        const slots = new Map(prev.slots);
        for (const [code, a] of successful) {
          positions.set(code, new Set(a.positionIds));
          slots.set(code, { ...a.slotUsers });
        }
        return { positions, slots };
      };
      setCurr(updateBoth);
      setBase(updateBoth);
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
      const dirtyAssignments = new Map<string, Assignment>();
      for (const code of dirty) {
        dirtyAssignments.set(code, {
          positionIds: curr.positions.get(code) ?? new Set<string>(),
          slotUsers: curr.slots.get(code) ?? {},
        });
      }
      const { ok, failed } = await persistAssignments(dirtyAssignments);
      if (failed > 0) {
        toast.error(
          `Сохранено: ${ok}, не удалось: ${failed}. Попробуйте ещё раз.`
        );
      } else {
        toast.success(`Сохранено · журналов: ${ok}`);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setCurr({
      positions: new Map(
        [...base.positions].map(([k, v]) => [k, new Set(v)])
      ),
      slots: new Map(
        [...base.slots].map(([k, v]) => [k, { ...v }])
      ),
    });
  }

  async function resyncAll() {
    if (resyncing) return;
    setResyncing(true);
    try {
      const res = await fetch(
        "/api/settings/journal-responsibles/resync-all",
        { method: "POST" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка resync");
        return;
      }
      toast.success(
        `Перезаписано документов: ${data?.documentsUpdated ?? 0} (${data?.journalsProcessed ?? 0} журналов)`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setResyncing(false);
    }
  }

  async function deleteAllDocuments() {
    if (deleting) return;
    // Preflight — узнаём сколько ИМЕННО удалится, показываем в
    // prompt. Менеджер видит «удалится 33 документа, 1290 записей»
    // и думает дважды, прежде чем напечатать «УДАЛИТЬ».
    let counts: { docCount: number; entryCount: number } | null = null;
    try {
      const res = await fetch(
        "/api/settings/journals/delete-all-documents",
        { method: "GET" }
      );
      if (res.ok) counts = await res.json();
    } catch {
      /* preflight не критичен — продолжаем без счётчика */
    }
    const sizeHint = counts
      ? `\n\nСейчас в БД: ${counts.docCount} документ(ов), ${counts.entryCount} запис(ей).`
      : "";
    const phrase = window.prompt(
      "ВНИМАНИЕ: эта операция удалит ВСЕ документы журналов организации " +
        "вместе с заполненными записями. Восстановить нельзя." +
        sizeHint +
        "\n\nЧтобы продолжить, введите слово «УДАЛИТЬ» (заглавными):"
    );
    if (phrase !== "УДАЛИТЬ") {
      if (phrase !== null) {
        toast.error("Подтверждение не совпало — отменено");
      }
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(
        "/api/settings/journals/delete-all-documents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: "УДАЛИТЬ" }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка удаления");
        return;
      }
      toast.success(
        `Удалено документов: ${data?.deletedDocuments ?? 0}` +
          (data?.deletedEntries
            ? `, записей: ${data.deletedEntries}`
            : "")
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setDeleting(false);
    }
  }

  async function recreateDocuments() {
    if (recreating) return;
    if (
      !window.confirm(
        "«Пересоздать документы» закроет все ТЕКУЩИЕ активные документы и " +
          "создаст свежие — с дефолтными строками и подтянутыми из настроек " +
          "ответственными. Заполненные ранее записи останутся в закрытых " +
          "документах (можно открыть для отчёта).\n\nПродолжить?"
      )
    )
      return;
    setRecreating(true);
    try {
      const res = await fetch(
        "/api/settings/journal-responsibles/recreate-documents",
        { method: "POST" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка пересоздания");
        return;
      }
      toast.success(
        `Закрыто: ${data?.closed ?? 0}, создано новых: ${data?.created ?? 0}` +
          (data?.errorsTotal ? `, ошибок: ${data.errorsTotal}` : "")
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setRecreating(false);
    }
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

        <button
          type="button"
          onClick={resyncAll}
          disabled={resyncing || recreating}
          title="Перезаписать ФИО ответственных в шапке всех активных документов на текущие из настроек. Полезно если документы создавались до изменений."
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13px] font-medium text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resyncing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4 text-[#5566f6]" />
          )}
          Перезаписать в документах
        </button>

        <button
          type="button"
          onClick={recreateDocuments}
          disabled={recreating || resyncing || deleting}
          title="Закрыть все активные документы и создать свежие со строками по умолчанию и текущими ответственными. Старые записи сохранятся в закрытых документах."
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ffd2cd] bg-white px-4 text-[13px] font-medium text-[#a13a32] hover:border-[#a13a32]/50 hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {recreating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          Пересоздать документы
        </button>

        <button
          type="button"
          onClick={deleteAllDocuments}
          disabled={deleting || recreating || resyncing}
          title="Опасно: удалит ВСЕ документы журналов вместе с заполненными записями. Используется только для полного сброса."
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#a13a32] px-4 text-[13px] font-medium text-white hover:bg-[#8b3128] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Удалить все документы
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
                    const set = curr.positions.get(j.code) ?? new Set<string>();
                    const slotMap = curr.slots.get(j.code) ?? {};
                    const isDirty = dirty.has(j.code);
                    const meta = j.meta;
                    const schema = getSchemaForJournal(j.code);
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

                        {/* Slot pickers — по одному на каждый «слот»
                            ответственного из schema этого журнала.
                            Например, у бракеража готовой продукции 3
                            слота (комиссия), у уборки 2, у большинства 1. */}
                        <div className="mt-3 space-y-2">
                          {schema.slots.map((slot, slotIdx) => {
                            const userId = slotMap[slot.id] ?? null;
                            const eligibleForSlot = eligibleUsersForSlot(
                              j.code,
                              slot.id
                            );
                            // Сюда добавляем текущего юзера, если он не
                            // в pool (например, изменили должности и он
                            // выпал из фильтра — пусть всё равно покажется
                            // как «выбран», чтобы юзер не запутался).
                            const showCurrent = userId
                              ? !eligibleForSlot.find((u) => u.id === userId) &&
                                usersById.get(userId)
                              : null;
                            return (
                              <div
                                key={slot.id}
                                className="flex flex-wrap items-start gap-2 rounded-xl border border-[#ececf4] bg-[#fafbff] px-3 py-2.5"
                              >
                                <div className="flex min-w-[180px] flex-col">
                                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#3c4053]">
                                    <span className="flex size-5 items-center justify-center rounded-full bg-[#eef1ff] text-[10px] font-semibold text-[#3848c7]">
                                      {slotIdx + 1}
                                    </span>
                                    {slot.label}
                                    {slot.primary ? (
                                      <span className="rounded-full bg-[#fff8eb] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#a13a32]">
                                        primary
                                      </span>
                                    ) : null}
                                  </div>
                                  {slot.hint ? (
                                    <div className="mt-0.5 text-[11px] leading-snug text-[#9b9fb3]">
                                      {slot.hint}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                  <select
                                    value={userId ?? ""}
                                    onChange={(e) =>
                                      setSlotUser(
                                        j.code,
                                        slot.id,
                                        e.target.value || null
                                      )
                                    }
                                    disabled={
                                      eligibleForSlot.length === 0 && !showCurrent
                                    }
                                    className="w-full rounded-lg border border-[#dcdfed] bg-white px-2.5 py-1.5 text-[12px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-2 focus:ring-[#5566f6]/15 disabled:opacity-60"
                                  >
                                    <option value="">— не выбран —</option>
                                    {showCurrent ? (
                                      <option value={userId ?? ""}>
                                        {showCurrent.name} (вне фильтра)
                                      </option>
                                    ) : null}
                                    {eligibleForSlot.map((u) => {
                                      const pos = u.jobPositionId
                                        ? positionsById.get(u.jobPositionId)
                                        : null;
                                      return (
                                        <option key={u.id} value={u.id}>
                                          {u.name}
                                          {pos ? ` · ${pos.name}` : ""}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {eligibleForSlot.length === 0 && !showCurrent ? (
                                    <div className="mt-1 text-[11px] text-[#a13a32]">
                                      Нет подходящих сотрудников. Заведите/назначьте.
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
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
