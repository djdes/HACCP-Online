"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  StaffJournalAddButton,
  StaffJournalToolbar,
} from "@/components/journals/staff-journal-toolbar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_LEGEND_CLASS,
  DOC_NOTE_TEXT_CLASS,
  DOC_PAPER_CANVAS_CLASS,
  DOC_PAPER_HEADER_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import {
  TableContextMenu,
  type TableContextMenuItem,
} from "@/components/journals/table-context-menu";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import {
  JournalDocumentTitle,
  JournalLegendBlock,
  JournalPaperHeaderRows,
} from "@/components/journals/journal-document-header";
import { MobileViewToggle } from "@/components/journals/mobile-view-toggle";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  HYGIENE_REGISTER_LEGEND,
  HYGIENE_REGISTER_NOTES,
  HYGIENE_STATUS_OPTIONS,
  buildDateKeys,
  buildHygieneExampleEmployees,
  formatMonthLabel,
  getDayNumber,
  getHygieneDefaultResponsibleTitle,
  getHygienePositionLabel,
  getStatusMeta,
  normalizeHygieneEntryData,
  toDateKey,
  type HygieneEntryData,
  type HygieneStatus,
} from "@/lib/hygiene-document";

import { toast } from "sonner";
import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_VIEWPORT_WIDE_CLASS as GRID_VIEWPORT_CLASS,
  getDayColumnBgClass,
} from "@/components/journals/journal-grid";
type Props = {
  documentId: string;
  routeCode?: string;
  title: string;
  organizationName: string;
  /**
   * «Периодичность контроля» — вторая строка бумажной шапки документа
   * (`config.controlPeriodicity`, дефолт — из реестра шаблонов).
   * Пустая строка ⇒ строка в шапке не рендерится.
   */
  controlPeriodicity?: string;
  dateFrom: string;
  dateTo: string;
  responsibleTitle: string | null;
  responsibleUserId?: string | null;
  responsibleName: string | null;
  status: string;
  autoFill?: boolean;
  employees: { id: string; name: string; role: string }[];
  initialEntries: { employeeId: string; date: string; data: HygieneEntryData }[];
  /** Design v2 flag — пробрасывается в StaffJournalToolbar для v2-модалки. */
  useV2?: boolean;
};

/**
 * Screen ↔ print duality tokens (тот же приём, что в
 * `cleaning-document-client.tsx`).
 *
 * НА ЭКРАНЕ гигиенический журнал должен читаться как часть WeSetup:
 * мягкие границы `#ececf4`, серо-голубая шапка, скруглённый viewport.
 * ПРИ ПЕЧАТИ (Ctrl+P) инспектор РПН/СЭС ждёт «бумагу» — чёрные рамки
 * без заливок. Поэтому каждый токен несёт пару screen + `print:`.
 */

const STATUS_CYCLE: Array<HygieneStatus | null> = [
  null,
  "healthy",
  "day_off",
  "sick_leave",
  "suspended",
  "vacation",
];

function HygieneCheckbox(props: {
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={props.checked}
      disabled={props.disabled}
      onCheckedChange={(value) => props.onCheckedChange?.(value === true)}
      className="mx-auto size-4 rounded-[4px] border-[#c8ccda]"
    />
  );
}

function HygieneHeader({
  pageLabel,
  organizationLabel,
  startedAt,
  finishedAt,
  controlPeriodicity,
}: {
  pageLabel: string;
  organizationLabel: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  controlPeriodicity?: string;
}) {
  return (
    <table className="hygiene-header w-full border-collapse text-[13px]">
      <tbody>
        <JournalPaperHeaderRows
          orgName={organizationLabel}
          title="ГИГИЕНИЧЕСКИЙ ЖУРНАЛ"
          pageInfo={pageLabel}
          startedAt={startedAt}
          finishedAt={finishedAt}
          controlPeriodicity={controlPeriodicity}
          orgCellClass="w-[270px]"
          sideCellClass="w-[190px]"
        />
      </tbody>
    </table>
  );
}

/**
 * ПКМ-меню по ячейке гигиенического журнала.
 *
 * ЛКМ остаётся тап-циклом (Зд. → В → Б/л → От → Отп → пусто) — это быстрый
 * путь для ежедневной рутины. Но чтобы поставить «Отп» одним движением
 * (а не пятью кликами), нужен прямой выбор — как диалог «Редактирование
 * ячейки» на эталоне lk.haccp-online.ru. Правая кнопка открывает список
 * всех вариантов прямо у курсора.
 *
 * Меню рендерится ОДИН раз на документ (не по ячейке на ячейку): в сетке
 * до 31 дня × N сотрудников это тысячи ячеек, и Radix-триггер на каждой
 * стоил бы заметного времени монтирования.
 */
type HygieneCellMenu = {
  x: number;
  y: number;
  employeeId: string;
  dateKey: string;
  kind: "status" | "temperature";
};

const HYGIENE_TEMPERATURE_OPTIONS: Array<{
  value: boolean;
  code: string;
  label: string;
}> = [
  { value: false, code: "нет", label: "температура в норме" },
  { value: true, code: "да", label: "температура выше 37°C" },
];

function makeCellKey(employeeId: string, dateKey: string) {
  return `${employeeId}:${dateKey}`;
}

function buildEntryMap(entries: Props["initialEntries"]) {
  const result: Record<string, HygieneEntryData> = {};

  entries.forEach((entry) => {
    result[makeCellKey(entry.employeeId, entry.date)] = normalizeHygieneEntryData(entry.data);
  });

  return result;
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      (result && typeof result.error === "string" && result.error) || "Операция не выполнена"
    );
  }

  return result;
}

function getTemperatureLabel(entry?: HygieneEntryData) {
  if (entry?.temperatureAbove37 === false) return "нет";
  if (entry?.temperatureAbove37 === true) return "да";
  if (entry?.temperatureAbove37 === null && entry?.status === "day_off") return "-";
  return "";
}

function getNextStatus(current?: HygieneStatus | null) {
  const currentIndex = STATUS_CYCLE.findIndex((status) => status === (current ?? null));
  return STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
}

function buildEntryForStatus(nextStatus: HygieneStatus | null, current?: HygieneEntryData) {
  if (!nextStatus) return {};
  if (nextStatus === "healthy") {
    return {
      status: "healthy" as const,
      temperatureAbove37: current?.temperatureAbove37 === true,
    };
  }

  return {
    status: nextStatus,
    temperatureAbove37: null,
  };
}

export function HygieneDocumentClient({
  documentId,
  routeCode,
  title,
  organizationName,
  controlPeriodicity = "",
  dateFrom,
  dateTo,
  responsibleTitle,
  responsibleUserId = null,
  status,
  autoFill = false,
  employees,
  initialEntries,
  useV2 = false,
}: Props) {
  const router = useRouter();
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [entryMap, setEntryMap] = useState<Record<string, HygieneEntryData>>(() =>
    buildEntryMap(initialEntries)
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [cellMenu, setCellMenu] = useState<HygieneCellMenu | null>(null);
  // Mobile-only view preference: 'cards' (default) vs 'table' (horizontal
  // scroll of the full sheet). Общий хук `useMobileView` — тот же, что в
  // cleaning / disinfectant, ключ `journal-mobile-view:hygiene`. Desktop и
  // печать всегда рендерят таблицу.
  const { mobileView, switchMobileView } = useMobileView("hygiene");
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(
    null
  );

  useEffect(() => {
    setEntryMap(buildEntryMap(initialEntries));
  }, [initialEntries]);

  // Закрытие ПКМ-меню (клик вне, Escape, скролл, ресайз) живёт внутри
  // `TableContextMenu` — здесь нужен только стабильный колбэк.
  const closeCellMenu = useCallback(() => setCellMenu(null), []);

  // Миграция со старого ключа "hygiene-mobile-view" (до перехода на общий
  // useMobileView). Читаем один раз: если нового ключа ещё нет, а старый
  // лежит — переносим выбор пользователя и чистим легаси. Эффект объявлен
  // ПОСЛЕ useMobileView, поэтому его restore-эффект уже отработал.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("journal-mobile-view:hygiene")) return;
      const legacy = window.localStorage.getItem("hygiene-mobile-view");
      if (legacy === "table" || legacy === "cards") switchMobileView(legacy);
      window.localStorage.removeItem("hygiene-mobile-view");
    } catch {
      /* localStorage blocked — остаёмся на дефолте 'cards' */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateKeys = buildDateKeys(dateFrom, dateTo);
  const includedEmployeeIds = [...new Set(initialEntries.map((entry) => entry.employeeId))];
  // Строки сетки = сотрудники, у которых есть entries документа. Если
  // пересечение пустое (документ создан до посева строк, либо посев не
  // нашёл ни одного сотрудника по JobPositionJournalAccess, либо все
  // employeeId из entries больше не активны) — падаем на весь активный
  // ростер организации. Без этого fallback'а сетка рисовала 7 безымянных
  // строк-заглушек: «№ п/п», «Ф.И.О.» и «Должность» пустые у всех строк,
  // а чекбокс выделения не рендерился вовсе (он привязан к employee.name).
  const matchedRosterUsers = employees.filter((employee) =>
    includedEmployeeIds.includes(employee.id)
  );
  const rosterUsers = matchedRosterUsers.length > 0 ? matchedRosterUsers : employees;
  const printableEmployees = buildHygieneExampleEmployees(
    rosterUsers,
    Math.max(rosterUsers.length, 7)
  );
  const organizationLabel = organizationName || 'ООО "Тест"';
  const responsibleLabel = responsibleTitle || getHygieneDefaultResponsibleTitle(employees);
  const documentTitle = title || "Гигиенический журнал";
  const monthLabel = formatMonthLabel(dateFrom, dateTo);
  const selectedCount = selectedEmployeeIds.length;
  const allSelected = rosterUsers.length > 0 && selectedCount === rosterUsers.length;
  const isActive = status === "active";

  function toggleEmployee(employeeId: string, checked: boolean) {
    setSelectedEmployeeIds((current) =>
      checked ? [...new Set([...current, employeeId])] : current.filter((item) => item !== employeeId)
    );
  }

  /**
   * «Выбрать всё» — общий хендлер для чекбокса шапки и чекбокса служебной
   * строки «Должность ответственного за контроль». На эталоне галочка у
   * служебной строки бланка отмечает весь список сотрудников, а не саму
   * строку (строка — часть шапки бланка, её нельзя удалить).
   */
  function toggleAllEmployees(checked: boolean) {
    if (!isActive) return;
    setSelectedEmployeeIds(checked ? rosterUsers.map((employee) => employee.id) : []);
  }

  async function persistEntry(employeeId: string, dateKey: string, nextData: HygieneEntryData) {
    const key = makeCellKey(employeeId, dateKey);
    const previous = entryMap[key];

    setEntryMap((current) => ({ ...current, [key]: nextData }));
    setSavingCellKey(key);

    try {
      await requestJson(`/api/journal-documents/${documentId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          date: dateKey,
          data: nextData,
        }),
      });
    } catch (error) {
      setEntryMap((current) => {
        const copy = { ...current };
        if (previous && Object.keys(previous).length > 0) {
          copy[key] = previous;
        } else {
          delete copy[key];
        }
        return copy;
      });
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSavingCellKey((current) => (current === key ? null : current));
    }
  }

  async function handleDeleteSelected() {
    if (!isActive || selectedEmployeeIds.length === 0) return;

    setIsDeleting(true);
    try {
      await Promise.all(
        selectedEmployeeIds.map((employeeId) =>
          requestJson(`/api/journal-documents/${documentId}/entries`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId }),
          })
        )
      );
      setSelectedEmployeeIds([]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка удаления строк");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleStatusClick(employeeId: string, dateKey: string) {
    if (!isActive) return;

    const key = makeCellKey(employeeId, dateKey);
    const current = normalizeHygieneEntryData(entryMap[key]);
    const nextStatus = getNextStatus(current.status);
    const nextData = buildEntryForStatus(nextStatus, current);

    await persistEntry(employeeId, dateKey, nextData);
  }

  async function handleTemperatureClick(employeeId: string, dateKey: string) {
    if (!isActive) return;

    const key = makeCellKey(employeeId, dateKey);
    const current = normalizeHygieneEntryData(entryMap[key]);

    const nextData: HygieneEntryData =
      current.status === "healthy"
        ? {
            status: "healthy",
            temperatureAbove37: current.temperatureAbove37 === true ? false : true,
          }
        : {
            status: "healthy",
            temperatureAbove37: false,
          };

    await persistEntry(employeeId, dateKey, nextData);
  }

  /**
   * Открыть ПКМ-меню. `preventDefault` вызываем ТОЛЬКО на интерактивных
   * ячейках активного документа: в закрытом журнале и в пустых
   * строках-заглушках должно остаться нативное меню браузера.
   */
  function openCellMenu(
    event: React.MouseEvent,
    employeeId: string,
    dateKey: string,
    kind: HygieneCellMenu["kind"],
    interactive: boolean
  ) {
    if (!isActive || !interactive) return;
    event.preventDefault();
    event.stopPropagation();
    // Координаты кладём «как есть»: прижатие к краям вьюпорта делает
    // `TableContextMenu` по реальному замеру меню.
    setCellMenu({
      x: event.clientX,
      y: event.clientY,
      employeeId,
      dateKey,
      kind,
    });
  }

  /** Запись значения из меню — той же логикой, что и `handleStatusClick`. */
  async function applyMenuStatus(menu: HygieneCellMenu, next: HygieneStatus | null) {
    const key = makeCellKey(menu.employeeId, menu.dateKey);
    const current = normalizeHygieneEntryData(entryMap[key]);
    await persistEntry(
      menu.employeeId,
      menu.dateKey,
      buildEntryForStatus(next, current)
    );
  }

  async function applyMenuTemperature(
    menu: HygieneCellMenu,
    next: boolean | null
  ) {
    const key = makeCellKey(menu.employeeId, menu.dateKey);
    const current = normalizeHygieneEntryData(entryMap[key]);

    if (next === null) {
      // «Очистить» на строке температуры — снимаем только отметку T°,
      // статус сотрудника за этот день трогать нельзя.
      await persistEntry(menu.employeeId, menu.dateKey, {
        ...current,
        temperatureAbove37: null,
      });
      return;
    }

    await persistEntry(menu.employeeId, menu.dateKey, {
      status: current.status ?? "healthy",
      temperatureAbove37: next,
    });
  }

  /**
   * Пункты ПКМ-меню для конкретной ячейки. Текущее значение помечается
   * `active` — на эталоне выбранный вариант тоже подсвечен, иначе перед
   * кликом непонятно, что в ячейке уже стоит.
   */
  function buildCellMenuItems(menu: HygieneCellMenu): TableContextMenuItem[] {
    const current = normalizeHygieneEntryData(
      entryMap[makeCellKey(menu.employeeId, menu.dateKey)]
    );

    const options: TableContextMenuItem[] =
      menu.kind === "status"
        ? HYGIENE_STATUS_OPTIONS.map((option) => ({
            key: option.value,
            code: option.code,
            label: option.label,
            active: current.status === option.value,
            onSelect: () => {
              applyMenuStatus(menu, option.value).catch(() => {});
            },
          }))
        : HYGIENE_TEMPERATURE_OPTIONS.map((option) => ({
            key: String(option.value),
            code: option.code,
            label: option.label,
            active: current.temperatureAbove37 === option.value,
            onSelect: () => {
              applyMenuTemperature(menu, option.value).catch(() => {});
            },
          }));

    return [
      ...options,
      {
        key: "clear",
        label: "Очистить",
        danger: true,
        separatorBefore: true,
        onSelect: () => {
          (menu.kind === "status"
            ? applyMenuStatus(menu, null)
            : applyMenuTemperature(menu, null)
          ).catch(() => {});
        },
      },
    ];
  }

  return (
    <div className="bg-white text-black">
      <FocusTodayScroller />
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .screen-only {
            display: none !important;
          }

          .hygiene-sheet {
            width: 100%;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .hygiene-page {
            break-after: page;
            page-break-after: always;
          }

          .hygiene-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .hygiene-grid {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed;
          }

          .hygiene-grid th,
          .hygiene-grid td {
            font-size: 10px !important;
            line-height: 1.1 !important;
            padding: 4px 3px !important;
          }

          .hygiene-header td {
            font-size: 11px !important;
            line-height: 1.15 !important;
            padding: 8px 10px !important;
          }

          .hygiene-title {
            font-size: 24px !important;
            margin-bottom: 26px !important;
          }

          .hygiene-notes,
          .hygiene-legend,
          .hygiene-reminder {
            font-size: 10px !important;
            line-height: 1.2 !important;
          }

          .hygiene-second-page-content {
            margin-top: 120px !important;
          }

          .hygiene-checkbox {
            width: 10px !important;
            height: 10px !important;
            border-radius: 2px !important;
          }
        }
      `}</style>

      {/*
        Toolbar + selection actions sit OUTSIDE the horizontally-scrolling
        hygiene-sheet wrapper. That matters on mobile: the sheet has
        `min-w-[1100px]` so the physical journal stays printable-wide, but
        anything inside that wrapper also gets stretched to 1100px — which
        would force the toolbar off-screen. Pulling it up into normal
        document flow keeps the toolbar tap-friendly regardless of view.
      */}
      {/* Нижний отступ этого блока задаёт полоса автозаполнения внутри
            <StaffJournalToolbar> (DOC_AUTOFILL_STRIP_CLASS, 40px до бумажной
            шапки) — свой mb здесь удваивал бы канон. */}
        <div className="screen-only space-y-4">
        <StaffJournalToolbar
          documentId={documentId}
          heading="Гигиенический журнал"
          title={documentTitle}
          status={status}
          autoFill={autoFill}
          responsibleTitle={responsibleTitle}
          responsibleUserId={responsibleUserId}
          users={employees}
          includedEmployeeIds={includedEmployeeIds}
          routeCode={routeCode}
          organizationName={organizationLabel}
          showHeaderActions
          useV2={useV2}
        />

        {!isActive ? (
          <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать отметки сотрудников." />
        ) : null}

        {isActive ? (
          <JournalSelectionBar
            count={selectedCount}
            onClear={() => setSelectedEmployeeIds([])}
            onDelete={handleDeleteSelected}
            deleting={isDeleting}
            hint="Сотрудники будут удалены из журнала вместе с отметками"
          />
        ) : null}

        {/* Mobile-only view toggle. Cards is the default — vertical list
            of employees with day-by-day accordion — far more usable on a
            phone than a 1100-px-wide table behind horizontal scroll. */}
        <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
      </div>

      {/* Mobile cards view — rendered outside the scroll wrapper so it
          respects the viewport width naturally. Hidden on sm+ and in
          print (both always use the table). */}
      {mobileView === "cards" ? (
        <div className="mb-6 space-y-2 sm:hidden print:hidden">
          {printableEmployees
            .filter((employee) => employee.name)
            .map((employee) => {
              const expanded = expandedEmployeeId === employee.id;
              const filledCount = dateKeys.reduce((acc, dk) => {
                const entry = normalizeHygieneEntryData(
                  entryMap[makeCellKey(employee.id, dk)]
                );
                return acc + (entry.status ? 1 : 0);
              }, 0);
              const isSelected = selectedEmployeeIds.includes(employee.id);

              return (
                <div
                  key={employee.id}
                  className="rounded-2xl border border-[#ececf4] bg-white"
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span
                      onClick={(event) => event.stopPropagation()}
                      className="shrink-0"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (!isActive) return;
                          toggleEmployee(employee.id, Boolean(checked));
                        }}
                        disabled={!isActive}
                        className="size-5"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedEmployeeId(expanded ? null : employee.id)
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[#0b1024]">
                          {employee.name}
                        </div>
                        <div className="truncate text-[12px] text-[#6f7282]">
                          {employee.position || "—"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] font-semibold text-[#5566f6]">
                        {filledCount}/{dateKeys.length}
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-[#6f7282] transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                  {expanded ? (
                    <div className="space-y-1.5 border-t border-[#ececf4] p-3">
                      {dateKeys.map((dateKey) => {
                        const key = makeCellKey(employee.id, dateKey);
                        const entry = normalizeHygieneEntryData(
                          entryMap[key]
                        );
                        const statusMeta = getStatusMeta(entry.status);
                        const tempLabel = getTemperatureLabel(entry);
                        const isSaving = savingCellKey === key;
                        const dayNum = getDayNumber(dateKey);

                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-2 rounded-xl px-1 py-1.5 ${
                              isSaving ? "bg-[#f7f8ff]" : ""
                            }`}
                          >
                            <span className="w-8 shrink-0 text-center text-[13px] font-medium text-[#6f7282]">
                              {dayNum}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isActive) return;
                                handleStatusClick(
                                  employee.id,
                                  dateKey
                                ).catch(() => {});
                              }}
                              disabled={!isActive}
                              className="min-w-0 flex-1 rounded-lg border border-[#ececf4] bg-[#fafbff] px-3 py-2 text-left text-[12px] font-medium text-[#0b1024] hover:bg-[#f5f6ff] disabled:opacity-60"
                            >
                              {statusMeta?.code ? (
                                <>
                                  <span className="font-semibold">
                                    {statusMeta.code}
                                  </span>
                                  <span className="ml-1.5 text-[#6f7282]">
                                    {statusMeta.label}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[#9b9fb3]">— не заполнено</span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isActive) return;
                                handleTemperatureClick(
                                  employee.id,
                                  dateKey
                                ).catch(() => {});
                              }}
                              disabled={!isActive}
                              title="Температура >37°C"
                              className="shrink-0 rounded-lg border border-[#ececf4] bg-[#fafbff] px-2 py-2 text-[12px] text-[#6f7282] hover:bg-[#f5f6ff] disabled:opacity-60"
                            >
                              T°: {tempLabel || "—"}
                            </button>
                          </div>
                        );
                      })}
                      {isActive ? (
                        <div className="pt-1 text-[11px] text-[#6f7282]">
                          Тап по статусу перебирает{" "}
                          {HYGIENE_STATUS_OPTIONS.map((item) => item.code).join(
                            " / "
                          )}
                          . T° — между «нет» и «да».
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          {printableEmployees.filter((employee) => employee.name).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5 text-center text-[13px] text-[#6f7282]">
              В документе пока нет сотрудников. Добавьте их через «+ Новая
              строка» в меню документа.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* S8: бумажное полотно — центрированный блок ~1150px, как на
          эталоне. Полоса автозаполнения и H1 остаются во всю ширину,
          потому что живут выше по дереву. */}
      <div
        className={`${DOC_PAPER_CANVAS_CLASS} ${
          mobileView === "cards" ? "hidden sm:block print:block" : ""
        }`}
      >
      <div className={GRID_VIEWPORT_CLASS}>
        <div className="hygiene-sheet min-w-[1100px] py-6 sm:min-w-0">

        <div className="hygiene-page">
          <div>
            <div className={DOC_PAPER_HEADER_CLASS}>
              <HygieneHeader
                pageLabel="СТР. 1 ИЗ 1"
                organizationLabel={organizationLabel}
                startedAt={dateFrom}
                finishedAt={status === "closed" ? dateTo : null}
                controlPeriodicity={controlPeriodicity}
              />
            </div>

            {/* КАПС-заголовок — общий компонент (16-18px), как во всех
                остальных журналах. Раньше здесь стоял локальный 34px. */}
            <JournalDocumentTitle
              className={`hygiene-title ${DOC_CAPS_TITLE_CLASS}`}
            >
              {documentTitle}
            </JournalDocumentTitle>

            {/* «Добавить» — слева непосредственно над таблицей, как на
                эталоне. `sticky left-0` держит кнопку у левого края, если
                широкий лист (min-w-[1100px]) скроллится по горизонтали. */}
            <StaffJournalAddButton
              documentId={documentId}
              title={documentTitle}
              status={status}
              users={employees}
              includedEmployeeIds={includedEmployeeIds}
              className={`${DOC_ADD_ROW_CLASS} sticky left-0 w-fit`}
            />

            <table className="hygiene-grid w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th
                    className={`w-[42px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                    rowSpan={2}
                  >
                    <HygieneCheckbox
                      checked={allSelected}
                      disabled={!isActive}
                      onCheckedChange={toggleAllEmployees}
                    />
                  </th>
                  <th
                    className={`w-[72px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                    rowSpan={2}
                  >
                    № п/п
                  </th>
                  <th
                    className={`w-[230px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                    rowSpan={2}
                  >
                    Ф.И.О. работника
                  </th>
                  <th
                    className={`w-[290px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                    rowSpan={2}
                  >
                    Должность
                  </th>
                  <th
                    className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center text-[13px] font-semibold leading-tight`}
                    colSpan={dateKeys.length}
                  >
                    Месяц {monthLabel}
                  </th>
                </tr>
                <tr>
                  {dateKeys.map((dateKey) => (
                    <th
                      key={dateKey}
                      data-focus-today={dateKey === toDateKey(new Date()) ? "" : undefined}
                      className={`w-[58px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                    >
                      {getDayNumber(dateKey)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {printableEmployees.map((employee) => (
                  <Fragment key={employee.id}>
                    <tr>
                      <td rowSpan={2} className={`${GRID_CELL_CLASS} px-2 py-0.5 text-center align-middle leading-tight`}>
                        {employee.name ? (
                          <HygieneCheckbox
                            checked={selectedEmployeeIds.includes(employee.id)}
                            disabled={!isActive}
                            onCheckedChange={(checked) => {
                              if (!isActive) return;
                              toggleEmployee(employee.id, checked);
                            }}
                          />
                        ) : null}
                      </td>
                      <td rowSpan={2} className={`${GRID_CELL_CLASS} px-2 py-0.5 text-center align-middle leading-tight`}>
                        {employee.name ? employee.number : ""}
                      </td>
                      <td className={`${GRID_CELL_CLASS} px-2 py-0.5 text-center leading-tight`}>{employee.name || ""}</td>
                      <td className={`${GRID_CELL_CLASS} px-2 py-0.5 text-center leading-tight`}>
                        {employee.name
                          ? employee.position || getHygienePositionLabel("operator")
                          : ""}
                      </td>
                      {dateKeys.map((dateKey) => {
                        const key = makeCellKey(employee.id, dateKey);
                        const entry = normalizeHygieneEntryData(entryMap[key]);
                        const statusMeta = getStatusMeta(entry.status);
                        const isSaving = savingCellKey === key;

                        return (
                          <td
                            key={`${employee.id}:${dateKey}:status`}
                            className={`${GRID_CELL_CLASS} h-6 px-2 py-0.5 text-center align-middle leading-tight ${getDayColumnBgClass(
                              dateKey
                            )} ${
                              isActive && employee.name ? "cursor-pointer hover:bg-[#f5f6ff]" : ""
                            } ${isSaving ? "bg-[#f7f8ff]" : ""}`}
                            onClick={() => {
                              if (!employee.name) return;
                              handleStatusClick(employee.id, dateKey).catch(() => {});
                            }}
                            onContextMenu={(event) =>
                              openCellMenu(
                                event,
                                employee.id,
                                dateKey,
                                "status",
                                Boolean(employee.name)
                              )
                            }
                          >
                            {statusMeta?.code || ""}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td colSpan={2} className={`${GRID_CELL_CLASS} px-2 py-0.5 text-center leading-tight`}>
                        Температура сотрудника более 37°C?
                      </td>
                      {dateKeys.map((dateKey) => {
                        const key = makeCellKey(employee.id, dateKey);
                        const entry = normalizeHygieneEntryData(entryMap[key]);
                        const isSaving = savingCellKey === key;

                        return (
                          <td
                            key={`${employee.id}:${dateKey}:temp`}
                            className={`${GRID_CELL_CLASS} h-6 px-2 py-0.5 text-center align-middle leading-tight ${getDayColumnBgClass(
                              dateKey
                            )} ${
                              isActive && employee.name ? "cursor-pointer hover:bg-[#f5f6ff]" : ""
                            } ${isSaving ? "bg-[#f7f8ff]" : ""}`}
                            onClick={() => {
                              if (!employee.name) return;
                              handleTemperatureClick(employee.id, dateKey).catch(() => {});
                            }}
                            onContextMenu={(event) =>
                              openCellMenu(
                                event,
                                employee.id,
                                dateKey,
                                "temperature",
                                Boolean(employee.name)
                              )
                            }
                          >
                            {getTemperatureLabel(entry)}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                ))}

                <tr>
                  {/* Служебная строка бланка. Её саму удалить нельзя, но
                      галочка не декоративная: как на эталоне, она работает
                      вторым «выбрать всё» — внизу длинной сетки это ближе,
                      чем возвращаться к шапке. */}
                  <td className={`${GRID_CELL_CLASS} px-2 py-0.5 text-center align-middle leading-tight`}>
                    <HygieneCheckbox
                      checked={allSelected}
                      disabled={!isActive}
                      onCheckedChange={toggleAllEmployees}
                    />
                  </td>
                  {/* H3: у эталона левая ячейка служебной строки — серая,
                      как заголовки шапки, а не белая ячейка данных. */}
                  <td colSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-0.5 text-center leading-tight`}>
                    Должность ответственного за контроль
                  </td>
                  <td className={`${GRID_CELL_CLASS} px-2 py-0.5 text-center leading-tight`}>{responsibleLabel}</td>
                  {dateKeys.map((dateKey) => (
                    <td
                      key={`blank:${dateKey}`}
                      className={`${GRID_CELL_CLASS} px-2 py-0.5 leading-tight ${getDayColumnBgClass(dateKey)}`}
                    />
                  ))}
                </tr>
              </tbody>
            </table>

            {/* Порядок блоков под таблицей — по эталону:
                1) «В журнал регистрируются результаты…»,
                2) «Список работников…»,
                3) «Условные обозначения» простым курсивом, без карточки.
                Подсказка «клик по ячейке…» убрана: то же самое написано
                в «Как заполнять». */}
            <div className={`hygiene-notes mt-6 ${DOC_NOTE_TEXT_CLASS}`}>
              <div className="font-semibold">В журнал регистрируются результаты:</div>
              {HYGIENE_REGISTER_NOTES.map((note) => (
                <div key={note}>- {note}</div>
              ))}
            </div>

            {/* H2 аудита: жирным ТОЛЬКО «Список работников, отмеченных
                в журнале» — хвост фразы у эталона обычного начертания. */}
            <div className={`hygiene-reminder mt-5 ${DOC_NOTE_TEXT_CLASS}`}>
              <span className="font-semibold">
                Список работников, отмеченных в журнале
              </span>{" "}
              на день осмотра, должен соответствовать числу работников на этот
              день в смену
            </div>

            <JournalLegendBlock
              variant="plain"
              autoPunctuation={false}
              className={`hygiene-legend ${DOC_LEGEND_CLASS} mt-5`}
              items={HYGIENE_REGISTER_LEGEND.map((item) => ({
                symbol: "",
                description: item,
              }))}
            />
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* ПКМ-меню ячейки — аналог диалога «Редактирование ячейки» эталона.
          Позиционируется у курсора (position: fixed), поэтому не зависит от
          горизонтального скролла широкого листа. В печати скрыто. */}
      {cellMenu ? (
        <TableContextMenu
          x={cellMenu.x}
          y={cellMenu.y}
          onClose={closeCellMenu}
          ariaLabel={
            cellMenu.kind === "status"
              ? "Отметка о здоровье"
              : "Отметка о температуре"
          }
          items={buildCellMenuItems(cellMenu)}
        />
      ) : null}
    </div>
  );
}
