"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronDown, Pencil, Plus, RefreshCw, Save, Trash2, UserPlus } from "lucide-react";
import { confirmAsync } from "@/components/ui/confirm-async";
import {
  RoomEditorDialog,
  type RoomEditorInitial,
} from "@/components/cleaning/room-editor-dialog";
import { toast } from "sonner";
import {
  ScopeListEditor,
  WeekdayMaskPicker,
} from "@/components/cleaning/scope-and-schedule-editors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  applyCleaningAutoFillToConfig,
  applyRoomScheduleToMatrix,
  type RoomScheduleFromDb,
  CLEANING_DOCUMENT_TITLE,
  CLEANING_PAGE_TITLE,
  createCleaningResponsibleRow,
  createCleaningRoomRow,
  deleteCleaningResponsibleRow,
  deleteCleaningRoomRow,
  displayMatrixValue,
  getCleaningPeriodLabel,
  normalizeCleaningDocumentConfig,
  setCleaningMatrixValue,
  toggleCleaningMatrixValue,
  type CleaningDocumentConfig,
  type CleaningMatrixValue,
  type CleaningResponsible,
  type CleaningResponsibleKind,
  type CleaningRoomItem,
} from "@/lib/cleaning-document";
import { buildDateKeys, isWeekend, toDateKey } from "@/lib/hygiene-document";
import { getCalendarDayKind } from "@/lib/production-calendar-data";
import {
  WEEKDAY_LABELS_RU,
  WEEKDAY_MASK_ALL,
  WEEKDAY_MASK_NONE,
  WEEKDAY_MASK_WEEKENDS,
  WEEKDAY_MASK_WORKDAYS,
  describeMask,
  isMaskedWeekday,
  normalizeMask,
  toggleWeekdayBit,
} from "@/lib/weekday-mask";
import { getDistinctRoleLabels, getUsersForRoleLabel } from "@/lib/user-roles";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import {
  DOC_AUTOFILL_STRIP_CLASS,
  DOC_BODY_STACK_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_EXTRA_BLOCK_CLASS,
  DOC_HEADING_CLASS,
  DOC_LEGEND_CLASS,
  DOC_PAPER_HEADER_CLASS,
} from "@/components/journals/journal-responsive";
import { useDocumentCloseAction } from "@/components/journals/document-close-button";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import {
  JournalDocumentHeader,
  JournalDocumentTitle,
  JournalLegendBlock,
} from "@/components/journals/journal-document-header";
import { MobileViewToggle } from "@/components/journals/mobile-view-toggle";
import { useMobileView } from "@/lib/use-mobile-view";
import { PositionSelectItems } from "@/components/shared/position-select";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_HEAD_CELL_PLAIN_CLASS,
  CELL_FOCUS_CLASS,
  GRID_VIEWPORT_CLASS,
} from "@/components/journals/journal-grid";

type UserItem = { id: string; name: string; role: string };
type EntryItem = { id: string; employeeId: string; date: string; data: unknown };
type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  autoFill: boolean;
  users: UserItem[];
  config: CleaningDocumentConfig;
  initialEntries: EntryItem[];
  /**
   * True when the org has connected TasksFlow. Reserved for the upcoming
   * auto-poll on mount + manual «Sync from TasksFlow» button. Optional
   * so existing callers (no integration) keep compiling without
   * touching every render site.
   */
  hasTasksFlowIntegration?: boolean;
  /**
   * Зарегистрированные в /settings/buildings корпуса и помещения.
   * Используется для нового rooms-режима (race-задачи). Старые
   * caller'ы могут не передавать — режим pairs работает как раньше.
   */
  buildings?: Array<{
    id: string;
    name: string;
    rooms: Array<{
      id: string;
      name: string;
      kind: string;
      // Cleaning unification: эти поля теперь живут на Room (DB).
      // Если page.tsx не передал — fallback на дефолты внутри клиента.
      detergent?: string;
      currentScope?: string[];
      generalScope?: string[];
      currentDays?: number;
      generalDays?: number;
      currentScheduleType?: "weekly" | "monthly";
      generalScheduleType?: "weekly" | "monthly";
      currentMonthDays?: string[];
      generalMonthDays?: string[];
      requirePhoto?: boolean;
    }>;
  }>;
  /**
   * Если true — рендерим Settings dialog в Design v2 стиле через
   * `<JournalSettingsModal>`. Сама механика и data-flow остаются
   * прежними; меняется только обёртка модалки. Включается через
   * `Organization.experimentalUiV2`. Default true с 2026-05 — V2.
   * См. docs/PIPELINE-VISION.md раздел P3.
   */
  useV2?: boolean;
};
type SettingsState = { title: string; cleaningRole: string; cleaningUserId: string; controlRole: string; controlUserId: string };
// RoomFormState — legacy type, заменён на RoomEditorInitial из
// @/components/cleaning/room-editor-dialog. См. cleaning-unification spec.
type ResponsibleFormState = { id: string | null; kind: CleaningResponsibleKind; title: string; userId: string };
type RowDescriptor =
  | { id: string; kind: "room"; room: CleaningRoomItem }
  | { id: string; kind: "cleaning"; responsible: CleaningResponsible }
  | { id: string; kind: "control"; responsible: CleaningResponsible };

// Cleaning unification 2026-05-08: ScopeListEditor + WeekdayMaskPicker
// extract'нуты в shared module @/components/cleaning/scope-and-schedule-editors
// чтобы /settings/buildings UI использовал тот же редактор. См. spec
// docs/superpowers/specs/2026-05-08-cleaning-unification.md (stages 2-3).

const primaryUserId = (users: UserItem[], roleLabel: string) => getUsersForRoleLabel(users, roleLabel)[0]?.id || "";
const userNameById = (users: UserItem[], userId: string) => users.find((user) => user.id === userId)?.name || "";
const buildSettingsState = (config: CleaningDocumentConfig): SettingsState => ({
  title: config.documentTitle || config.title || CLEANING_DOCUMENT_TITLE,
  cleaningRole: config.cleaningResponsibles[0]?.title || "",
  cleaningUserId: config.cleaningResponsibles[0]?.userId || "",
  controlRole: config.controlResponsibles[0]?.title || "",
  controlUserId: config.controlResponsibles[0]?.userId || "",
});
// buildRoomState — legacy helper, заменён на openRoomEditorFromRow в
// компоненте, который использует RoomEditorDialog/RoomEditorInitial.
const buildResponsibleState = (kind: CleaningResponsibleKind, responsible?: CleaningResponsible): ResponsibleFormState => ({
  id: responsible?.id || null,
  kind,
  title: responsible?.title || "",
  userId: responsible?.userId || "",
});

/**
 * Screen ↔ print duality tokens.
 *
 * НА ЭКРАНЕ журнал должен выглядеть частью дизайн-системы WeSetup:
 * мягкие границы `#ececf4`, серо-голубая шапка таблицы, hover строк.
 * ПРИ ПЕЧАТИ (Ctrl+P) инспектор РПН/СЭС ожидает «бумагу»: чёрные
 * рамки, без скруглений и заливок. Поэтому каждый токен несёт пару
 * screen-класс + `print:`-override.
 */
/** Скруглённый viewport вокруг таблицы; в печати — прозрачный wrapper. */
/** Focus-ring для интерактивных ячеек грида (A11y, п. B11). */

/** Человекочитаемые названия отметок — для aria-label ячеек. */
const CLEANING_VALUE_LABELS: Record<string, string> = {
  T: "Текущая уборка",
  G: "Генеральная уборка",
  "/": "Уборка не проводилась",
};

/** «2026-08-10» → «10 августа» для aria-label. */
function formatDayAriaLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/**
 * Легенда журнала хранится в config строками вида «Т — Текущая».
 * Разбираем их на `{ symbol, description }` для <JournalLegendBlock>.
 * Латинские T/G в легаси-конфигах приводим к кириллице по явной карте
 * (раньше это делалось regex-заменами прямо в JSX).
 */
const LEGEND_SYMBOL_ALIASES: Record<string, string> = { T: "Т", G: "Г" };

function parseLegendItem(raw: string): { symbol: string; description: string } {
  const trimmed = raw.trim();
  for (const separator of ["—", " - ", " – "]) {
    const index = trimmed.indexOf(separator);
    if (index > 0) {
      const symbol = trimmed.slice(0, index).trim();
      return {
        symbol: LEGEND_SYMBOL_ALIASES[symbol] ?? symbol,
        description: trimmed.slice(index + separator.length).trim(),
      };
    }
  }
  return { symbol: "", description: trimmed };
}

/**
 * Расшифровка цветов дней. Раньше цвет выходного/сокращённого дня
 * объяснялся только `title`-атрибутом ячейки — то есть никак для
 * тех, кто не наводит мышь. Показываем видимые chip'ы рядом с легендой.
 */
function CleaningDayColorLegend() {
  const items = [
    { color: "border-[#ffd7d3] bg-[#fff4f2]", label: "Выходной или праздник" },
    { color: "border-[#ffe9b0] bg-[#fff8eb]", label: "Сокращённый день" },
    { color: "border-[#ececf4] bg-white", label: "Рабочий день" },
  ];
  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[#3c4053]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className={`inline-block size-4 rounded-md border ${item.color}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function CleaningDocumentClient(props: Props) {
  const router = useRouter();
  const normalized = useMemo(() => normalizeCleaningDocumentConfig(props.config, { users: props.users }), [props.config, props.users]);
  const [config, setConfig] = useState(normalized);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  // Multi-select cells (rowId::dateKey) для bulk-edit. Когда `cellSelectMode`
  // ON: клик по ячейке добавляет/убирает её из selection, mousedown+drag
  // выделяет диапазон (как в Excel).
  const [cellSelectMode, setCellSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  // Drag-state хранится в refs (а не useState), чтобы read из mouseenter
  // handler'а был синхронным. setState async и handler читал бы stale
  // значение между ячейками, drag «терял» промежуточные.
  //
  // Excel-style rectangle drag-select:
  //   • mousedown на ячейке A → anchor = A, base = текущая selectedCells,
  //     mode = "remove" если A уже в base, иначе "add"
  //   • mousemove на ячейку B → applyRect(A, B): selectedCells = base ± cells_in_rect(A,B)
  //   • mouseup → очищает anchor; selectedCells уже финальный
  type CellPos = { rowId: string; dateKey: string };
  const dragAnchorRef = useRef<CellPos | null>(null);
  const dragBaseRef = useRef<Set<string>>(new Set());
  const dragModeRef = useRef<"add" | "remove" | null>(null);
  // Refs с актуальным порядком rows / dayKeys — нужны applyRectToSelection,
  // который вызывается из mouseenter handler'ов и должен читать самую
  // свежую раскладку (rows может пересчитаться при патче config).
  // Сами `rows` и `dayKeys` объявлены ниже как useMemo; sync через useEffect.
  const rowIdToIndexRef = useRef<Map<string, number>>(new Map());
  const dateKeyToIndexRef = useRef<Map<string, number>>(new Map());
  const rowsOrderRef = useRef<RowDescriptor[]>([]);
  const dateOrderRef = useRef<string[]>([]);
  // Дополнительный counter — для re-render UI «выделено N» в realtime
  // (selectedCells changes уже триггерят re-render, dragAnchorRef нет).
  const [, setDragTick] = useState(0);
  const cellKey = (rowId: string, dateKey: string) => `${rowId}::${dateKey}`;
  function clearCellSelection() {
    setSelectedCells(new Set());
  }
  // Mouse-up listener — снимает drag-state. Глобальный (на window),
  // чтобы работало даже если кнопка отпущена за пределами grid'а
  // (после того как пользователь утащил курсор за viewport).
  useEffect(() => {
    function handleUp() {
      dragAnchorRef.current = null;
      dragBaseRef.current = new Set();
      dragModeRef.current = null;
      setDragTick((n) => n + 1);
    }
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, []);
  // Drag-helpers. ref-based для синхронного read'а в mouseenter.
  // Применяет «прямоугольник от anchor до end» к selectedCells.
  // base — снимок selection в момент mousedown; mode — добавляем или убираем.
  function applyRectToSelection(anchor: CellPos, end: CellPos) {
    const aRow = rowIdToIndexRef.current.get(anchor.rowId);
    const eRow = rowIdToIndexRef.current.get(end.rowId);
    const aDate = dateKeyToIndexRef.current.get(anchor.dateKey);
    const eDate = dateKeyToIndexRef.current.get(end.dateKey);
    if (aRow == null || eRow == null || aDate == null || eDate == null) return;
    const r0 = Math.min(aRow, eRow);
    const r1 = Math.max(aRow, eRow);
    const d0 = Math.min(aDate, eDate);
    const d1 = Math.max(aDate, eDate);
    const base = dragBaseRef.current;
    const mode = dragModeRef.current ?? "add";
    const next = new Set(base);
    const rowsArr = rowsOrderRef.current;
    const dateArr = dateOrderRef.current;
    for (let i = r0; i <= r1; i += 1) {
      for (let j = d0; j <= d1; j += 1) {
        const row = rowsArr[i];
        const day = dateArr[j];
        if (!row || !day) continue;
        const k = cellKey(row.id, day);
        if (mode === "add") next.add(k);
        else next.delete(k);
      }
    }
    setSelectedCells(next);
  }
  function startDragOnCell(rowId: string, dateKey: string) {
    if (!cellSelectMode) return;
    const anchor: CellPos = { rowId, dateKey };
    const k = cellKey(rowId, dateKey);
    dragAnchorRef.current = anchor;
    dragBaseRef.current = new Set(selectedCells);
    dragModeRef.current = selectedCells.has(k) ? "remove" : "add";
    applyRectToSelection(anchor, anchor);
    setDragTick((n) => n + 1);
  }
  function continueDragOnCell(rowId: string, dateKey: string) {
    if (!cellSelectMode) return;
    const anchor = dragAnchorRef.current;
    if (!anchor || !dragModeRef.current) return;
    applyRectToSelection(anchor, { rowId, dateKey });
  }
  // Cleaning unification 2026-05-08+: один и тот же RoomEditorDialog
  // что используется в /settings/buildings. Сохраняет в Room (DB)
  // через PATCH /api/settings/rooms/[id]. router.refresh() подтягивает
  // обновлённый props.buildings и rows-builder перерисовывает.
  const [roomEditor, setRoomEditor] = useState<RoomEditorInitial | null>(null);

  // Полная конфигурация race-режима теперь живёт в диалоге, а не на странице.
  // По дефолту в журнале — только тонкая полоска с переключателем.
  const [raceConfigOpen, setRaceConfigOpen] = useState(false);

  function openRoomEditorFromRow(roomId: string) {
    const dbRoom = dbRoomById.get(roomId);
    if (!dbRoom) {
      toast.error("Помещение не найдено в /settings/buildings");
      return;
    }
    setRoomEditor({
      id: roomId,
      name: dbRoom.name,
      kind: dbRoom.kind ?? "other",
      detergent: dbRoom.detergent ?? "",
      // Передаём scope как-есть (string[] | ScopeStep[]) —
      // RoomEditorDialog.parseScopeSteps нормализует.
      currentScope: Array.isArray(dbRoom.currentScope)
        ? (dbRoom.currentScope as Array<string | { label: string; requirePhoto?: boolean }>)
        : [],
      generalScope: Array.isArray(dbRoom.generalScope)
        ? (dbRoom.generalScope as Array<string | { label: string; requirePhoto?: boolean }>)
        : [],
      currentDays:
        typeof dbRoom.currentDays === "number" ? dbRoom.currentDays : 127,
      generalDays:
        typeof dbRoom.generalDays === "number" ? dbRoom.generalDays : 0,
      currentScheduleType: dbRoom.currentScheduleType ?? "weekly",
      generalScheduleType: dbRoom.generalScheduleType ?? "weekly",
      currentMonthDays: Array.isArray(dbRoom.currentMonthDays)
        ? dbRoom.currentMonthDays
        : [],
      generalMonthDays: Array.isArray(dbRoom.generalMonthDays)
        ? dbRoom.generalMonthDays
        : [],
      requirePhoto: dbRoom.requirePhoto === true,
    });
  }
  const [responsibleDialog, setResponsibleDialog] = useState<ResponsibleFormState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsState, setSettingsState] = useState(buildSettingsState(normalized));
  // «Сохранить как шаблон по умолчанию» — confirm dialog для записи
  // текущего config'а в Organization.defaultCleaningDocumentConfig.
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [saveAsTemplateBusy, setSaveAsTemplateBusy] = useState(false);
  const closeAction = useDocumentCloseAction({
    documentId: props.documentId,
    title: normalized.documentTitle || CLEANING_PAGE_TITLE,
  });

  // «Заполнить по плану» — применяет weekday-маски всех помещений к
  // матрице. По умолчанию fill-empty (только пустые), но если зажат
  // shift / есть отметки → confirm-dialog с overwrite.
  async function applySchedulePlan(mode: "fill-empty" | "overwrite") {
    const next = applyRoomScheduleToMatrix(config, dayKeys, mode, dbScheduleMap);
    await patchDocument(next);
    const planned = next.rooms.reduce((acc, room) => {
      const row = next.matrix[room.id] ?? {};
      return acc + Object.keys(row).length;
    }, 0);
    toast.success(
      mode === "overwrite"
        ? `План применён заново: ${planned} ячеек`
        : `План применён к пустым ячейкам: ${planned} запланировано всего`,
    );
  }

  /**
   * Auto-apply schedule после сохранения помещения. Каллер передаёт
   * snapshot patch'а (свежие currentDays/generalDays/... ещё ДО того,
   * как router.refresh() прокинет это через props). Мы создаём
   * локальный override-map поверх dbScheduleMap и пересчитываем matrix
   * для затронутого помещения. patchDocument отрабатывает →
   * syncTodayMatrixChanges (auto-trigger в API endpoint) обновляет
   * сегодняшние TF-задачи. Past дата не трогается — менеджер не
   * хочет чтобы редактирование расписания меняло уже отмеченные дни.
   */
  async function autoApplyScheduleForRoom(snapshot: {
    id: string;
    currentDays: number;
    generalDays: number;
    currentScheduleType: "weekly" | "monthly";
    generalScheduleType: "weekly" | "monthly";
    currentMonthDays: string[];
    generalMonthDays: string[];
  }) {
    const overrideMap = new Map(dbScheduleMap ?? new Map());
    overrideMap.set(snapshot.id, {
      id: snapshot.id,
      currentDays: snapshot.currentDays,
      generalDays: snapshot.generalDays,
      currentScheduleType: snapshot.currentScheduleType,
      generalScheduleType: snapshot.generalScheduleType,
      currentMonthDays: snapshot.currentMonthDays,
      generalMonthDays: snapshot.generalMonthDays,
    });
    // Только будущее (СТРОГО завтра+) — сегодня не трогаем, иначе
    // existing completed TF-tasks могут потеряться (matrix меняется
    // → syncTodayMatrixChanges удаляет TF tasks → completion-history
    // отвязывается от TF). Plus исключаем дни, у которых уже есть
    // completion — на них уборщик уже отметился, перезапись плана
    // на этих днях ломает compliance-trail.
    const today = new Date().toISOString().slice(0, 10);
    const completedDayKeysForRoom = new Set<string>();
    for (const e of props.initialEntries) {
      const d = e.data as Record<string, unknown> | null;
      if (
        d?.kind === "cleaning_room" &&
        d?.roomId === snapshot.id &&
        typeof d?.dateKey === "string"
      ) {
        completedDayKeysForRoom.add(d.dateKey);
      }
    }
    const futureDayKeys = dayKeys.filter(
      (k) => k > today && !completedDayKeysForRoom.has(k),
    );
    if (futureDayKeys.length === 0) {
      // Ничего не пересчитываем (today + completion-дни исключены).
      // Однако параллельно — обновим requiresPhoto на сегодняшних TF-tasks
      // (без destructive matrix-сброса).
      await fetch("/api/integrations/tasksflow/sync-room-photo-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: props.documentId,
          roomId: snapshot.id,
        }),
      }).catch(() => {});
      return;
    }
    const next = applyRoomScheduleToMatrix(
      config,
      futureDayKeys,
      "overwrite",
      overrideMap,
    );
    await patchDocument(next);
    // После patch: подтолкнём requiresPhoto-апдейт на существующих TF-tasks
    // этого помещения. patchDocument уже вызвал syncTodayMatrixChanges,
    // но он только title/description обновляет, не requiresPhoto.
    await fetch("/api/integrations/tasksflow/sync-room-photo-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: props.documentId,
        roomId: snapshot.id,
      }),
    }).catch(() => {});
    toast.success(
      "Расписание помещения применено — будущие задачи обновлены",
    );
  }

  // Pipeline-mode setters — патчат config и persist'ят сразу.
  // perRoom = у каждой комнаты свой scope (текущее поведение)
  // global  = один общий список для всех комнат
  // legacy  = без подзадач, чек-лист отключён
  async function setCleaningSubtaskMode(mode: "perRoom" | "global" | "legacy") {
    const next = normalizeCleaningDocumentConfig(
      { ...config, cleaningSubtaskMode: mode },
      { users: props.users },
    );
    await patchDocument(next);
  }
  async function setGlobalSubtasks(value: { current?: string[]; general?: string[] }) {
    const prev = config.globalSubtasks ?? { current: [], general: [] };
    const merged = {
      current: value.current ?? prev.current,
      general: value.general ?? prev.general,
    };
    const next = normalizeCleaningDocumentConfig(
      { ...config, globalSubtasks: merged },
      { users: props.users },
    );
    await patchDocument(next);
  }
  async function handleSaveAsTemplate() {
    setSaveAsTemplateBusy(true);
    try {
      const response = await fetch("/api/journals/cleaning/default-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error || "Не удалось сохранить шаблон");
        return;
      }
      toast.success("Шаблон сохранён — новые журналы уборки будут создаваться с этими настройками");
      setSaveAsTemplateOpen(false);
    } catch (err) {
      console.error("[cleaning] save-as-template failed", err);
      toast.error("Сетевая ошибка");
    } finally {
      setSaveAsTemplateBusy(false);
    }
  }
  // Mobile-only preference — Cards default. See hygiene-document-client.tsx
  // for the full rationale; the 920-px grid behind horizontal scroll is
  // unusable on a 320-px phone, so we collapse it into a per-row accordion
  // with tap-to-cycle day buttons. Desktop / print always use the table.
  const { mobileView, switchMobileView } = useMobileView("cleaning");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  // Миграция со старого ключа "cleaning-mobile-view" (до перехода на
  // общий useMobileView). Читаем один раз: если нового ключа ещё нет,
  // а старый лежит — переносим выбор пользователя и чистим легаси.
  // Эффект объявлен ПОСЛЕ useMobileView, поэтому его собственный
  // restore-эффект уже отработал и мы не перетираем свежее значение.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("journal-mobile-view:cleaning")) return;
      const legacy = window.localStorage.getItem("cleaning-mobile-view");
      if (legacy === "table" || legacy === "cards") switchMobileView(legacy);
      window.localStorage.removeItem("cleaning-mobile-view");
    } catch {
      /* localStorage blocked — остаёмся на дефолте 'cards' */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const roleOptions = useMemo(() => getDistinctRoleLabels(props.users), [props.users]);
  const dayKeys = useMemo(() => buildDateKeys(props.dateFrom, props.dateTo), [props.dateFrom, props.dateTo]);

  const isRoomsMode = config.cleaningMode === "rooms";

  // Для rooms-mode: подгружаем имя комнаты из buildings и инициалы юзеров.
  const buildingsRoomMap = useMemo(() => {
    const m = new Map<string, string>();
    (props.buildings ?? []).forEach((b) =>
      b.rooms.forEach((r) => m.set(r.id, r.name))
    );
    return m;
  }, [props.buildings]);

  // Cleaning unification: подгружаем полные Room-объекты (scope/days/
  // detergent + scheduleType/monthDays/requirePhoto) для rooms-mode.
  // Source of truth с 2026-05-08 — Room в БД, не config.rooms[].
  const dbRoomById = useMemo(() => {
    const m = new Map<
      string,
      {
        id: string;
        name: string;
        kind: string;
        detergent?: string;
        currentScope?: string[];
        generalScope?: string[];
        currentDays?: number;
        generalDays?: number;
        currentScheduleType?: "weekly" | "monthly";
        generalScheduleType?: "weekly" | "monthly";
        currentMonthDays?: string[];
        generalMonthDays?: string[];
        requirePhoto?: boolean;
      }
    >();
    (props.buildings ?? []).forEach((b) =>
      b.rooms.forEach((r) => m.set(r.id, r)),
    );
    return m;
  }, [props.buildings]);

  // Map с полным расписанием для applyRoomScheduleToMatrix.
  const dbScheduleMap = useMemo(() => {
    const m = new Map<string, RoomScheduleFromDb>();
    dbRoomById.forEach((r, id) => {
      m.set(id, {
        id,
        currentDays: r.currentDays,
        generalDays: r.generalDays,
        currentScheduleType: r.currentScheduleType,
        generalScheduleType: r.generalScheduleType,
        currentMonthDays: r.currentMonthDays,
        generalMonthDays: r.generalMonthDays,
      });
    });
    return m;
  }, [dbRoomById]);
  const userInitialsById = useMemo(() => {
    const m = new Map<string, string>();
    props.users.forEach((u) => {
      const parts = u.name.trim().split(/\s+/);
      const ini = parts
        .map((p) => p[0]?.toUpperCase() ?? "")
        .slice(0, 3)
        .join("");
      m.set(u.id, ini);
    });
    return m;
  }, [props.users]);

  // Уборщики — С1, С2, ..., СN. Без дедупа с контролёрами: один человек
  // МОЖЕТ быть и в «Ответственный за уборку», и в «Ответственный за
  // контроль» одновременно (раньше дедупили — пользователь жаловался,
  // что «Ярослав в контроле, но не в уборке» — теперь разрешено).
  const cleaningResponsibleList = useMemo<CleaningResponsible[]>(() => {
    if (
      isRoomsMode &&
      Array.isArray(config.selectedCleanerUserIds) &&
      config.selectedCleanerUserIds.length > 0
    ) {
      return config.selectedCleanerUserIds.map((userId, idx) => {
        const user = props.users.find((u) => u.id === userId);
        return {
          id: `selected-cleaner-${userId}`,
          kind: "cleaning" as const,
          code: `С${idx + 1}`,
          title: "Уборщик",
          userId,
          userName: user?.name ?? "—",
        } satisfies CleaningResponsible;
      });
    }
    return config.cleaningResponsibles.map((r, idx) => ({
      ...r,
      code: `С${idx + 1}`,
    }));
  }, [
    isRoomsMode,
    config.selectedCleanerUserIds,
    config.cleaningResponsibles,
    props.users,
  ]);

  // Контролёры — С1, С2, ... СM (independent numbering от cleaning-list).
  // Каждая строка («Ответственный за уборку» и «Ответственный за контроль»)
  // имеет собственное С-нумерование от С1 — они логически независимые
  // списки, объединённая нумерация запутывала менеджера.
  const controlResponsibleList = useMemo<CleaningResponsible[]>(() => {
    return config.controlResponsibles.map((resp, idx) => ({
      ...resp,
      code: `С${idx + 1}`,
    }));
  }, [config.controlResponsibles]);

  const rows = useMemo<RowDescriptor[]>(() => {
    // Cleaning unification 2026-05-08+: помещения ВСЕГДА из Buildings
    // (Room DB), независимо от режима. Если selectedRoomIds задан — берём
    // их; если пусто — все Room орги.
    //
    // 2026-05-08 (поздний вечер): rows возвращает ТОЛЬКО помещения. Строки
    // «Ответственный за уборку» и «Ответственный за контроль» рендерятся
    // как 2 отдельных <tr>/<div> ПОСЛЕ rows.map(...) в JSX, по образцу
    // haccp-online.ru: одна группированная строка с multi-line списком
    // «С1 - Имя / С2 - Имя» в первой колонке вместо N отдельных строк.
    const allBuildingRoomIds = Array.from(dbRoomById.keys());
    const selectedIds = config.selectedRoomIds ?? [];
    const roomIds =
      selectedIds.length > 0
        ? selectedIds.filter((id) => dbRoomById.has(id))
        : allBuildingRoomIds;
    return roomIds.map((roomId) => {
      const dbRoom = dbRoomById.get(roomId)!;
      const room: CleaningRoomItem = {
        id: roomId,
        areaId: null,
        name: dbRoom.name,
        detergent: dbRoom.detergent ?? "",
        currentScope: Array.isArray(dbRoom.currentScope)
          ? (dbRoom.currentScope as string[])
          : [],
        generalScope: Array.isArray(dbRoom.generalScope)
          ? (dbRoom.generalScope as string[])
          : [],
        currentDays:
          typeof dbRoom.currentDays === "number" ? dbRoom.currentDays : 127,
        generalDays:
          typeof dbRoom.generalDays === "number" ? dbRoom.generalDays : 0,
      };
      return { id: roomId, kind: "room" as const, room };
    });
  }, [config.selectedRoomIds, dbRoomById]);

  // Псевдо-rowId для manual signature ответственного. matrix хранит их
  // как обычные строки — patchDocument сам их сохраняет/читает.
  const CLEANING_SIGNATURE_ROW_ID = "__cleaning_signature__";
  const CONTROL_SIGNATURE_ROW_ID = "__control_signature__";

  // Подпись «Ответственный за уборку» в день D.
  //   1. Если есть manual override (matrix[CLEANING_SIGNATURE_ROW_ID][D]) —
  //      возвращаем его. НО если код устарел (С2 из 2-уборщикового
  //      прошлого, а сейчас только С1) — игнорируем.
  //   2. Иначе computed: коды С1/С2 из completion-entries напрямую
  //      (раньше через cellValue, но cellValue для room-rows больше не
  //      возвращает С-коды — только Т/Г/«/», см. cellValue выше).
  function cleaningCodeForDay(dateKey: string): string {
    const manual = config.matrix[CLEANING_SIGNATURE_ROW_ID]?.[dateKey];
    if (manual !== undefined) {
      // Пустая строка ИЛИ sentinel «—» = явная очистка владельца —
      // пропускаем дальше (signature row не должна светить sentinel,
      // но safety-net на случай миграции).
      if (manual === "" || manual === "—") return "";
      const parts = manual.split(",").map((s) => s.trim()).filter(Boolean);
      const validParts = parts.filter(
        (p) => p !== "—" && (!/^С\d+$/.test(p) || validCleaningCodes.has(p)),
      );
      if (validParts.length > 0) return validParts.join(",");
      // Все коды устарели — fallthrough to computed.
    }
    const codes = new Set<string>();
    for (const e of props.initialEntries) {
      const d = e.data as Record<string, unknown> | null;
      if (d?.kind !== "cleaning_room" || d?.dateKey !== dateKey) continue;
      const cleanerId = String(d.cleanerUserId ?? "");
      const code = cleanerCodeById.get(cleanerId);
      if (code) codes.add(code);
    }
    return Array.from(codes).sort().join(",");
  }

  // Подпись «Ответственный за контроль» в день D.
  //   1. Manual override matrix[CONTROL_SIGNATURE_ROW_ID][D] выигрывает.
  //   2. Иначе: коды контролёров (К1/К2) в дни где была хоть одна реальная
  //      completion в комнатах. Без completions — пусто (нечего проверять).
  function controlCodeForDay(dateKey: string): string {
    const manual = config.matrix[CONTROL_SIGNATURE_ROW_ID]?.[dateKey];
    if (manual !== undefined) {
      // Пустая строка ИЛИ sentinel «—» = явная очистка владельца.
      if (manual === "" || manual === "—") return "";
      // Stale-codes filter (по спеке F.3): если manual содержит С-код,
      // которого нет в текущем validControlCodes — отбрасываем. Поддержка
      // multi-controller через split по запятой.
      const parts = manual.split(",").map((s) => s.trim()).filter(Boolean);
      const validParts = parts.filter(
        (p) => p !== "—" && (!/^С\d+$/.test(p) || validControlCodes.has(p)),
      );
      if (validParts.length > 0) return validParts.join(",");
      // Все коды устарели — fallthrough to computed.
    }
    if (controlResponsibleList.length === 0) return "";
    // Computed: если хоть одна completion в этот день — считаем что
    // контролёр(ы) проверили. Без completions — нечего проверять, пусто.
    const hasAnyCompletion = props.initialEntries.some((e) => {
      const d = e.data as Record<string, unknown> | null;
      return d?.kind === "cleaning_room" && d?.dateKey === dateKey;
    });
    if (!hasAnyCompletion) return "";
    return controlResponsibleList.map((c) => c.code).join(",");
  }

  // Циклим manual signature по клику. Порядок:
  //   computed/empty → С1 → С2 → ... → СN → «—» (sentinel: visual empty,
  //   но override computed) → computed/empty (delete from storage)
  //
  // Sentinel «—» нужен по той же причине что и в room-cells: если
  // computed-fallback (cleaningCodeForDay из completions) показывает код,
  // менеджер не может «очистить» клетку — она всегда возвращалась к
  // computed. Sentinel явно подавляет fallback.
  async function cycleSignature(
    rowId: string,
    dateKey: string,
    codes: string[],
  ) {
    if (props.status !== "active" || saving) return;
    if (codes.length === 0) return;
    // Source-of-truth: видимое значение (matrix override ИЛИ computed).
    // Раньше читали только matrix → клик на computed-derived "С1" вёл к
    // matrix=С1 (визуально без изменений). Теперь cycle стартует от того
    // что менеджер видит.
    const visualCode =
      rowId === CLEANING_SIGNATURE_ROW_ID
        ? cleaningCodeForDay(dateKey)
        : controlCodeForDay(dateKey);
    const matrixVal = config.matrix[rowId]?.[dateKey];
    // Sentinel в matrix → текущее визуальное "" (empty), next = codes[0].
    // visualCode может быть "С1" или "С1,С2" (multi). Простое правило:
    // если visualCode === codes[i] (single match) — берём codes[i+1].
    // Иначе если visualCode пустое или multi/unknown → start с codes[0].
    // sentinel → start с codes[0].
    let next: string;
    if (matrixVal === "—") {
      next = codes[0];
    } else if (!visualCode) {
      next = codes[0];
    } else {
      const idx = codes.indexOf(visualCode);
      if (idx < 0) {
        // visualCode не один из codes (multi-code, stale, или unknown)
        next = codes[0];
      } else if (idx === codes.length - 1) {
        // Последний код → sentinel (visual empty, override computed)
        next = "—";
      } else {
        next = codes[idx + 1];
      }
    }
    const nextRowMap = { ...(config.matrix[rowId] ?? {}) };
    if (next === "—") {
      nextRowMap[dateKey] = "—";
    } else if (next === "") {
      delete nextRowMap[dateKey];
    } else {
      nextRowMap[dateKey] = next;
    }
    await patchDocument({
      ...config,
      matrix: { ...config.matrix, [rowId]: nextRowMap },
    });
  }

  // Синкаем refs для rect-drag-select. Без этого applyRectToSelection
  // может прочитать stale rows при быстром переключении.
  useEffect(() => {
    rowsOrderRef.current = rows;
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i));
    rowIdToIndexRef.current = m;
  }, [rows]);
  useEffect(() => {
    dateOrderRef.current = dayKeys;
    const m = new Map<string, number>();
    dayKeys.forEach((d, i) => m.set(d, i));
    dateKeyToIndexRef.current = m;
  }, [dayKeys]);

  /** Выделить ВСЕ ячейки (rows × dates). Используется для bulk-«Применить». */
  function selectAllCells() {
    const next = new Set<string>();
    for (const row of rows) {
      for (const day of dayKeys) {
        next.add(cellKey(row.id, day));
      }
    }
    setSelectedCells(next);
    setCellSelectMode(true);
  }

  // Map userId → код уборщика (С1/С2/...). Используется в room-cells
  // (cellValue.completion-fallback) и должен быть согласован с
  // cleaningResponsibleList — иначе ghost-уборщик (например, бывший
  // или контролёр) генерирует код С2 в клетке, хотя в списке
  // уборщиков его нет.
  //
  // Раньше cleanerCodeById брал данные напрямую из selectedCleanerUserIds,
  // включая отфильтрованных. Теперь источник = cleaningResponsibleList
  // (уже отдедуплицирован: контролёры исключены).
  const cleanerCodeById = useMemo(() => {
    const m = new Map<string, string>();
    cleaningResponsibleList.forEach((r) => {
      if (r.userId) m.set(r.userId, r.code);
    });
    return m;
  }, [cleaningResponsibleList]);

  // Множество допустимых кодов уборщиков ("С1", "С2", ...). Используется
  // как safety-net: если в matrix лежит легаси-значение "С2" (записанное
  // когда было 2 уборщика, а сейчас остался 1), мы его НЕ отображаем —
  // менеджер увидит пустую клетку, а не invalid С2.
  const validCleaningCodes = useMemo(() => {
    return new Set(cleaningResponsibleList.map((r) => r.code));
  }, [cleaningResponsibleList]);

  // Аналогично — допустимые коды контролёров ("С{N+1}", ...). Применяется
  // в controlCodeForDay чтобы не светились stale-коды легаси-контролёров.
  const validControlCodes = useMemo(() => {
    return new Set(controlResponsibleList.map((r) => r.code));
  }, [controlResponsibleList]);

  /**
   * Значение ячейки.
   *
   * Приоритет (2026-05-09 фикс «по середине не убирается»):
   *   1. Manual matrix override (T/G/«/») — побеждает всегда. Так клик
   *      менеджера сразу виден: cycled empty→T→G→«/»→empty без сюрпризов.
   *      Раньше completion-код блокировал визуальные правки и менеджер
   *      думал что клик не работает.
   *   2. Completion из JournalDocumentEntry (kind="cleaning_room") — код
   *      уборщика С1/С2/... Виден когда matrix пустой и уборщик закрыл
   *      TF-задачу. Менеджер не теряет compliance-данные: чтобы вернуться
   *      к completion-display, надо до-цикл матрицы до empty.
   *   3. Иначе пусто.
   *
   * Responsible-rows (cleaning/control) рендерятся отдельно ниже rows.map
   * с собственными cleaningCodeForDay/controlCodeForDay; здесь возвращаем
   * пусто для безопасности (никогда не вызывается с non-room в новой
   * структуре, но guard на случай регрессии).
   */
  function cellValue(row: RowDescriptor, dateKey: string): string {
    if (row.kind !== "room") return "";
    // 1. Manual matrix override — Т/Г/«/» или sentinel «—» (явная пустота).
    //    Любые С-коды (легаси из 2-уборщикового setup'а) — игнор.
    const matrixVal = config.matrix[row.id]?.[dateKey];
    if (matrixVal === "—") {
      // Sentinel: менеджер явно очистил клетку, completion-fallback
      // подавляется. Возвращаем сам sentinel — JSX через
      // displayMatrixValue превратит его в "" (визуальная пустота),
      // а updateCell использует sentinel для корректного цикла.
      return matrixVal;
    }
    if (matrixVal && (matrixVal === "T" || matrixVal === "G" || matrixVal === "/")) {
      return matrixVal;
    }
    // 2. Completion из DB — cleaner закрыл TF-задачу. Возвращаем тип
    //    уборки на этот день: Г если день в generalDays bitmask room'а,
    //    иначе Т.
    for (const e of props.initialEntries) {
      const d = e.data as Record<string, unknown> | null;
      if (
        d?.kind === "cleaning_room" &&
        d?.roomId === row.id &&
        d?.dateKey === dateKey
      ) {
        const cleanerId = String(d.cleanerUserId ?? "");
        if (!cleanerCodeById.has(cleanerId)) {
          // Контролёр / бывший — не показываем фантомное «выполнено».
          return "";
        }
        // Cleaner валидный. Определяем тип уборки по день-недели bitmask.
        const dow = (() => {
          const d = new Date(`${dateKey}T00:00:00.000Z`);
          if (Number.isNaN(d.getTime())) return -1;
          const js = d.getUTCDay(); // 0=Вс..6=Сб
          return js === 0 ? 6 : js - 1; // приводим к Пн=0..Вс=6
        })();
        const generalDays =
          typeof row.room.generalDays === "number" ? row.room.generalDays : 0;
        if (dow >= 0 && (generalDays & (1 << dow)) !== 0) return "G";
        return "T";
      }
    }
    return "";
  }

  useEffect(() => { setConfig(normalized); setSettingsState(buildSettingsState(normalized)); }, [normalized]);

  // TasksFlow round-trip:
  //   1. On mount, if the org has the integration, ask the server to
  //      pull task statuses from TasksFlow. If anything is newly
  //      completed, the server has already written the cell — we just
  //      router.refresh() to re-render.
  //   2. The action button calls the same endpoint with explicit toast
  //      so the user can force a refresh after closing a task in the
  //      cleaner's app without leaving the page.
  // Guarded by `hasTasksFlowIntegration` so orgs without integration
  // pay zero cost.
  const [tasksFlowSyncing, setTasksFlowSyncing] = useState(false);
  const [cleanupCompletedRunning, setCleanupCompletedRunning] = useState(false);

  async function cleanupCompletedTasks() {
    if (!props.hasTasksFlowIntegration || cleanupCompletedRunning) return;
    const ok = await confirmAsync({
      title: "Удалить выполненные TF-задачи?",
      description:
        "Из TasksFlow будут удалены ВСЕ задачи которые помечены как выполненные у этой компании. Журналы (matrix, audit-log, фото) — остаются. Это нужно когда лента TF разрослась и хочется чистоты.",
      variant: "warn",
      confirmLabel: "Очистить",
      bullets: [
        { label: "Удаляются ТОЛЬКО completed-задачи (active не трогаем)" },
        { label: "Только нашей компании в TF (companyId-фильтр)" },
        { label: "Compliance-данные остаются: matrix-ячейки, JournalDocumentEntry, AuditLog" },
      ],
    });
    if (!ok) return;
    setCleanupCompletedRunning(true);
    try {
      const r = await fetch(
        "/api/integrations/tasksflow/cleanup-completed",
        { method: "POST" },
      );
      const data = (await r.json().catch(() => ({}))) as {
        deletedTfTasks?: number;
        alreadyGone?: number;
        message?: string;
        error?: string;
      };
      if (!r.ok) {
        toast.error(data.error ?? "Не удалось очистить выполненные");
        return;
      }
      toast.success(data.message ?? "Готово");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Сеть упала");
    } finally {
      setCleanupCompletedRunning(false);
    }
  }

  async function syncFromTasksFlow(opts?: { silent?: boolean }) {
    if (!props.hasTasksFlowIntegration || tasksFlowSyncing) return;
    setTasksFlowSyncing(true);
    try {
      const response = await fetch(
        "/api/integrations/tasksflow/sync-tasks",
        { method: "POST" }
      );
      if (!response.ok) {
        if (!opts?.silent) {
          toast.error("Не удалось обновить статусы из TasksFlow");
        }
        return;
      }
      const data = (await response.json()) as {
        checked: number;
        newlyCompleted: number;
        reopened: number;
        errors: number;
      };
      if (data.newlyCompleted > 0 || data.reopened > 0) {
        router.refresh();
      }
      if (!opts?.silent) {
        if (data.errors > 0) {
          toast.error("TasksFlow временно недоступен. Журнал продолжает работать.");
        } else if (data.newlyCompleted > 0) {
          toast.success(
            `Из TasksFlow подтянуто выполненных: ${data.newlyCompleted}`
          );
        } else if (data.checked === 0) {
          toast.info("Связанных задач в TasksFlow пока нет");
        } else {
          toast.info("Все задачи уже актуальны");
        }
      }
    } catch (error) {
      if (!opts?.silent) {
        toast.error(
          error instanceof Error ? error.message : "Ошибка обновления"
        );
      }
    } finally {
      setTasksFlowSyncing(false);
    }
  }
  useEffect(() => {
    if (!props.hasTasksFlowIntegration) return;
    void syncFromTasksFlow({ silent: true });
    // Intentionally fires once per mount; do not re-run on every props
    // change or we'd hammer TasksFlow on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function patchDocument(nextConfig: CleaningDocumentConfig, overrides?: Record<string, unknown>) {
    setSaving(true);
    try {
      const payload = normalizeCleaningDocumentConfig(nextConfig, { users: props.users });
      const response = await fetch(`/api/journal-documents/${props.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.documentTitle || payload.title,
          config: payload,
          responsibleTitle: payload.controlResponsibles[0]?.title || props.responsibleTitle || null,
          responsibleUserId: payload.controlResponsibles[0]?.userId || props.responsibleUserId || null,
          autoFill: payload.autoFill.enabled,
          ...overrides,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      setConfig(payload);
      setSettingsState(buildSettingsState(payload));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updateSettings(patch: Partial<SettingsState>) {
    const nextState = { ...settingsState, ...patch };
    setSettingsState(nextState);
    // Upsert ответственных:
    //   • если массив непустой — обновляем index 0 (как раньше)
    //   • если массив пустой и пользователь выбрал role+userId — создаём
    //     новую запись через createCleaningResponsibleRow (это и был
    //     баг P0.2: пустой .map() возвращал пустой массив, и сохранение
    //     терялось — settings-modal/banner-select показывали выбор, но
    //     после router.refresh() значение слетало)
    //   • если массив пустой и role+userId тоже пустые — оставляем как есть
    function upsertResponsible(
      kind: "cleaning" | "control",
      items: CleaningResponsible[],
      role: string,
      userId: string
    ): CleaningResponsible[] {
      const userName = userNameById(props.users, userId);
      if (items.length > 0) {
        return items.map((item, index) =>
          index === 0
            ? { ...item, title: role, userId, userName }
            : item
        );
      }
      // empty array
      if (!role && !userId) return items;
      return [
        createCleaningResponsibleRow({
          kind,
          title: role,
          userId,
          userName,
        }),
      ];
    }
    const nextConfig = normalizeCleaningDocumentConfig({
      ...config,
      title: nextState.title.trim() || CLEANING_DOCUMENT_TITLE,
      documentTitle: nextState.title.trim() || CLEANING_DOCUMENT_TITLE,
      cleaningResponsibles: upsertResponsible(
        "cleaning",
        config.cleaningResponsibles,
        nextState.cleaningRole,
        nextState.cleaningUserId
      ),
      controlResponsibles: upsertResponsible(
        "control",
        config.controlResponsibles,
        nextState.controlRole,
        nextState.controlUserId
      ),
    }, { users: props.users });
    await patchDocument(nextConfig);
  }

  async function toggleAutoFill(checked: boolean) {
    const baseConfig = normalizeCleaningDocumentConfig({
      ...config,
      settings: { ...config.settings, autoFillEnabled: checked },
      autoFill: { ...config.autoFill, enabled: checked },
    }, { users: props.users });
    const nextConfig = checked ? applyCleaningAutoFillToConfig({ config: baseConfig, dateFrom: props.dateFrom, dateTo: props.dateTo }) : baseConfig;
    await patchDocument(nextConfig, { autoFill: checked });
  }

  async function toggleSkipWeekends(checked: boolean) {
    const nextConfig = normalizeCleaningDocumentConfig({
      ...config,
      settings: { ...config.settings, skipWeekends: checked },
      autoFill: { ...config.autoFill, skipWeekends: checked },
      skipWeekends: checked,
    }, { users: props.users });
    await patchDocument(nextConfig);
  }

  async function updateCell(row: RowDescriptor, dateKey: string) {
    if (props.status !== "active") return;
    // В режиме выделения клик игнорируется — drag-handlers (mousedown +
    // mouseenter) добавляют/убирают ячейки в selection.
    if (cellSelectMode) return;
    // Responsible-rows (С1/С2) — не редактируемые ячейки. Клик не делает
    // ничего. Информация в первой колонке («С1 — Иван Иванов»), коды
    // вписываются в room-cells автоматически когда уборщик закроет
    // соответствующую TF-задачу.
    if (row.kind !== "room") return;
    // Cycle source-of-truth: видимое значение (matrix override ИЛИ
    // completion-derived). Раньше читали только matrix → клик на клетке
    // с completion "T" не двигал цикл (matrix=undefined → toggle("")="T",
    // matrix=T, визуально без изменений). Теперь cycle стартует от того
    // что менеджер реально видит.
    //
    // sentinel "—" возвращается cellValue как-есть (display конвертит в "");
    // toggleCleaningMatrixValue("—") = "T" (delete sentinel, начать заново).
    const visualValue = cellValue(row, dateKey);
    const nextValue = toggleCleaningMatrixValue(visualValue);
    await patchDocument(
      setCleaningMatrixValue({ config, rowId: row.id, dateKey, value: nextValue }),
    );
  }

  /**
   * Bulk-set значения для ВСЕХ выходных и праздников периода (для всех
   * room-rows). Не требует выделения. Использует production calendar.
   */
  async function bulkSetHolidaysAndWeekends(value: CleaningMatrixValue) {
    if (props.status !== "active") return;
    // Источник списка room id'ов: pairs-mode → config.rooms,
    // rooms-mode → selectedRoomIds + buildings name lookup.
    const roomIds = isRoomsMode
      ? (config.selectedRoomIds ?? [])
      : config.rooms.map((r) => r.id);
    if (roomIds.length === 0) return;
    // bulk-clear → sentinel «—» (см. bulkSetSelectedCells выше).
    const storedValue = value === "" ? "—" : value;
    const offDays = dayKeys.filter((dk) => {
      const k = getCalendarDayKind(dk).kind;
      return k === "weekend" || k === "holiday";
    });
    if (offDays.length === 0) {
      toast.info("В периоде нет выходных или праздников");
      return;
    }
    let nextConfig = config;
    let cellsUpdated = 0;
    for (const roomId of roomIds) {
      for (const dateKey of offDays) {
        nextConfig = setCleaningMatrixValue({
          config: nextConfig,
          rowId: roomId,
          dateKey,
          value: storedValue,
        });
        cellsUpdated += 1;
      }
    }
    try {
      await patchDocument(nextConfig);
      const action = value === "/" ? "помечены «Не проводилась»" : value === "" ? "очищены" : "обновлены";
      toast.success(
        `Выходных и праздников: ${offDays.length} дн. × ${roomIds.length} помещ. = ${cellsUpdated} ячеек ${action}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось обновить ячейки",
      );
    }
  }

  /**
   * Bulk-set значения для всех selectedCells (rowId::dateKey). Один
   * patchDocument вместо N — быстрее и атомарно. После успеха выделение
   * сбрасывается.
   */
  async function bulkSetSelectedCells(value: CleaningMatrixValue) {
    if (props.status !== "active") return;
    if (selectedCells.size === 0) return;
    // Допустимые room-id для bulk: pairs-mode → config.rooms,
    // rooms-mode → selectedRoomIds.
    const allowedRoomIds = new Set(
      isRoomsMode
        ? (config.selectedRoomIds ?? [])
        : config.rooms.map((r) => r.id),
    );
    // При bulk-clear (value="") пишем sentinel «—» вместо delete, чтобы
    // подавить completion-fallback. Иначе клетки с completion-задачами
    // остались бы визуально с «Т»/«Г» — менеджер жаловался: «при
    // очистке некоторые дни не очищаются».
    const storedValue = value === "" ? "—" : value;
    let nextConfig = config;
    for (const k of selectedCells) {
      const [rowId, dateKey] = k.split("::");
      if (!rowId || !dateKey) continue;
      // responsible-rows используют свой code как значение, не T/G/«/».
      // Bulk-edit предназначен для room-rows; для responsible пропустим.
      if (!allowedRoomIds.has(rowId)) continue;
      nextConfig = setCleaningMatrixValue({
        config: nextConfig,
        rowId,
        dateKey,
        value: storedValue,
      });
    }
    try {
      await patchDocument(nextConfig);
      const labelMap: Record<CleaningMatrixValue, string> = {
        "": "очищены",
        T: "помечены «Текущая»",
        G: "помечены «Генеральная»",
        "/": "помечены «Не проводилась»",
      };
      toast.success(
        `Ячеек обновлено: ${selectedCells.size} (${labelMap[value] ?? "обновлены"})`,
      );
      clearCellSelection();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось обновить ячейки",
      );
    }
  }

  async function deleteSelectedRows() {
    const count = selection.length;
    if (count === 0) return;
    const ok = await confirmAsync({
      title: "Удалить выбранные строки?",
      description:
        "Строки исчезнут из журнала вместе с их отметками в матрице. Уже сохранённые записи о выполненной уборке (compliance-история) остаются.",
      variant: "danger",
      confirmLabel: "Удалить",
      bullets: [
        { label: `Будет удалено помещений: ${count}`, tone: "warn" },
        { label: "Отметки Т / Г / «/» в этих строках будут стёрты", tone: "warn" },
        { label: "Помещения остаются в /settings/buildings — удаляется только строка журнала" },
      ],
    });
    if (!ok) return;
    try {
      let nextConfig = config;
      for (const rowId of selection) {
        if (nextConfig.rooms.some((item) => item.id === rowId)) nextConfig = deleteCleaningRoomRow(nextConfig, rowId);
        else if (nextConfig.cleaningResponsibles.some((item) => item.id === rowId)) nextConfig = deleteCleaningResponsibleRow(nextConfig, "cleaning", rowId);
        else if (nextConfig.controlResponsibles.some((item) => item.id === rowId)) nextConfig = deleteCleaningResponsibleRow(nextConfig, "control", rowId);
      }
      setSelection([]);
      await patchDocument(nextConfig);
      toast.success(`Удалено строк: ${count}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить выбранные строки");
    }
  }


  async function submitResponsible() {
    if (!responsibleDialog) return;
    const responsible = createCleaningResponsibleRow({ kind: responsibleDialog.kind, title: responsibleDialog.title, userId: responsibleDialog.userId, userName: userNameById(props.users, responsibleDialog.userId) });
    const key = responsibleDialog.kind === "cleaning" ? "cleaningResponsibles" : "controlResponsibles";
    const currentItems = config[key];
    const updatedItems = responsibleDialog.id
      ? currentItems.map((item) =>
          item.id === responsibleDialog.id
            ? { ...responsible, id: responsibleDialog.id }
            : item,
        )
      : [...currentItems, responsible];
    const draft: CleaningDocumentConfig = { ...config, [key]: updatedItems };
    // В rooms-mode (race-режим) источник cleaning row — selectedCleanerUserIds,
    // а не cleaningResponsibles array. Без синка добавление через диалог
    // «Добавить отв. за уборку» не отображалось — bug сообщён юзером.
    // Контролёры всегда из controlResponsibles, поэтому для kind="control"
    // дополнительный sync не нужен.
    if (
      responsibleDialog.kind === "cleaning" &&
      (config.cleaningMode ?? "pairs") === "rooms" &&
      responsibleDialog.userId
    ) {
      const currentSelected = config.selectedCleanerUserIds ?? [];
      if (!currentSelected.includes(responsibleDialog.userId)) {
        draft.selectedCleanerUserIds = [
          ...currentSelected,
          responsibleDialog.userId,
        ];
      }
    }
    const nextConfig = normalizeCleaningDocumentConfig(draft, {
      users: props.users,
    });
    setResponsibleDialog(null);
    await patchDocument(nextConfig);
  }

  const cleaningUsers = getUsersForRoleLabel(props.users, settingsState.cleaningRole);
  const controlUsers = getUsersForRoleLabel(props.users, settingsState.controlRole);
  const responsibleUsers = responsibleDialog ? getUsersForRoleLabel(props.users, responsibleDialog.title) : [];

  const cleaningAddToolbar = (
    <>
        {/* Sticky под dashboard-хедером (он `sticky top-0 z-30 h-14`).
            top-14 чтобы не перекрывать хедер; z-20 чтобы хедер всегда был выше
            (без этого dropdown-trigger перекрывался невидимыми элементами хедера
            и клик «Добавить» не регистрировался). */}
        <div className="sticky top-14 z-20 -mx-4 space-y-2 border-b border-[#dcdfed] bg-white/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button className="h-10 rounded-xl bg-[#5566f6] px-5 text-[14px] text-white hover:bg-[#4a5bf0]"><Plus className="size-5" />Добавить<ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-3 shadow-xl sm:w-[340px]">
                    <DropdownMenuItem
                      className="h-9 rounded-xl text-[14px]"
                      onSelect={() => {
                        router.push("/settings/buildings");
                      }}
                    >
                      <Plus className="mr-3 size-4 text-[#5566f6]" />
                      Помещения в /settings/buildings
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9 rounded-xl text-[14px]" onSelect={() => setResponsibleDialog(buildResponsibleState("cleaning"))}><UserPlus className="mr-3 size-4 text-[#5566f6]" />Добавить отв. за уборку</DropdownMenuItem>
                    <DropdownMenuItem className="h-9 rounded-xl text-[14px]" onSelect={() => setResponsibleDialog(buildResponsibleState("control"))}><UserPlus className="mr-3 size-4 text-[#5566f6]" />Добавить отв. за контроль</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selection.length > 0 ? <Button type="button" variant="outline" className="h-9 rounded-xl border-[#ffd7d3] bg-[#fff4f2] px-3.5 text-[14px] text-[#a13a32] hover:bg-[#fff2f1]" onClick={() => { void deleteSelectedRows(); }}><Trash2 className="size-4" />Удалить</Button> : null}
              </div>
              {selection.length > 0 ? <div className="text-[14px] font-medium text-[#5566f6]">Выбрано: {selection.length}</div> : null}
            </div>
            {/* Bulk-cell toolbar (выходные / выделение / bulk-set) — sticky
                ВМЕСТЕ с add-toolbar выше, чтобы быть всегда видимым над
                таблицей при scroll'е по дате. Доступен и в pairs-mode, и
                в rooms-mode (админ может планировать матрицу заранее —
                completion-инициалы из TF webhook'а перекроют план поверху). */}
            {props.status === "active" ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                {/* «Заполнение ▾» — план + выходные в одном меню,
                    чтобы шапка не разрасталась в 15 кнопок. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#5566f6] bg-[#5566f6] px-3 py-1.5 font-medium text-white shadow-[0_6px_16px_-8px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
                    >
                      Заполнение
                      <ChevronDown className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[300px] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-3 shadow-xl">
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-3 text-[14px]"
                      onSelect={() => applySchedulePlan("fill-empty")}
                      title="Поставить T (текущая) и G (генеральная) во все пустые ячейки согласно weekday-плану помещений"
                    >
                      Заполнить по плану
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-3 text-[14px]"
                      onSelect={() => bulkSetHolidaysAndWeekends("/" as CleaningMatrixValue)}
                      title="Поставить «/» (не проводилась) на все выходные и праздники периода"
                    >
                      Отметить выходные «/»
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-3 text-[14px]"
                      onSelect={() => bulkSetHolidaysAndWeekends("" as CleaningMatrixValue)}
                      title="Очистить ячейки выходных и праздников периода"
                    >
                      Очистить выходные
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* «Выделение ▾» — режим мышкой + выделить всё. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition-colors ${cellSelectMode ? "bg-[#5566f6] text-white" : "bg-[#f5f6ff] text-[#5566f6] hover:bg-[#eef1ff]"}`}
                    >
                      {cellSelectMode ? "Выделение: ВКЛ" : "Выделение"}
                      <ChevronDown className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[320px] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-3 shadow-xl">
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-3 text-[14px]"
                      onSelect={() => {
                        if (cellSelectMode) {
                          setCellSelectMode(false);
                          clearCellSelection();
                        } else {
                          setCellSelectMode(true);
                        }
                      }}
                      title="ВКЛ: тяните мышью / пальцем от одного угла к другому, выделится прямоугольник как в Excel"
                    >
                      {cellSelectMode ? "Выключить выделение мышкой" : "Выделить мышкой"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-3 text-[14px]"
                      onSelect={selectAllCells}
                      title="Выделить все ячейки матрицы"
                    >
                      Выделить всё
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {cellSelectMode ? (
                  <>
                    <span className="text-[12px] text-[#6f7282]">
                      Выделено: <span className="font-semibold tabular-nums text-[#0b1024]">{selectedCells.size}</span>
                    </span>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("T" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#0b1024] transition-colors hover:bg-[#f5f6ff] disabled:opacity-40"
                    >
                      Т · Текущая
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("G" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#0b1024] transition-colors hover:bg-[#f5f6ff] disabled:opacity-40"
                    >
                      Г · Генеральная
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("/" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#ffd7d3] bg-[#fff4f2] px-3 py-1.5 font-medium text-[#a13a32] transition-colors hover:bg-[#fff2f1] disabled:opacity-40"
                    >
                      / · Не проводилась
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={() => bulkSetSelectedCells("" as CleaningMatrixValue)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-1.5 font-medium text-[#6f7282] transition-colors hover:bg-[#fafbff] disabled:opacity-40"
                    >
                      Очистить
                    </button>
                    <button
                      type="button"
                      disabled={selectedCells.size === 0}
                      onClick={clearCellSelection}
                      className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[12px] text-[#6f7282] hover:text-[#0b1024] disabled:opacity-40"
                    >
                      Сбросить
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
    </>
  );

  const cleaningRaceStrip = (
    <>
        {props.buildings && props.buildings.length > 0 ? (
          <div className="print:hidden">
          <CleaningRaceModeStrip
            enabled={(config.cleaningMode ?? "pairs") === "rooms"}
            raceMode={config.roomsRaceMode === true}
            roomCount={(config.selectedRoomIds ?? []).length}
            cleanerCount={(config.selectedCleanerUserIds ?? []).length}
            disabled={props.status !== "active" || saving}
            onToggle={async (enabled) => {
              await patchDocument({
                ...config,
                cleaningMode: enabled ? "rooms" : "pairs",
                // Когда включаем — сразу ставим roomsRaceMode=true. Без этого
                // адаптер падает в round-robin (cleaners[i % M] — половина
                // одному, половина другому) и пользователь думает что race
                // не работает. По умолчанию владелец хочет именно race.
                roomsRaceMode: enabled ? true : false,
                selectedRoomIds: config.selectedRoomIds ?? [],
                selectedCleanerUserIds: config.selectedCleanerUserIds ?? [],
              });
            }}
            onSwitchRace={async (race) => {
              await patchDocument({
                ...config,
                roomsRaceMode: race,
              });
            }}
            onConfigure={() => setRaceConfigOpen(true)}
          />
          </div>
        ) : null}
    </>
  );

  return (
    <>
      <div className="space-y-5">
        <FocusTodayScroller />
        <div className="print:hidden">
          <DocumentActionsBar
            backHref="/journals/cleaning"
            documentId={props.documentId}
            heading={
              <div>
                <h1 className={DOC_HEADING_CLASS}>
                  {config.documentTitle || CLEANING_PAGE_TITLE}
                </h1>
                <p className="mt-2 text-[15px] text-[#6f7282]">
                  {getCleaningPeriodLabel(props.dateFrom, props.dateTo)}
                  {saving ? " · Сохранение..." : ""}
                </p>
              </div>
            }
            onSettings={() => setSettingsOpen(true)}
            menuItems={[
              ...(props.hasTasksFlowIntegration
                ? [
                    {
                      key: "tf-sync",
                      label: tasksFlowSyncing ? "Обновляю…" : "Обновить из TasksFlow",
                      icon: (
                        <RefreshCw
                          className={`size-4 ${tasksFlowSyncing ? "animate-spin" : ""}`}
                        />
                      ),
                      title: "Подтянуть отметки выполнения из TasksFlow",
                      onSelect: () => void syncFromTasksFlow(),
                      disabled: tasksFlowSyncing,
                    },
                    {
                      key: "tf-cleanup",
                      label: cleanupCompletedRunning ? "Чищу…" : "Очистить TF архив",
                      icon: <Trash2 className="size-4" />,
                      title:
                        "Удалить выполненные задачи из TasksFlow (compliance-история сохранится в журнале)",
                      onSelect: () => void cleanupCompletedTasks(),
                      disabled: cleanupCompletedRunning,
                      tone: "danger" as const,
                    },
                  ]
                : []),
              {
                key: "save-as-template",
                label: "Сохранить как шаблон",
                icon: <Save className="size-4" />,
                title:
                  "Сохранить помещения, ответственных и шаги уборки как шаблон по умолчанию для новых журналов уборки",
                onSelect: () => setSaveAsTemplateOpen(true),
              },
              ...(props.status === "active"
                ? [
                    {
                      key: "close-journal",
                      label: "Закончить журнал",
                      icon: <Archive className="size-4" />,
                      onSelect: () => void closeAction.closeDocument(),
                      disabled: closeAction.isClosing,
                    },
                  ]
                : []),
            ]}
          />
        </div>

        {props.status !== "active" ? (
          <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать отметки, помещения и ответственных." />
        ) : null}

        {/* Автозаполнение — типографика в один масштаб с тулбаром ниже
            (text-[13px]/[14px], h-9), как в соседних журналах. */}
        <section className={`${DOC_AUTOFILL_STRIP_CLASS} border border-[#ececf4] bg-[#f5f6ff]`}>
          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-start">
            <div className="flex items-center gap-3"><Switch checked={config.autoFill.enabled} onCheckedChange={toggleAutoFill} disabled={props.status !== "active" || saving} className="data-[state=checked]:bg-[#5566f6] data-[state=unchecked]:bg-[#d4d8ec]" /><span className="text-[14px] font-semibold text-[#0b1024]">Автоматически заполнять журнал</span></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-[12px] font-medium text-[#6f7282]">Ответственный за уборку</Label><Select value={settingsState.cleaningUserId} disabled={props.status !== "active" || saving} onValueChange={(value) => updateSettings({ cleaningUserId: value })}><SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[14px]"><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger><SelectContent>{cleaningUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[12px] font-medium text-[#6f7282]">Ответственный за контроль</Label><Select value={settingsState.controlUserId} disabled={props.status !== "active" || saving} onValueChange={(value) => updateSettings({ controlUserId: value })}><SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[14px]"><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger><SelectContent>{controlUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-2.5"><Checkbox checked={config.autoFill.skipWeekends} onCheckedChange={(checked) => toggleSkipWeekends(Boolean(checked))} disabled={props.status !== "active" || saving} className="size-5 rounded-md" /><span className="text-[13px] text-[#3c4053]">Не заполнять в выходные дни</span></div>
          </div>
        </section>

        {/* Тулбар «Добавить»/«Заполнение»/«Выделение» и race-strip уборки
            переехали ПОД бумажную шапку и КАПС-заголовок, вплотную над
            таблицу — как на эталоне (cleaning-07-grid-with-room.png).
            В mobile-cards ветке те же узлы рендерятся выше карточек. */}
        {mobileView === "cards" ? (
          <div className="sm:hidden print:hidden">
            {cleaningAddToolbar}
            {cleaningRaceStrip}
          </div>
        ) : null}


        <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />

        {/* Mobile Cards view — hidden on sm+ and print. Each row (room or
            responsible) is an accordion with per-day tap-to-cycle cells. */}
        {mobileView === "cards" ? (
          <div className="space-y-2 sm:hidden print:hidden">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5 text-center text-[13px] text-[#6f7282]">
                Добавьте помещение или ответственного через меню «Добавить».
              </div>
            ) : null}
            {rows.map((row) => {
              const expanded = expandedRowId === row.id;
              const title = row.kind === "room" ? row.room.name : row.kind === "cleaning" ? "Ответственный за уборку" : "Ответственный за контроль";
              const subtitle = row.kind === "room" ? row.room.detergent : `${row.responsible.code} · ${row.responsible.userName || "—"}`;
              const filledCount = dayKeys.reduce((acc, dk) => acc + (cellValue(row, dk) ? 1 : 0), 0);
              const isSelected = selection.includes(row.id);
              return (
                <div key={row.id} className="rounded-2xl border border-[#ececf4] bg-white">
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span onClick={(event) => event.stopPropagation()} className="shrink-0">
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => setSelection((current) => Boolean(checked) ? [...current, row.id].filter((value, index, list) => list.indexOf(value) === index) : current.filter((id) => id !== row.id))} disabled={props.status !== "active"} className="size-5" />
                    </span>
                    <button type="button" onClick={() => setExpandedRowId(expanded ? null : row.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[#0b1024]">{title}</div>
                        {subtitle ? <div className="truncate text-[12px] text-[#6f7282]">{subtitle}</div> : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] font-semibold text-[#5566f6]">{filledCount}/{dayKeys.length}</span>
                      <ChevronDown className={`size-4 shrink-0 text-[#6f7282] transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {expanded ? (
                    <div className="border-t border-[#ececf4] p-3">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
                        {dayKeys.map((dateKey) => {
                          const cellVal = cellValue(row, dateKey);
                          const dayKind = getCalendarDayKind(dateKey);
                          const isOff = dayKind.kind === "holiday" || dayKind.kind === "weekend";
                          const isShort = dayKind.kind === "short";
                          const isSelected = selectedCells.has(cellKey(row.id, dateKey));
                          // Mobile-card cell — приоритет: selected > filled > off-day color > short > workday.
                          const cellCls = isSelected
                            ? "ring-2 ring-[#5566f6] border-[#5566f6] bg-[#eef1ff] text-[#5566f6]"
                            : cellVal
                              ? "border-[#5566f6] bg-[#f5f6ff] text-[#5566f6]"
                              : isOff
                                ? "border-[#ffd7d3] bg-[#fff4f2] text-[#a13a32]"
                                : isShort
                                  ? "border-[#ffe9b0] bg-[#fff8eb] text-[#b25f00]"
                                  : "border-[#ececf4] bg-white text-[#3c4053] hover:bg-[#f5f6ff]";
                          return (
                            <button
                              key={dateKey}
                              type="button"
                              title={dayKind.name ?? undefined}
                              onClick={() => { updateCell(row, dateKey).catch(() => {}); }}
                              onTouchStart={() => {
                                if (cellSelectMode) startDragOnCell(row.id, dateKey);
                              }}
                              onTouchMove={(e) => {
                                if (!cellSelectMode || !dragModeRef.current) return;
                                const touch = e.touches[0];
                                if (!touch) return;
                                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                                const cellEl = target?.closest?.("[data-cell-key]");
                                const k = cellEl?.getAttribute("data-cell-key");
                                if (!k) return;
                                const [r, d] = k.split("::");
                                if (r && d) continueDragOnCell(r, d);
                              }}
                              data-cell-key={cellKey(row.id, dateKey)}
                              disabled={props.status !== "active"}
                              className={`flex h-9 flex-col items-center justify-center rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-60 select-none ${cellCls}`}
                            >
                              <span className="text-[12px] font-semibold tabular-nums">{Number(dateKey.slice(-2))}</span>
                              <span className="text-[11px] leading-none">{cellVal || "—"}</span>
                            </button>
                          );
                        })}
                      </div>
                      {props.status === "active" ? (
                        <div className="mt-3 text-[11px] text-[#6f7282]">
                          {row.kind === "room" ? "Тап по дню перебирает Т / Г / пусто." : "Тап по дню переключает отметку ответственного."}
                        </div>
                      ) : null}
                      {row.kind === "room" ? (
                        <div className="mt-3 space-y-1 rounded-xl border border-[#ececf4] bg-[#fafbff] p-3 text-[12px] leading-5 text-[#3c4053]">
                          <div className="font-semibold text-[#0b1024]">Текущая:</div>
                          <div>{row.room.currentScope.join(", ") || "—"}</div>
                          <div className="mt-2 font-semibold text-[#0b1024]">Генеральная:</div>
                          <div>{row.room.generalScope.join(", ") || "—"}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {/* Mobile: 2 группированные карточки ответственных, симметрично
                desktop-таблице. Серый фон визуально отделяет от помещений. */}
            {cleaningResponsibleList.length > 0 ? (
              <div className="rounded-2xl border border-[#ececf4] bg-[#f6f6f6] p-3">
                <button
                  type="button"
                  disabled={props.status !== "active"}
                  onClick={() =>
                    setResponsibleDialog(
                      buildResponsibleState(
                        "cleaning",
                        cleaningResponsibleList[0],
                      ),
                    )
                  }
                  className="text-left text-[14px] font-medium text-[#0b1024] disabled:cursor-default"
                >
                  Ответственный за уборку
                </button>
                <div className="mt-1 text-[12px] leading-[1.55] text-[#3c4053]">
                  {cleaningResponsibleList.map((resp) => (
                    <div key={resp.id}>
                      <span className="font-semibold text-[#3848c7]">
                        {resp.code}
                      </span>{" "}
                      — {resp.userName || "—"}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {controlResponsibleList.length > 0 ? (
              <div className="rounded-2xl border border-[#ececf4] bg-[#f6f6f6] p-3">
                <button
                  type="button"
                  disabled={props.status !== "active"}
                  onClick={() =>
                    setResponsibleDialog(
                      buildResponsibleState(
                        "control",
                        controlResponsibleList[0],
                      ),
                    )
                  }
                  className="text-left text-[14px] font-medium text-[#0b1024] disabled:cursor-default"
                >
                  Ответственный за контроль
                </button>
                <div className="mt-1 text-[12px] leading-[1.55] text-[#3c4053]">
                  {controlResponsibleList.map((resp) => (
                    <div key={resp.id}>
                      <span className="font-semibold text-[#7a5cff]">
                        {resp.code}
                      </span>{" "}
                      — {resp.userName || "—"}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={mobileView === "cards" ? "hidden sm:block print:block" : ""}>
        <div className={DOC_BODY_STACK_CLASS}>
          {/* Официальный ХАССП-блок — общий компонент вместо самодельной
              таблицы с чёрными рамками (на экране — карточка дизайн-системы,
              в печати сам компонент возвращает бумажный вид). */}
          <div className={DOC_PAPER_HEADER_CLASS}>
            <JournalDocumentHeader
              orgName={props.organizationName}
              title={config.documentTitle || CLEANING_DOCUMENT_TITLE}
            />
          </div>
          <JournalDocumentTitle className={DOC_CAPS_TITLE_CLASS}>
            {config.documentTitle || CLEANING_PAGE_TITLE}
          </JournalDocumentTitle>
          {mobileView === "cards" ? null : (
            <>
              {cleaningAddToolbar}
              {cleaningRaceStrip}
            </>
          )}
          <div className={GRID_VIEWPORT_CLASS}><div className="min-w-[920px] sm:min-w-[1200px] print:min-w-0">
          <table className="w-full border-collapse text-[13px] print:text-[11px]"><thead><tr><th className={`w-12 p-2 ${GRID_HEAD_CELL_PLAIN_CLASS} print:hidden`}><Checkbox checked={rows.length > 0 && selection.length === rows.length} onCheckedChange={(checked) => setSelection(Boolean(checked) ? rows.map((r) => r.id) : [])} className="size-5" disabled={props.status !== "active"} /></th><th className={`px-2 py-1.5 font-semibold text-[#3c4053] ${GRID_HEAD_CELL_CLASS}`}>Наименование помещения</th><th className={`px-2 py-1.5 font-semibold text-[#3c4053] ${GRID_HEAD_CELL_CLASS}`}>Моющие и дезинфицирующие средства</th><th className={`px-2 py-1.5 font-semibold text-[#3c4053] ${GRID_HEAD_CELL_CLASS}`} colSpan={dayKeys.length}>Месяц {getCleaningPeriodLabel(props.dateFrom, props.dateTo)}</th></tr><tr><th className={`p-2 ${GRID_HEAD_CELL_PLAIN_CLASS} print:hidden`} /><th className={`p-2 ${GRID_HEAD_CELL_PLAIN_CLASS}`} /><th className={`p-2 ${GRID_HEAD_CELL_PLAIN_CLASS}`} />{dayKeys.map((dateKey) => <th key={dateKey} data-focus-today={dateKey === toDateKey(new Date()) ? "" : undefined} className={`p-2 text-[13px] font-semibold tabular-nums text-[#3c4053] ${GRID_HEAD_CELL_PLAIN_CLASS}`}>{Number(dateKey.slice(-2))}</th>)}</tr></thead><tbody>
            {rows.map((row) => {
              const title = row.kind === "room" ? row.room.name : row.kind === "cleaning" ? "Ответственный за уборку" : "Ответственный за контроль";
              const secondColumn = row.kind === "room" ? row.room.detergent : `${row.responsible.code} - ${row.responsible.userName || "—"}`;
              return <tr key={row.id} className="transition-colors hover:bg-[#fafbff] print:hover:bg-transparent">
                <td className={`p-2 text-center ${GRID_CELL_CLASS} print:hidden`}><Checkbox checked={selection.includes(row.id)} onCheckedChange={(checked) => setSelection((current) => Boolean(checked) ? [...current, row.id].filter((value, index, list) => list.indexOf(value) === index) : current.filter((id) => id !== row.id))} className="size-5" /></td>
                <td className={`px-2 py-1.5 align-middle ${GRID_CELL_CLASS}`}>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-left transition-colors hover:text-[#5566f6]"
                      disabled={props.status !== "active"}
                      onClick={() => {
                        if (row.kind === "room") {
                          openRoomEditorFromRow(row.id);
                        } else {
                          setResponsibleDialog(
                            buildResponsibleState(row.kind, row.responsible),
                          );
                        }
                      }}
                    >
                      {title}
                    </button>
                    {props.status === "active" ? (
                      <button
                        type="button"
                        aria-label="Редактировать"
                        className="rounded-lg p-1 text-[#7a7f93] transition-colors hover:bg-[#f5f6ff] hover:text-[#5566f6]"
                        onClick={() => {
                          if (row.kind === "room") {
                            openRoomEditorFromRow(row.id);
                          } else {
                            setResponsibleDialog(
                              buildResponsibleState(row.kind, row.responsible),
                            );
                          }
                        }}
                      >
                        <Pencil className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className={`px-2 py-1.5 text-[#3c4053] ${GRID_CELL_CLASS}`}>{secondColumn}</td>
                {dayKeys.map((dateKey) => {
                  const isSelected = selectedCells.has(cellKey(row.id, dateKey));
                  const dayKind = getCalendarDayKind(dateKey);
                  // Pastel-окраска по производственному календарю:
                  //   • holiday/weekend → красный пастель (#fff4f2)
                  //   • short          → жёлтый пастель (#fff8eb)
                  //   • workday        → прозрачный (чтобы hover строки был виден)
                  // Selected outline overlays поверх любого фона.
                  const dayBg =
                    dayKind.kind === "holiday" || dayKind.kind === "weekend"
                      ? "bg-[#fff4f2]"
                      : dayKind.kind === "short"
                        ? "bg-[#fff8eb]"
                        : "";
                  const interactive = props.status === "active";
                  const rawValue = cellValue(row, dateKey);
                  const displayValue = displayMatrixValue(rawValue);
                  const valueLabel = CLEANING_VALUE_LABELS[rawValue] ?? "не заполнено";
                  return (
                    <td
                      key={dateKey}
                      data-cell-key={cellKey(row.id, dateKey)}
                      title={dayKind.name ?? undefined}
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={`${title}, ${formatDayAriaLabel(dateKey)}: ${valueLabel}`}
                      className={`p-2 text-center text-[14px] select-none ${GRID_CELL_CLASS} ${interactive ? `cursor-pointer hover:bg-[#f5f6ff] ${CELL_FOCUS_CLASS}` : ""} ${dayBg} ${isSelected ? "outline outline-2 outline-offset-[-2px] outline-[#5566f6] !bg-[#eef1ff]" : ""}`}
                      onClick={() => {
                        // Если только что был drag — onClick после mouseup
                        // тоже срабатывает. Защищаемся: если в режиме
                        // selection и drag завершился, click игнорируем.
                        if (cellSelectMode) return;
                        updateCell(row, dateKey);
                      }}
                      onKeyDown={(event) => {
                        if (!interactive) return;
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        if (cellSelectMode) return;
                        void updateCell(row, dateKey);
                      }}
                      onMouseDown={(e) => {
                        if (!cellSelectMode) return;
                        e.preventDefault();
                        startDragOnCell(row.id, dateKey);
                      }}
                      onMouseEnter={() => continueDragOnCell(row.id, dateKey)}
                      onTouchStart={() => {
                        if (!cellSelectMode) return;
                        startDragOnCell(row.id, dateKey);
                      }}
                    >
                      {displayValue}
                    </td>
                  );
                })}
              </tr>;
            })}
            {/* Группированные строки ответственных по образцу haccp-online.
                Одна строка для всех уборщиков (С1-Имя1 / С2-Имя2 в первой
                колонке), одна для контролёров. Серый фон выделяет их от
                помещений. В ячейках per-day — кто работал/проверял в этот
                день (выводим коды С1/С2/К1 из реальных completions). */}
            {cleaningResponsibleList.length > 0 ? (
              <tr key="cleaning-group" className="bg-[#f8f9fc] print:bg-white">
                <td className={`p-2 text-center ${GRID_CELL_CLASS} print:hidden`} />
                <td className={`px-2 py-1.5 align-middle ${GRID_CELL_CLASS}`}>
                  <button
                    type="button"
                    disabled={props.status !== "active"}
                    onClick={() =>
                      setResponsibleDialog(
                        buildResponsibleState(
                          "cleaning",
                          cleaningResponsibleList[0],
                        ),
                      )
                    }
                    className="text-left transition-colors hover:text-[#5566f6] disabled:cursor-default"
                  >
                    Ответственный за уборку
                  </button>
                </td>
                <td className={`px-2 py-1.5 text-[13px] leading-[1.5] text-[#3c4053] ${GRID_CELL_CLASS}`}>
                  {cleaningResponsibleList.map((resp) => (
                    <div key={resp.id}>
                      {resp.code} - {resp.userName || "—"}
                    </div>
                  ))}
                </td>
                {dayKeys.map((dateKey) => {
                  const dayKind = getCalendarDayKind(dateKey);
                  const dayBg =
                    dayKind.kind === "holiday" || dayKind.kind === "weekend"
                      ? "bg-[#fff4f2]"
                      : dayKind.kind === "short"
                        ? "bg-[#fff8eb]"
                        : "";
                  const code = cleaningCodeForDay(dateKey);
                  const interactive = props.status === "active";
                  const cleaningCodes = cleaningResponsibleList.map((r) => r.code);
                  return (
                    <td
                      key={dateKey}
                      title={
                        interactive
                          ? `${dayKind.name ? dayKind.name + " · " : ""}Тап циклит: пусто → ${cleaningCodes.join(" → ")} → пусто`
                          : (dayKind.name ?? undefined)
                      }
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={`Ответственный за уборку, ${formatDayAriaLabel(dateKey)}: ${code || "не отмечено"}`}
                      onClick={
                        interactive
                          ? () =>
                              cycleSignature(
                                CLEANING_SIGNATURE_ROW_ID,
                                dateKey,
                                cleaningCodes,
                              )
                          : undefined
                      }
                      onKeyDown={(event) => {
                        if (!interactive) return;
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        void cycleSignature(
                          CLEANING_SIGNATURE_ROW_ID,
                          dateKey,
                          cleaningCodes,
                        );
                      }}
                      className={`p-2 text-center text-[13px] select-none ${GRID_CELL_CLASS} ${dayBg} ${interactive ? `cursor-pointer hover:bg-[#eef1ff] ${CELL_FOCUS_CLASS}` : ""}`}
                    >
                      {code}
                    </td>
                  );
                })}
              </tr>
            ) : null}
            {controlResponsibleList.length > 0 ? (
              <tr key="control-group" className="bg-[#f8f9fc] print:bg-white">
                <td className={`p-2 text-center ${GRID_CELL_CLASS} print:hidden`} />
                <td className={`px-2 py-1.5 align-middle ${GRID_CELL_CLASS}`}>
                  <button
                    type="button"
                    disabled={props.status !== "active"}
                    onClick={() =>
                      setResponsibleDialog(
                        buildResponsibleState(
                          "control",
                          controlResponsibleList[0],
                        ),
                      )
                    }
                    className="text-left transition-colors hover:text-[#5566f6] disabled:cursor-default"
                  >
                    Ответственный за контроль
                  </button>
                </td>
                <td className={`px-2 py-1.5 text-[13px] leading-[1.5] text-[#3c4053] ${GRID_CELL_CLASS}`}>
                  {controlResponsibleList.map((resp) => (
                    <div key={resp.id}>
                      {resp.code} - {resp.userName || "—"}
                    </div>
                  ))}
                </td>
                {dayKeys.map((dateKey) => {
                  const dayKind = getCalendarDayKind(dateKey);
                  const dayBg =
                    dayKind.kind === "holiday" || dayKind.kind === "weekend"
                      ? "bg-[#fff4f2]"
                      : dayKind.kind === "short"
                        ? "bg-[#fff8eb]"
                        : "";
                  const code = controlCodeForDay(dateKey);
                  const interactive = props.status === "active";
                  const controlCodes = controlResponsibleList.map((r) => r.code);
                  return (
                    <td
                      key={dateKey}
                      title={
                        interactive
                          ? `${dayKind.name ? dayKind.name + " · " : ""}Тап циклит: пусто → ${controlCodes.join(" → ")} → пусто`
                          : (dayKind.name ?? undefined)
                      }
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={`Ответственный за контроль, ${formatDayAriaLabel(dateKey)}: ${code || "не отмечено"}`}
                      onClick={
                        interactive
                          ? () =>
                              cycleSignature(
                                CONTROL_SIGNATURE_ROW_ID,
                                dateKey,
                                controlCodes,
                              )
                          : undefined
                      }
                      onKeyDown={(event) => {
                        if (!interactive) return;
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        void cycleSignature(
                          CONTROL_SIGNATURE_ROW_ID,
                          dateKey,
                          controlCodes,
                        );
                      }}
                      className={`p-2 text-center text-[13px] select-none ${GRID_CELL_CLASS} ${dayBg} ${interactive ? `cursor-pointer hover:bg-[#eef1ff] ${CELL_FOCUS_CLASS}` : ""}`}
                    >
                      {code}
                    </td>
                  );
                })}
              </tr>
            ) : null}
          </tbody></table>
          </div></div>

          {/* Условные обозначения — общий <JournalLegendBlock> вместо
              самодельного блока с regex-заменами латиницы на кириллицу. */}
          <JournalLegendBlock
            className={DOC_LEGEND_CLASS}
            items={Array.from(new Set(config.legend)).map(parseLegendItem)}
          />
          <div className="mt-3">
            <CleaningDayColorLegend />
          </div>

          <div className={`${DOC_EXTRA_BLOCK_CLASS} ${GRID_VIEWPORT_CLASS}`}><div className="min-w-[640px] sm:min-w-0">
          <table className="w-full border-collapse text-[13px] print:text-[11px]"><thead><tr><th className={`px-2 py-1.5 text-left font-semibold text-[#3c4053] ${GRID_HEAD_CELL_CLASS}`}>Наименование помещения</th><th className={`px-2 py-1.5 text-left font-semibold text-[#3c4053] ${GRID_HEAD_CELL_CLASS}`}>Текущая уборка</th><th className={`px-2 py-1.5 text-left font-semibold text-[#3c4053] ${GRID_HEAD_CELL_CLASS}`}>Генеральная уборка</th></tr></thead><tbody>{config.rooms.map((room) => <tr key={room.id} className="transition-colors hover:bg-[#fafbff] print:hover:bg-transparent"><td className={`px-2 py-1.5 ${GRID_CELL_CLASS}`}>{room.name}</td><td className={`px-2 py-1.5 text-[#3c4053] ${GRID_CELL_CLASS}`}>{room.currentScope.join(", ")}</td><td className={`px-2 py-1.5 text-[#3c4053] ${GRID_CELL_CLASS}`}>{room.generalScope.join(", ")}</td></tr>)}</tbody></table>
          </div></div>
        </div>
        </div>
      </div>

      <RoomEditorDialog
        open={roomEditor !== null}
        onOpenChange={(open) => {
          if (!open) setRoomEditor(null);
        }}
        initial={roomEditor}
        onSaved={async (snapshot) => {
          // Сначала auto-apply (использует snapshot для override и
          // patchDocument'ом отправляет matrix → API endpoint
          // syncTodayMatrixChanges → TF tasks обновляются).
          // Потом router.refresh() для re-build dbScheduleMap из БД.
          try {
            await autoApplyScheduleForRoom({
              id: snapshot.id,
              currentDays: snapshot.currentDays,
              generalDays: snapshot.generalDays,
              currentScheduleType: snapshot.currentScheduleType,
              generalScheduleType: snapshot.generalScheduleType,
              currentMonthDays: snapshot.currentMonthDays,
              generalMonthDays: snapshot.generalMonthDays,
            });
          } catch (err) {
            console.error("[room-editor] auto-apply failed", err);
          }
          router.refresh();
        }}
      />

      {/* Полная конфигурация race-режима — в диалоге. На странице видна
          только тонкая полоска с переключателем + сводкой. */}
      {props.buildings && props.buildings.length > 0 ? (
        <Dialog open={raceConfigOpen} onOpenChange={setRaceConfigOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden rounded-[24px] border-0 p-0 sm:max-w-[760px]">
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
                Настроить race-режим
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto px-2 py-2 sm:px-4 sm:py-4">
              <RoomsModeCard
                buildings={props.buildings}
                users={props.users}
                disabled={props.status !== "active" || saving}
                cleaningMode={config.cleaningMode ?? "pairs"}
                selectedRoomIds={config.selectedRoomIds ?? []}
                selectedCleanerUserIds={config.selectedCleanerUserIds ?? []}
                onSave={async (patch) => {
                  await patchDocument({
                    ...config,
                    cleaningMode: patch.cleaningMode,
                    selectedRoomIds: patch.selectedRoomIds,
                    selectedCleanerUserIds: patch.selectedCleanerUserIds,
                  });
                  setRaceConfigOpen(false);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={!!responsibleDialog} onOpenChange={(open) => !open && setResponsibleDialog(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden rounded-[24px] border-0 p-0 sm:max-w-[640px]">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Добавление ответственного лица
            </DialogTitle>
          </DialogHeader>
          {responsibleDialog ? (
            <>
              <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-[#3c4053]">Должность ответственного</Label>
                    <Select
                      value={responsibleDialog.title}
                      onValueChange={(value) => {
                        setResponsibleDialog((current) => current ? { ...current, title: value, userId: primaryUserId(props.users, value) } : current);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[14px]">
                        <SelectValue placeholder="— выберите —" />
                      </SelectTrigger>
                      <SelectContent>
                        <PositionSelectItems users={props.users} />
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
                    <Select
                      value={responsibleDialog.userId}
                      onValueChange={(value) => {
                        setResponsibleDialog((current) => current ? { ...current, userId: value } : current);
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[14px]">
                        <SelectValue placeholder="— выберите —" />
                      </SelectTrigger>
                      <SelectContent>
                        {responsibleUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full rounded-xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
                  onClick={() => setResponsibleDialog(null)}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
                  onClick={submitResponsible}
                >
                  {responsibleDialog.id ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

        <JournalSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          title="Настройки журнала"
          description="Название журнала и ответственные. Изменения применяются ко всему периоду документа."
          size="md"
          isSaving={saving}
          onSave={async () => {
            await updateSettings({});
            setSettingsOpen(false);
          }}
          onCancel={() => setSettingsOpen(false)}
        >
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Название документа
            </Label>
            <Input
              value={settingsState.title}
              onChange={(event) =>
                setSettingsState((current) => ({ ...current, title: event.target.value }))
              }
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Должность ответственного за уборку
            </Label>
            <Select
              value={settingsState.cleaningRole}
              onValueChange={(value) =>
                setSettingsState((current) => ({
                  ...current,
                  cleaningRole: value,
                  cleaningUserId: primaryUserId(props.users, value),
                }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={props.users} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Сотрудник
            </Label>
            <Select
              value={settingsState.cleaningUserId}
              onValueChange={(value) =>
                setSettingsState((current) => ({ ...current, cleaningUserId: value }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                {getUsersForRoleLabel(props.users, settingsState.cleaningRole).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Должность ответственного за контроль
            </Label>
            <Select
              value={settingsState.controlRole}
              onValueChange={(value) =>
                setSettingsState((current) => ({
                  ...current,
                  controlRole: value,
                  controlUserId: primaryUserId(props.users, value),
                }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={props.users} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Сотрудник
            </Label>
            <Select
              value={settingsState.controlUserId}
              onValueChange={(value) =>
                setSettingsState((current) => ({ ...current, controlUserId: value }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                {getUsersForRoleLabel(props.users, settingsState.controlRole).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline mode — определяет, как сотрудник видит подзадачи в TasksFlow.
              Раньше всегда был perRoom (у каждой комнаты свой scope). Теперь
              менеджер может выбрать один общий список или отключить вовсе. */}
          <div className="space-y-3 rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4">
            <div>
              <Label className="text-[13px] font-semibold text-[#0b1024]">
                Подзадачи в TasksFlow (pipeline)
              </Label>
              <p className="mt-1 text-[12px] leading-[1.55] text-[#6f7282]">
                Как сотрудник видит чек-лист в задаче на уборку:
              </p>
            </div>
            <div className="grid gap-2">
              {([
                {
                  value: "perRoom" as const,
                  title: "По помещениям (рекомендуется)",
                  desc: "У каждой комнаты свой список шагов. Удобно когда уборка в кухне отличается от уборки в баре.",
                },
                {
                  value: "global" as const,
                  title: "Общий список",
                  desc: "Один список шагов, одинаковый для всех помещений. Удобно когда протокол простой и единый.",
                },
                {
                  value: "legacy" as const,
                  title: "Без чек-листа (legacy)",
                  desc: "Сотрудник просто отмечает «сделано», без разбивки на шаги. Подзадач в TasksFlow не будет.",
                },
              ]).map((opt) => {
                const isActive = (config.cleaningSubtaskMode ?? "perRoom") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCleaningSubtaskMode(opt.value)}
                    disabled={saving}
                    className={`text-left rounded-2xl border px-4 py-3 transition-colors disabled:opacity-60 ${
                      isActive
                        ? "border-[#5566f6] bg-white shadow-[0_0_0_4px_rgba(85,102,246,0.12)]"
                        : "border-[#ececf4] bg-white hover:border-[#5566f6]/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          isActive ? "border-[#5566f6] bg-[#5566f6]" : "border-[#dcdfed] bg-white"
                        }`}
                      >
                        {isActive ? <div className="size-1.5 rounded-full bg-white" /> : null}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-[#0b1024]">{opt.title}</div>
                        <p className="mt-0.5 text-[12px] leading-[1.5] text-[#6f7282]">{opt.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {(config.cleaningSubtaskMode ?? "perRoom") === "global" ? (
              <div className="space-y-3 rounded-2xl border border-[#dcdfed] bg-white p-3">
                <div>
                  <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                    Общий список — текущая уборка
                  </Label>
                  <p className="mt-1 text-[12px] leading-[1.5] text-[#6f7282]">
                    Эти шаги увидит каждый сотрудник при уборке любого помещения (текущая).
                  </p>
                </div>
                <ScopeListEditor
                  value={config.globalSubtasks?.current ?? []}
                  onChange={(next) => { void setGlobalSubtasks({ current: next }); }}
                  placeholder="Например: Протереть рабочие поверхности"
                  addLabel="Добавить шаг текущей"
                  emptyHint="Шагов пока нет — добавьте первый шаг ниже."
                />
                <div className="border-t border-[#ececf4] pt-3">
                  <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                    Общий список — генеральная уборка
                  </Label>
                </div>
                <ScopeListEditor
                  value={config.globalSubtasks?.general ?? []}
                  onChange={(next) => { void setGlobalSubtasks({ general: next }); }}
                  placeholder="Например: Демонтировать съёмные части и промыть в горячей воде"
                  addLabel="Добавить шаг генеральной"
                  emptyHint="Шагов пока нет — добавьте первый шаг ниже."
                />
              </div>
            ) : null}
          </div>
        </JournalSettingsModal>
      <Dialog open={saveAsTemplateOpen} onOpenChange={setSaveAsTemplateOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-0 sm:max-w-[520px]">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Сохранить как шаблон по умолчанию
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 py-5">
            <p className="text-[14px] leading-[1.55] text-[#3c4053]">
              Текущие настройки журнала будут сохранены как шаблон для всей организации.
              Все <strong>новые</strong> журналы уборки будут автоматически создаваться с этими помещениями, ответственными, шагами и днями уборки.
            </p>
            <ul className="space-y-1.5 rounded-2xl bg-[#fafbff] px-4 py-3 text-[13px] text-[#3c4053]">
              <li>• Помещений: <strong>{config.rooms.length}</strong></li>
              <li>• Ответственных за уборку: <strong>{config.cleaningResponsibles.length}</strong></li>
              <li>• Ответственных за контроль: <strong>{config.controlResponsibles.length}</strong></li>
              <li>• Шагов текущей уборки (всего): <strong>{config.rooms.reduce((acc, r) => acc + r.currentScope.length, 0)}</strong></li>
              <li>• Шагов генеральной уборки (всего): <strong>{config.rooms.reduce((acc, r) => acc + r.generalScope.length, 0)}</strong></li>
            </ul>
            <p className="text-[12px] leading-[1.5] text-[#6f7282]">
              Текущий журнал и матрица отметок не изменятся. Шаблон не затронет уже созданные журналы.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full rounded-xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
              onClick={() => setSaveAsTemplateOpen(false)}
              disabled={saveAsTemplateBusy}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
              onClick={handleSaveAsTemplate}
              disabled={saveAsTemplateBusy}
            >
              {saveAsTemplateBusy ? "Сохранение..." : "Сохранить шаблон"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Карточка настройки rooms-режима для journal-уборки.
 * Появляется только если у org заведены здания/помещения в /settings/buildings.
 *
 * При cleaningMode="rooms" daily fan-out создаст одну race-задачу на
 * каждое выбранное помещение (на каждого выбранного уборщика). Кто
 * первый закроет — забрал. В конце дня контролёр получит сводную
 * задачу о том что нужно проверить.
 *
 * Сейчас (Этап 2a/b) сохраняем только конфиг. Race-логика подключится
 * в Этапе 2c вместе с расширением cleaning adapter.
 */

/**
 * Компактная полоска вместо большой `RoomsModeCard` на странице журнала.
 * Один переключатель + сводка («4 помещения · 2 уборщика») + кнопка
 * «Настроить» открывает диалог с полным редактором. Сделано по запросу
 * владельца: «сократи как можно больше этого, чтобы просто можно было
 * включить и всё».
 */
function CleaningRaceModeStrip(props: {
  enabled: boolean;
  raceMode: boolean;
  roomCount: number;
  cleanerCount: number;
  disabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  onSwitchRace: (race: boolean) => Promise<void>;
  onConfigure: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#ececf4] bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-[14px] font-medium text-[#0b1024]">
          <input
            type="checkbox"
            checked={props.enabled}
            disabled={props.disabled}
            onChange={(e) => {
              void props.onToggle(e.target.checked);
            }}
            className="size-4 cursor-pointer accent-[#5566f6]"
          />
          Раздавать задачи по помещениям
        </label>
        {props.enabled ? (
          <span className="text-[13px] text-[#6f7282]">
            Помещений: <span className="font-semibold tabular-nums text-[#0b1024]">{props.roomCount}</span>
            {" · "}
            Уборщиков: <span className="font-semibold tabular-nums text-[#0b1024]">{props.cleanerCount}</span>
          </span>
        ) : (
          <span className="text-[13px] text-[#9b9fb3]">Выключено — обычный режим «1 пара уборщик-контролёр в день»</span>
        )}
        <button
          type="button"
          onClick={props.onConfigure}
          disabled={props.disabled}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Настроить
        </button>
      </div>
      {props.enabled && props.cleanerCount > 1 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#ececf4] pt-2.5 text-[13px]">
          <span className="text-[#6f7282]">Распределение между уборщиками:</span>
          <div className="inline-flex rounded-xl border border-[#dcdfed] bg-[#fafbff] p-0.5">
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => {
                if (!props.raceMode) void props.onSwitchRace(true);
              }}
              className={`inline-flex h-7 items-center rounded-lg px-3 text-[12.5px] font-medium transition-colors ${
                props.raceMode
                  ? "bg-white text-[#0b1024] shadow-[0_0_0_1px_#dcdfed]"
                  : "text-[#6f7282] hover:text-[#0b1024]"
              }`}
              title="На каждое помещение задача отправляется ВСЕМ уборщикам. Кто первый — тот и закрепил за собой."
            >
              Гонка (кто первый)
            </button>
            <button
              type="button"
              disabled={props.disabled}
              onClick={() => {
                if (props.raceMode) void props.onSwitchRace(false);
              }}
              className={`inline-flex h-7 items-center rounded-lg px-3 text-[12.5px] font-medium transition-colors ${
                !props.raceMode
                  ? "bg-white text-[#0b1024] shadow-[0_0_0_1px_#dcdfed]"
                  : "text-[#6f7282] hover:text-[#0b1024]"
              }`}
              title="Помещения делятся между уборщиками поровну. Уборщик 1 делает комнаты 0,2,4..., уборщик 2 — 1,3,5..."
            >
              Поделить поровну
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type RoomsModeCardProps = {
  buildings: Array<{
    id: string;
    name: string;
    rooms: Array<{ id: string; name: string; kind: string }>;
  }>;
  users: UserItem[];
  disabled: boolean;
  cleaningMode: "pairs" | "rooms";
  selectedRoomIds: string[];
  selectedCleanerUserIds: string[];
  onSave: (patch: {
    cleaningMode: "pairs" | "rooms";
    selectedRoomIds: string[];
    selectedCleanerUserIds: string[];
  }) => Promise<void>;
};

function RoomsModeCard(props: RoomsModeCardProps) {
  const [mode, setMode] = useState<"pairs" | "rooms">(props.cleaningMode);
  const [rooms, setRooms] = useState<string[]>(props.selectedRoomIds);
  const [cleaners, setCleaners] = useState<string[]>(
    props.selectedCleanerUserIds
  );
  const [busy, setBusy] = useState(false);

  function toggleRoom(id: string) {
    setRooms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function toggleCleaner(id: string) {
    setCleaners((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    setBusy(true);
    try {
      await props.onSave({
        cleaningMode: mode,
        selectedRoomIds: rooms,
        selectedCleanerUserIds: cleaners,
      });
    } finally {
      setBusy(false);
    }
  }

  // Кандидаты на role «cleaner»: позиция «Уборщик» + cook-роль.
  const cleanerCandidates = props.users.filter((u) =>
    /уборщик|cleaner/i.test(`${u.name} ${u.role}`)
  );
  const allStaffCandidates = props.users; // fallback — если фильтр пустой
  const cleanersList =
    cleanerCandidates.length > 0 ? cleanerCandidates : allStaffCandidates;

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3848c7]">
            Режим уборки
          </div>
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
            Race-задачи на помещения
          </h3>
          <p className="mt-1 max-w-[640px] text-[13px] leading-[1.55] text-[#6f7282]">
            Если включить — каждое выбранное помещение в каждый рабочий
            день станет отдельной задачей. Любой из выбранных уборщиков
            может её закрыть; кто первый — тот и закрепил за собой
            (остальные у него исчезают). Контролёр получит одну сводную
            задачу в конце дня.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-[#0b1024]">
          <input
            type="checkbox"
            checked={mode === "rooms"}
            disabled={props.disabled}
            onChange={(e) => setMode(e.target.checked ? "rooms" : "pairs")}
            className="size-4 cursor-pointer accent-[#5566f6]"
          />
          Включить
        </label>
      </div>

      {mode === "rooms" ? (
        <div className="space-y-5">
          {/* Помещения */}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Помещения, по которым раздавать задачи
            </div>
            {props.buildings.map((b) => (
              <div key={b.id} className="mb-3">
                <div className="mb-1.5 text-[13px] font-medium text-[#3c4053]">
                  {b.name}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {b.rooms.length === 0 ? (
                    <span className="text-[12px] text-[#9b9fb3]">
                      Нет помещений в этом здании. Заведите в{" "}
                      <a href="/settings/buildings" className="text-[#5566f6] underline">
                        /settings/buildings
                      </a>
                      .
                    </span>
                  ) : (
                    b.rooms.map((r) => {
                      const active = rooms.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={props.disabled}
                          onClick={() => toggleRoom(r.id)}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-2xl border px-3 text-[13px] font-medium transition-colors ${
                            active
                              ? "border-[#5566f6] bg-[#f5f6ff] text-[#3848c7]"
                              : "border-[#dcdfed] bg-white text-[#6f7282] hover:border-[#5566f6]/50 hover:bg-[#f5f6ff]"
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Уборщики */}
          <div>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Уборщики (race) — кто может забирать задачи
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cleanersList.map((u) => {
                const active = cleaners.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={props.disabled}
                    onClick={() => toggleCleaner(u.id)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-2xl border px-3 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-[#5566f6] bg-[#f5f6ff] text-[#3848c7]"
                        : "border-[#dcdfed] bg-white text-[#6f7282] hover:border-[#5566f6]/50 hover:bg-[#f5f6ff]"
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Контролёр / ответственные настраиваются в одном месте — не дублируем. */}
          <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 text-[13px] leading-[1.55] text-[#3c4053]">
            <span className="font-medium text-[#0b1024]">Кто проверяет?</span>{" "}
            Контролёр и ответственные за этот журнал настраиваются на странице{" "}
            <a
              href="/settings/journal-responsibles/cleaning"
              className="font-medium text-[#5566f6] hover:text-[#4a5bf0]"
            >
              /settings/journal-responsibles
            </a>
            . Здесь — только включить race-режим и выбрать комнаты + уборщиков.
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-3 text-[13px] text-[#6f7282]">
          Выключено — журнал работает в классическом режиме «1 задача на
          пару уборщик-контролёр в день».
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={props.disabled || busy}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#c8cbe0]"
        >
          {busy ? "Сохраняем…" : "Сохранить настройки"}
        </button>
      </div>
    </section>
  );
}
