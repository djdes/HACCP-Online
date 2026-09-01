"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StaffJournalAddButton,
  StaffJournalToolbar,
} from "@/components/journals/staff-journal-toolbar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_EXTRA_BLOCK_CLASS,
  DOC_NOTE_TEXT_CLASS,
  DOC_PAPER_CANVAS_CLASS,
  DOC_PAPER_HEADER_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import { MobileViewToggle } from "@/components/journals/mobile-view-toggle";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  HEALTH_REGISTER_NOTES,
  HEALTH_REGISTER_REMINDER,
  buildDateKeys,
  buildHygieneExampleEmployees,
  formatMonthLabel,
  getDayNumber,
  getHygienePositionLabel,
  getWeekdayShort,
  normalizeHealthEntryData,
  toDateKey,
  type HealthEntryData,
} from "@/lib/hygiene-document";
import { DocumentBackLink } from "@/components/journals/document-back-link";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";

import {
  JournalDocumentTitle,
  JournalPaperHeaderRows,
} from "@/components/journals/journal-document-header";
import { toast } from "sonner";
import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_VIEWPORT_WIDE_CLASS as GRID_VIEWPORT_CLASS,
  getDayColumnBgClass,
  getDayColumnPrintKeepBg,
} from "@/components/journals/journal-grid";
import { useTodayKey } from "@/lib/use-today-key";
type Props = {
  documentId: string;
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
  status: string;
  autoFill?: boolean;
  employees: { id: string; name: string; role: string }[];
  initialEntries: { employeeId: string; date: string; data: HealthEntryData }[];
  printEmptyRows?: number;
  /** Design v2 flag — пробрасывается в StaffJournalToolbar для v2-модалки. */
  useV2?: boolean;
};

/**
 * Screen ↔ print duality tokens (тот же приём, что в
 * `cleaning-document-client.tsx` / `hygiene-document-client.tsx`).
 */

const EMPTY_ROWS_OPTIONS = [0, 1, 2, 3, 4, 5, 10, 15, 20];

function HealthCheckbox(props: {
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={props.checked}
      disabled={props.disabled}
      onCheckedChange={(value) => props.onCheckedChange?.(value === true)}
      className="mx-auto size-4 rounded-[4px] border-[#c8ccda] data-[state=checked]:border-[#5566f6] data-[state=checked]:bg-[#5566f6]"
    />
  );
}

function HealthHeader({
  organizationLabel,
  pageLabel,
  startedAt,
  finishedAt,
  controlPeriodicity,
}: {
  organizationLabel: string;
  pageLabel: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  controlPeriodicity?: string;
}) {
  return (
    <table className="health-header w-full border-collapse text-[13px]">
      <tbody>
        <JournalPaperHeaderRows
          orgName={organizationLabel}
          title="ЖУРНАЛ ЗДОРОВЬЯ"
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

function makeCellKey(employeeId: string, dateKey: string) {
  return `${employeeId}:${dateKey}`;
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (result && typeof result.error === "string" && result.error) ||
        "Операция не выполнена"
    );
  }
  return result;
}

function getHealthMeasures(
  employeeId: string,
  dateKeys: string[],
  entryMap: Record<string, HealthEntryData>
) {
  return dateKeys.flatMap((dateKey) => {
    const measures = entryMap[makeCellKey(employeeId, dateKey)]?.measures?.trim();
    if (!measures) return [];

    return [`${getDayNumber(dateKey)} ${getWeekdayShort(dateKey)}. - ${measures}`];
  });
}

export function HealthDocumentClient(props: Props) {
  const router = useRouter();
  // «Сегодня» считаем после mount (см. useTodayKey): new Date() в
  // рендере давал hydration mismatch и подсветку не того дня.
  const todayKey = useTodayKey();
  const {
    documentId,
    title,
    organizationName,
    controlPeriodicity = "",
    dateFrom,
    dateTo,
    status,
    autoFill = false,
    employees,
    initialEntries,
    printEmptyRows = 0,
    useV2 = false,
  } = props;
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDocTitle, setSettingsDocTitle] = useState(title || "Журнал здоровья");
  const [emptyRows, setEmptyRows] = useState(String(printEmptyRows));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Mobile-only view preference: общий хук useMobileView, ключ
  // `journal-mobile-view:health_check`. Desktop и печать всегда рендерят
  // таблицу.
  const { mobileView, switchMobileView } = useMobileView("health_check");
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(
    null
  );

  // Миграция со старого ключа "health-mobile-view" (до перехода на общий
  // useMobileView). Читаем один раз: если нового ключа ещё нет, а старый
  // лежит — переносим выбор пользователя и чистим легаси.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("journal-mobile-view:health_check")) return;
      const legacy = window.localStorage.getItem("health-mobile-view");
      if (legacy === "table" || legacy === "cards") switchMobileView(legacy);
      window.localStorage.removeItem("health-mobile-view");
    } catch {
      /* localStorage blocked — остаёмся на дефолте 'cards' */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateKeys = buildDateKeys(dateFrom, dateTo);
  const includedEmployeeIds = [...new Set(initialEntries.map((entry) => entry.employeeId))];
  const rosterUsers = employees.filter((employee) => includedEmployeeIds.includes(employee.id));
  const printableEmployees = buildHygieneExampleEmployees(
    rosterUsers,
    // Ровно сотрудники + запрошенные под печать пустые строки. Прежний
    // «пол» в 5 строк дорисовывал пустую строку-заготовку в конце таблицы,
    // которая ничего не значила.
    Math.max(rosterUsers.length + printEmptyRows, 1)
  );
  const monthLabel = formatMonthLabel(dateFrom, dateTo);
  const organizationLabel = organizationName || 'ООО "Тест"';
  const documentTitle = title || "Журнал здоровья";
  const entryMap: Record<string, HealthEntryData> = {};

  initialEntries.forEach((entry) => {
    entryMap[makeCellKey(entry.employeeId, entry.date)] = normalizeHealthEntryData(entry.data);
  });

  const selectedCount = selectedEmployeeIds.length;
  const allSelected = rosterUsers.length > 0 && selectedCount === rosterUsers.length;
  const isActive = status === "active";

  function toggleEmployee(employeeId: string, checked: boolean) {
    setSelectedEmployeeIds((current) =>
      checked ? [...new Set([...current, employeeId])] : current.filter((item) => item !== employeeId)
    );
  }

  async function handleDeleteSelected() {
    if (selectedEmployeeIds.length === 0) return;
    if (!isActive) return;

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

  async function handleSaveSettings() {
    if (!isActive) return;
    setIsSavingSettings(true);
    try {
      await requestJson(`/api/journal-documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: settingsDocTitle.trim() || "Журнал здоровья",
          config: {
            printEmptyRows: Math.max(0, Number(emptyRows) || 0),
          },
        }),
      });
      setSettingsOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения настроек");
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <div className="bg-white text-black">
      <FocusTodayScroller />
      {/* Back-link + Print are rendered by StaffJournalToolbar below. */}
      <style jsx global>{`
        /* A1: локальный @page убран — ориентация задаётся один раз в
           globals.css (именованный @page journal-landscape + маркер
           [data-journal-print-root] страницы документа). Локальные
           дубли конфликтовали между собой по порядку загрузки. */

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

          .health-sheet {
            width: 100%;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .health-grid {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed;
          }

          .health-grid th,
          .health-grid td {
            font-size: 10px !important;
            line-height: 1.1 !important;
            padding: 4px 3px !important;
          }

          .health-header td {
            font-size: 11px !important;
            line-height: 1.15 !important;
            padding: 8px 10px !important;
          }

          .health-title {
            font-size: 24px !important;
            margin-bottom: 24px !important;
          }

          .health-notes {
            font-size: 10px !important;
            line-height: 1.25 !important;
            margin-top: 24px !important;
          }

          .health-checkbox {
            width: 10px !important;
            height: 10px !important;
            border-radius: 2px !important;
          }
        }
      `}</style>

      {/* Q3: верхнего padding'а нет — «крошки → H1» задаёт `space-y-3`
          контейнера раздела (12px), один для всех 13 журналов. */}
      <div className="health-sheet pb-4 sm:pb-6">
        {/* Нижний отступ этого блока задаёт полоса автозаполнения внутри
            <StaffJournalToolbar> (DOC_AUTOFILL_STRIP_CLASS, 40px до бумажной
            шапки) — свой mb здесь удваивал бы канон. */}
        <div className="screen-only space-y-4">
          <StaffJournalToolbar
            documentId={documentId}
            heading="Журнал здоровья"
            title={documentTitle}
            status={status}
            autoFill={autoFill}
            responsibleTitle={props.responsibleTitle}
            responsibleUserId={props.responsibleUserId ?? null}
            users={employees}
            includedEmployeeIds={includedEmployeeIds}
            routeCode="health_check"
            organizationName={organizationLabel}
            showHeaderActions
            useV2={useV2}
            onSettingsClick={() => {
              setSettingsDocTitle(documentTitle);
              setEmptyRows(String(printEmptyRows));
              setSettingsOpen(true);
            }}
          />

          {!isActive ? (
            <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать отметки сотрудников." />
          ) : null}

          {isActive && (
            <JournalSelectionBar
              count={selectedCount}
              onClear={() => setSelectedEmployeeIds([])}
              onDelete={handleDeleteSelected}
              deleting={isDeleting}
              hint="Сотрудники будут удалены из журнала вместе с отметками"
            />
          )}

          {/* Mobile-only view toggle. Cards = accordion per employee (a
              lot easier to read on a 320-px phone than a 1100-px grid
              behind horizontal scroll). */}
          <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
        </div>

        {/* Mobile Cards view — hidden on sm+ and in print. Read-only
            display of each employee's per-day sign-off and measures. */}
        {mobileView === "cards" ? (
          <div className="mb-6 space-y-2 sm:hidden print:hidden">
            {printableEmployees
              .filter((employee) => employee.name)
              .map((employee) => {
                const expanded = expandedEmployeeId === employee.id;
                const signedCount = dateKeys.reduce((acc, dk) => {
                  const d = entryMap[makeCellKey(employee.id, dk)];
                  return acc + (d?.signed ? 1 : 0);
                }, 0);
                const isSelected = selectedEmployeeIds.includes(employee.id);
                const measures = getHealthMeasures(
                  employee.id,
                  dateKeys,
                  entryMap
                );

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
                            {employee.position ||
                              getHygienePositionLabel("operator")}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] font-semibold text-[#5566f6]">
                          {signedCount}/{dateKeys.length}
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
                          const d = entryMap[makeCellKey(employee.id, dateKey)];
                          const signed = Boolean(d?.signed);
                          return (
                            <div
                              key={`${employee.id}:${dateKey}`}
                              className="flex items-center gap-2 rounded-xl px-1 py-1.5"
                            >
                              <span className="w-12 shrink-0 text-center text-[13px] font-medium text-[#6f7282]">
                                {getDayNumber(dateKey)}{" "}
                                {getWeekdayShort(dateKey)}.
                              </span>
                              <span
                                className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-[12px] font-medium ${
                                  signed
                                    ? "bg-[#f5f6ff] text-[#5566f6]"
                                    : "bg-[#fafbff] text-[#9b9fb3]"
                                }`}
                              >
                                {signed ? "Подпись есть" : "— не заполнено"}
                              </span>
                            </div>
                          );
                        })}
                        {measures.length > 0 ? (
                          <div className="mt-2 rounded-xl border border-[#ececf4] bg-[#fafbff] p-3 text-[13px] leading-5 text-[#3c4053]">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6f7282]">
                              Принятые меры
                            </div>
                            {measures.map((item) => (
                              <div key={`${employee.id}:m:${item}`}>{item}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            {printableEmployees.filter((employee) => employee.name).length ===
            0 ? (
              <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5 text-center text-[13px] text-[#6f7282]">
                В документе пока нет сотрудников.
              </div>
            ) : null}
          </div>
        ) : null}

        {/* R1: бумажное полотно — во всю ширину контентной колонки. */}
        <div
          className={`${DOC_PAPER_CANVAS_CLASS} ${
            mobileView === "cards" ? "hidden sm:block print:block" : ""
          }`}
        >
        <div className={GRID_VIEWPORT_CLASS}>
        <div className="min-w-[1100px] py-6 sm:min-w-0">
          <div className={DOC_PAPER_HEADER_CLASS}>
            <HealthHeader
              organizationLabel={organizationLabel}
              pageLabel="СТР. 1 ИЗ 1"
              startedAt={dateFrom}
              finishedAt={status === "closed" ? dateTo : null}
              controlPeriodicity={controlPeriodicity}
            />
          </div>

          {/* КАПС-заголовок — общий компонент (16-18px), как во всех
              остальных журналах. Раньше здесь стоял локальный 34px. */}
          <JournalDocumentTitle className={`health-title ${DOC_CAPS_TITLE_CLASS}`}>
            {documentTitle}
          </JournalDocumentTitle>

          {/* «Добавить» — слева непосредственно над таблицей (эталон).
              Раньше кнопка жила в шапке страницы, выше бумажной шапки.
              `sticky left-0` держит её у левого края при горизонтальном
              скролле широкого листа. */}
          <StaffJournalAddButton
            documentId={documentId}
            title={documentTitle}
            status={status}
            users={employees}
            includedEmployeeIds={includedEmployeeIds}
            className={`${DOC_ADD_ROW_CLASS} sticky left-0 w-fit`}
          />

          <table className="health-grid w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th
                  className={`w-[42px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight print:hidden`}
                  rowSpan={2}
                >
                  <HealthCheckbox
                    checked={allSelected}
                    disabled={!isActive}
                    onCheckedChange={(checked) => {
                      if (!isActive) return;
                      setSelectedEmployeeIds(
                        checked ? rosterUsers.map((employee) => employee.id) : []
                      );
                    }}
                  />
                </th>
                <th
                  className={`w-[72px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                  rowSpan={2}
                >
                  №
                  <br />
                  п/п
                </th>
                <th
                  className={`w-[150px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                  rowSpan={2}
                >
                  Ф.И.О. работника
                </th>
                <th
                  className={`w-[270px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
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
                <th
                  className={`w-[200px] ${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                  rowSpan={2}
                >
                  Принятые меры
                </th>
              </tr>
              <tr>
                {dateKeys.map((dateKey) => (
                  <th
                    key={dateKey}
                    data-focus-today={dateKey === todayKey ? "" : undefined}
                    /* R5-4: на бумаге колонка дня сжимается, и «Сб.»
                       ломалось ПО ТОЧКЕ — заголовок вырастал в три
                       строки («1» / «Сб» / «.») и распирал всю шапку.
                       Заголовок дня короткий по определению (число +
                       двухбуквенный день недели), переносить в нём
                       нечего, поэтому запрещаем перенос целиком. */
                    className={`w-[58px] ${GRID_HEAD_CELL_CLASS} whitespace-nowrap px-2 py-1.5 text-center font-semibold leading-tight`}
                  >
                    <div>{getDayNumber(dateKey)}</div>
                    <div>{getWeekdayShort(dateKey)}.</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {printableEmployees.map((employee) => {
                const measures = getHealthMeasures(employee.id, dateKeys, entryMap);

                return (
                  <tr key={employee.id}>
                    <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center align-middle leading-tight print:hidden`}>
                      {employee.name ? (
                        <HealthCheckbox
                          checked={selectedEmployeeIds.includes(employee.id)}
                          disabled={!isActive}
                          onCheckedChange={(checked) => {
                            if (!isActive) return;
                            toggleEmployee(employee.id, checked);
                          }}
                        />
                      ) : null}
                    </td>
                    <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center align-middle leading-tight`}>
                      {employee.name ? employee.number : ""}
                    </td>
                    <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center align-middle leading-tight`}>
                      {employee.name || ""}
                    </td>
                    <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center align-middle leading-tight`}>
                      {employee.name
                        ? employee.position || getHygienePositionLabel("operator")
                        : ""}
                    </td>
                    {dateKeys.map((dateKey) => {
                      const data = entryMap[makeCellKey(employee.id, dateKey)];

                      return (
                        <td
                          key={`${employee.id}:${dateKey}`}
                          className={`${GRID_CELL_CLASS} px-2 py-1 text-center align-middle leading-tight ${getDayColumnBgClass(
                            dateKey
                          )}`}
                          data-print-keep-bg={getDayColumnPrintKeepBg(dateKey)}
                        >
                          {data?.signed ? "+" : ""}
                        </td>
                      );
                    })}
                    <td className={`${GRID_CELL_CLASS} px-3 py-1 align-middle leading-tight`}>
                      <div className="space-y-1 text-left text-[14px] leading-5">
                        {measures.map((item) => (
                          <div key={`${employee.id}:${item}`}>{item}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}

              <tr>
                {/* Хвостовая пустая строка бланка (место для дозаписи от
                    руки при печати). Данных за ней нет, выделять нечего —
                    чекбокс только для симметрии сетки, всегда disabled. */}
                <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center align-middle leading-tight print:hidden`}>
                  <HealthCheckbox checked={false} disabled />
                </td>
                <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`} />
                <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`} />
                <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`} />
                {dateKeys.map((dateKey) => (
                  <td
                    key={`blank:${dateKey}`}
                    className={`${GRID_CELL_CLASS} px-2 py-1 leading-tight ${getDayColumnBgClass(dateKey)}`}
                    data-print-keep-bg={getDayColumnPrintKeepBg(dateKey)}
                  />
                ))}
                <td className={`${GRID_CELL_CLASS} px-2 py-1 leading-tight`} />
              </tr>
            </tbody>
          </table>

          <div className={`health-notes ${DOC_EXTRA_BLOCK_CLASS} space-y-3 ${DOC_NOTE_TEXT_CLASS}`}>
            {HEALTH_REGISTER_NOTES.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p className="font-semibold">{HEALTH_REGISTER_REMINDER}</p>
          </div>
        </div>
        </div>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Настройки журнала
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="health-doc-title">Название документа</Label>
              <Input
                id="health-doc-title"
                value={settingsDocTitle}
                onChange={(event) => setSettingsDocTitle(event.target.value)}
                placeholder="Введите название документа"
                className="h-9 rounded-xl border-[#dfe1ec] px-3.5"
              />
            </div>
            <div className="space-y-2">
              <Label>Добавлять пустых строк при печати</Label>
              <Select value={emptyRows} onValueChange={setEmptyRows}>
                <SelectTrigger className="h-10 w-full rounded-xl border-[#dfe1ec] bg-[#fafbff] px-3.5 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPTY_ROWS_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="h-10 rounded-xl bg-[#5566f6] px-5 text-[13.5px] text-white transition-colors hover:bg-[#4a5bf0]"
              >
                {isSavingSettings ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
