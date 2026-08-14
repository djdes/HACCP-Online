"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_BODY_STACK_CLASS,
  DOC_SECONDARY_BUTTON_CLASS,
  DOC_TITLE_ROW_NO_STRIP_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_HEADING_CLASS,
  DOC_PAPER_CANVAS_CLASS,
  DOC_PAPER_HEADER_CLASS,
  JOURNAL_DIALOG_CONTENT_WIDE_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";
import { confirmAsync } from "@/components/ui/confirm-async";
import { promptAsync } from "@/components/ui/prompt-async";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import {
  JournalDocumentHeader,
  JournalDocumentTitle,
} from "@/components/journals/journal-document-header";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  MobileViewToggle,
  MobileViewTableWrapper,
} from "@/components/journals/mobile-view-toggle";
import { RecordCardsView } from "@/components/journals/record-cards-view";
import {
  Archive,
  Paperclip,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXAMINATION_REFERENCE_DATA,
  MED_BOOK_PRELIMINARY_PERIODIC_ROWS,
  MED_BOOK_VACCINATION_RULES,
  VACCINATION_REFERENCE_DATA,
  VACCINATION_TYPE_LABELS,
  emptyMedBookEntry,
  formatMedBookDate,
  isExaminationExpired,
  isExaminationExpiringSoon,
  isVaccinationExpired,
  remapMedBookColumnKeys,
  type MedBookDocumentConfig,
  type MedBookEntryData,
  type MedBookVaccinationType,
} from "@/lib/med-book-document";
import {
  MedBookListDialog,
  type MedBookListChange,
} from "@/components/journals/med-book-list-dialog";
import { getUserRoleLabel } from "@/lib/user-roles";
import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_VIEWPORT_CLASS,
  GRID_VIEWPORT_SCROLLBAR_CLASS,
} from "@/components/journals/journal-grid";

type Employee = { id: string; name: string; role: string };
type Row = {
  id: string;
  employeeId: string;
  name: string;
  data: MedBookEntryData;
};
type Draft = {
  employeeId: string;
  positionTitle: string;
  birthDate: string;
  hireDate: string;
  gender: "male" | "female" | null;
  medBookNumber: string;
  note: string;
  photoUrl: string | null;
};
type Props = {
  documentId: string;
  title: string;
  templateCode: string;
  organizationName: string;
  /**
   * «Периодичность контроля» — вторая строка бумажной шапки документа
   * (`config.controlPeriodicity`, дефолт — из реестра шаблонов).
   * Пустая строка ⇒ строка в шапке не рендерится.
   */
  controlPeriodicity?: string;
  status: string;
  config: MedBookDocumentConfig;
  employees: Employee[];
  initialRows: Row[];
  documentDateKey: string;
  /** Design v2 toggle. */
  useV2?: boolean;
};

/**
 * ЭКРАН = WeSetup (мягкие серые рамки `#ececf4`, шапка `#f8f9fc`),
 * ПЕЧАТЬ (Ctrl+P) = «бумага» для инспектора РПН/СЭС (чёрные рамки,
 * белая шапка). Поэтому каждый токен несёт пару screen + `print:`.
 */
/** Скруглённый viewport вокруг таблицы; в печати — прозрачный wrapper. */

/** Человекочитаемые подсказки для промптов «тип прививки». */
const VACCINATION_TYPES = Object.keys(
  VACCINATION_TYPE_LABELS,
) as MedBookVaccinationType[];
const VACCINATION_TYPE_HINT = Object.entries(VACCINATION_TYPE_LABELS)
  .map(([key, label]) => `${key} — ${label}`)
  .join(", ");
/** ISO-дата `YYYY-MM-DD` — то, что отдаёт `<input type="date">`. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Общий вид триггера shadcn-селекта внутри форм журнала. */
const SELECT_TRIGGER_CLASS =
  "h-9 w-full rounded-xl border-[#dcdfed] bg-white px-3.5 text-[13.5px] text-[#0b1024] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15";
/** `<SelectItem value="">` в Radix запрещён — сентинел для «не выбрано». */
const NONE_VALUE = "__none";

const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): Draft => ({
  employeeId: "",
  positionTitle: "",
  birthDate: today(),
  hireDate: today(),
  gender: null,
  medBookNumber: "",
  note: "",
  photoUrl: null,
});
const cellBg = (warn: boolean) => (warn ? "bg-[#f6caca]" : "bg-white");

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

/**
 * Q2-8: печатная развёртка справочника колонок.
 *
 * На экране «Список специалистов и исследований» и «Список прививок» —
 * ссылки, открывающие диалог-редактор. Диалоги при печати скрыты
 * (`[role="dialog"]` в @media print), поэтому распечатанный журнал
 * медкнижек уходил инспектору без расшифровки колонок. Блок ниже
 * НЕ виден на экране и печатается вместо ссылки.
 */
function MedBookPrintList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="hidden print:block">
      <div className="text-[13px] font-bold text-black">{title}</div>
      <ol className="mt-1 list-decimal pl-5 text-[11.5px] leading-[1.35] text-black">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </div>
  );
}

export function MedBookDocumentClient({
  documentId,
  title,
  templateCode,
  organizationName,
  controlPeriodicity = "",
  status,
  config,
  employees,
  initialRows,
  documentDateKey,
  useV2 = false,
}: Props) {
  const router = useRouter();
  const isClosed = status === "closed";
  // Единый источник status/pdf-действий над журнальным документом.
  const { setStatus, isChangingStatus } = useJournalDocumentActions(documentId);
  const { mobileView, switchMobileView } = useMobileView("med_books");
  const [rows, setRows] = useState(initialRows);
  const [docTitle, setDocTitle] = useState(title);
  const [settingsTitle, setSettingsTitle] = useState(title);
  const [examColumns, setExamColumns] = useState(config.examinations);
  const [vaccColumns, setVaccColumns] = useState(config.vaccinations);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  /**
   * Выделение строк чекбоксами — как на эталоне (med_books-grid.png: первая
   * узкая колонка с чекбоксом в шапке и в каждой строке).
   */
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  /** Диалоги за подчёркнутыми ссылками под таблицами (эталон med_books-grid). */
  const [examListOpen, setExamListOpen] = useState(false);
  const [vaccListOpen, setVaccListOpen] = useState(false);

  /**
   * Раздел «Прививки» — опция документа (M2 аудита): тумблер «включить
   * "Прививки"» стоит в диалоге создания живого эталона
   * (med_books-3-create.png) и пишет `config.includeVaccinations`.
   *
   * `!== false` вместо `=== true`: у документов, созданных до появления
   * ключа, в config его просто нет — раздел там был и должен остаться.
   * Печатная форма (`document-pdf.ts`) читает флаг тем же правилом.
   */
  const [includeVaccinations, setIncludeVaccinations] = useState(
    config.includeVaccinations !== false,
  );
  /** Черновик того же флага внутри «Настроек журнала». */
  const [settingsIncludeVacc, setSettingsIncludeVacc] = useState(
    config.includeVaccinations !== false,
  );

  const editRow = rows.find((row) => row.id === editId) ?? null;
  const availableEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => !rows.some((row) => row.employeeId === employee.id),
      ),
    [employees, rows],
  );

  const sync = useCallback(
    async (
      nextRows: Row[],
      nextTitle?: string,
      nextConfig?: Partial<MedBookDocumentConfig>,
    ) => {
      setSaving(true);
      try {
        const entriesResponse = await fetch(
          `/api/journal-documents/${documentId}/entries`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entries: nextRows.map((row) => ({
                employeeId: row.employeeId,
                date: documentDateKey,
                data: row.data,
              })),
            }),
          },
        );
        if (!entriesResponse.ok) {
          const payload = await entriesResponse.json().catch(() => null);
          throw new Error(
            payload?.error || "Не удалось сохранить строки журнала",
          );
        }
        if (nextTitle !== undefined || nextConfig) {
          const response = await fetch(`/api/journal-documents/${documentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(nextTitle !== undefined ? { title: nextTitle } : {}),
              ...(nextConfig
                ? {
                    config: {
                      examinations: nextConfig.examinations ?? examColumns,
                      vaccinations: nextConfig.vaccinations ?? vaccColumns,
                      includeVaccinations:
                        nextConfig.includeVaccinations ?? includeVaccinations,
                    },
                  }
                : {}),
            }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || "Не удалось сохранить документ");
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [
      documentDateKey,
      documentId,
      examColumns,
      includeVaccinations,
      vaccColumns,
    ],
  );

  async function saveRows(nextRows: Row[]) {
    setRows(nextRows);
    try {
      await sync(nextRows);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить журнал",
      );
    }
  }

  /**
   * Сохранить справочник колонок (и, если нужно, переехавшие строки).
   *
   * Раньше «Добавить исследование» меняло только локальный state: колонка
   * пропадала после перезагрузки, пока пользователь не откроет «Настройки
   * журнала» и не нажмёт «Сохранить». Теперь любая правка справочника сразу
   * уходит в `config` документа.
   */
  async function persistColumns(next: {
    examinations?: string[];
    vaccinations?: string[];
    rows?: Row[];
  }) {
    const nextRows = next.rows ?? rows;
    const nextExams = next.examinations ?? examColumns;
    const nextVaccs = next.vaccinations ?? vaccColumns;

    if (next.rows) setRows(next.rows);
    if (next.examinations) setExamColumns(next.examinations);
    if (next.vaccinations) setVaccColumns(next.vaccinations);

    try {
      await sync(nextRows, undefined, {
        examinations: nextExams,
        vaccinations: nextVaccs,
        includeVaccinations,
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить журнал",
      );
    }
  }

  /** Применить правку «Списка специалистов и исследований» из диалога. */
  async function applyExamListChange(change: MedBookListChange) {
    const touched = change.renames.length > 0 || change.removed.length > 0;
    const nextRows = touched
      ? rows.map((row) => ({
          ...row,
          data: {
            ...row.data,
            examinations: remapMedBookColumnKeys(
              row.data.examinations,
              change.renames,
              change.removed,
            ),
          },
        }))
      : rows;

    await persistColumns({ examinations: change.names, rows: nextRows });
    setExamListOpen(false);
  }

  /** Применить правку «Списка прививок» из диалога. */
  async function applyVaccListChange(change: MedBookListChange) {
    const touched = change.renames.length > 0 || change.removed.length > 0;
    const nextRows = touched
      ? rows.map((row) => ({
          ...row,
          data: {
            ...row.data,
            vaccinations: remapMedBookColumnKeys(
              row.data.vaccinations,
              change.renames,
              change.removed,
            ),
          },
        }))
      : rows;

    await persistColumns({ vaccinations: change.names, rows: nextRows });
    setVaccListOpen(false);
  }

  async function closeJournal() {
    const confirmed = await confirmAsync({
      title: "Закончить журнал?",
      description: `Документ «${docTitle}» перейдёт в закладку «Закрытые» и станет доступен только для просмотра.`,
      variant: "warn",
      confirmLabel: "Закончить журнал",
      bullets: [
        { label: `Строк сотрудников в журнале: ${rows.length}`, tone: "info" },
        { label: "Даты осмотров и прививок редактировать будет нельзя", tone: "warn" },
        { label: "Журнал можно вернуть в активные в любой момент", tone: "default" },
      ],
    });
    if (!confirmed) return;
    await setStatus("closed");
  }

  function updateRow(rowId: string, patch: Partial<MedBookEntryData>) {
    saveRows(
      rows.map((row) =>
        row.id === rowId ? { ...row, data: { ...row.data, ...patch } } : row,
      ),
    );
  }

  async function editExam(rowId: string, column: string) {
    if (isClosed) return;
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const current = row.data.examinations[column];

    const date = await promptAsync({
      title: `Дата осмотра — ${column}`,
      description: `Сотрудник: ${row.name}. Когда осмотр или исследование было пройдено.`,
      label: "Дата прохождения",
      type: "date",
      defaultValue: current?.date || "",
      confirmLabel: "Далее",
      validate: (value) =>
        value && !ISO_DATE_RE.test(value) ? "Укажите дату в формате ГГГГ-ММ-ДД" : null,
    });
    if (date === null) return;

    const expiryDate = await promptAsync({
      title: `Действует до — ${column}`,
      description:
        "До какой даты результат осмотра действителен. Ячейка подсветится, когда срок истечёт.",
      label: "Действителен до",
      type: "date",
      defaultValue: current?.expiryDate || "",
      confirmLabel: "Сохранить",
      validate: (value) => {
        if (value && !ISO_DATE_RE.test(value)) return "Укажите дату в формате ГГГГ-ММ-ДД";
        if (value && date && value < date) return "Срок действия раньше даты осмотра";
        return null;
      },
    });
    if (expiryDate === null) return;

    saveRows(
      rows.map((item) =>
        item.id === rowId
          ? {
              ...item,
              data: {
                ...item.data,
                examinations: {
                  ...item.data.examinations,
                  [column]: {
                    date: date || null,
                    expiryDate: expiryDate || null,
                  },
                },
              },
            }
          : item,
      ),
    );
  }

  async function editVacc(rowId: string, column: string) {
    if (isClosed) return;
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const current = row.data.vaccinations[column];

    const rawType = await promptAsync({
      title: `Прививка «${column}»`,
      description: `Сотрудник: ${row.name}. Что отметить в ячейке: ${VACCINATION_TYPE_HINT}.`,
      label: "Тип отметки",
      placeholder: "done",
      defaultValue: current?.type || "done",
      confirmLabel: "Далее",
      validate: (value) =>
        VACCINATION_TYPES.includes(value.trim() as MedBookVaccinationType)
          ? null
          : `Допустимые значения: ${VACCINATION_TYPES.join(", ")}`,
    });
    if (rawType === null) return;
    const type = rawType.trim() as MedBookVaccinationType;

    let dose = "";
    let date = "";
    let expiryDate = "";
    if (type === "done") {
      const doseValue = await promptAsync({
        title: `Доза — ${column}`,
        description: "Какая по счёту доза или ревакцинация. Можно оставить пустым.",
        label: "Доза",
        placeholder: "Например, V1 или RV2",
        defaultValue: current?.dose || "",
        confirmLabel: "Далее",
      });
      if (doseValue === null) return;
      dose = doseValue;

      const dateValue = await promptAsync({
        title: `Дата прививки — ${column}`,
        description: "Когда прививка была поставлена.",
        label: "Дата вакцинации",
        type: "date",
        defaultValue: current?.date || "",
        confirmLabel: "Далее",
        validate: (value) =>
          value && !ISO_DATE_RE.test(value) ? "Укажите дату в формате ГГГГ-ММ-ДД" : null,
      });
      if (dateValue === null) return;
      date = dateValue;

      const expiryValue = await promptAsync({
        title: `Действует до — ${column}`,
        description:
          "До какой даты прививка действительна. Ячейка подсветится, когда срок истечёт.",
        label: "Действительна до",
        type: "date",
        defaultValue: current?.expiryDate || "",
        confirmLabel: "Сохранить",
        validate: (value) => {
          if (value && !ISO_DATE_RE.test(value)) return "Укажите дату в формате ГГГГ-ММ-ДД";
          if (value && date && value < date) return "Срок действия раньше даты прививки";
          return null;
        },
      });
      if (expiryValue === null) return;
      expiryDate = expiryValue;
    }

    saveRows(
      rows.map((item) =>
        item.id === rowId
          ? {
              ...item,
              data: {
                ...item.data,
                vaccinations: {
                  ...item.data.vaccinations,
                  [column]: {
                    type,
                    dose: dose || null,
                    date: date || null,
                    expiryDate: expiryDate || null,
                  },
                },
              },
            }
          : item,
      ),
    );
  }

  async function addExamColumn() {
    const name = await promptAsync({
      title: "Новое исследование",
      description:
        "Колонка появится в таблице медкнижек — по ней можно будет отмечать даты для каждого сотрудника.",
      label: "Название специалиста или исследования",
      placeholder: "Например, Флюорография",
      confirmLabel: "Добавить",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "Введите название";
        if (examColumns.includes(trimmed)) return "Такая колонка уже есть";
        return null;
      },
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || examColumns.includes(trimmed)) return;
    await persistColumns({ examinations: [...examColumns, trimmed] });
  }

  async function addVaccColumn() {
    const name = await promptAsync({
      title: "Новая прививка",
      description:
        "Колонка появится в таблице прививок — по ней можно будет отмечать вакцинацию, отказ или мед. отвод.",
      label: "Название прививки",
      placeholder: "Например, АДС-М",
      confirmLabel: "Добавить",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return "Введите название";
        if (vaccColumns.includes(trimmed)) return "Такая прививка уже есть";
        return null;
      },
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || vaccColumns.includes(trimmed)) return;
    await persistColumns({ vaccinations: [...vaccColumns, trimmed] });
  }

  async function deleteRow(rowId: string, rowName: string) {
    const confirmed = await confirmAsync({
      title: "Удалить строку сотрудника?",
      description: `Строка «${rowName || "без имени"}» исчезнет из журнала медкнижек.`,
      variant: "danger",
      confirmLabel: "Удалить",
      bullets: [
        { label: `Отметок об осмотрах: ${examColumns.length}`, tone: "warn" },
        { label: `Отметок о прививках: ${vaccColumns.length}`, tone: "warn" },
        { label: "Восстановить данные будет нельзя", tone: "warn" },
      ],
    });
    if (!confirmed) return;
    await saveRows(rows.filter((row) => row.id !== rowId));
    setEditId(null);
    setSelectedRowIds((current) => current.filter((id) => id !== rowId));
  }

  /** Удалить все выделенные строки сотрудников одним действием. */
  async function deleteSelectedRows() {
    const ids = selectedRowIds;
    if (ids.length === 0) return;
    const confirmed = await confirmAsync({
      title: "Удалить выбранные строки?",
      description: `Будет удалено строк сотрудников: ${ids.length}.`,
      variant: "danger",
      confirmLabel: "Удалить",
      bullets: [
        { label: `Отметок об осмотрах в каждой строке: ${examColumns.length}`, tone: "warn" },
        { label: `Отметок о прививках в каждой строке: ${vaccColumns.length}`, tone: "warn" },
        { label: "Восстановить данные будет нельзя", tone: "warn" },
      ],
    });
    if (!confirmed) return;
    await saveRows(rows.filter((row) => !ids.includes(row.id)));
    setSelectedRowIds([]);
    setEditId(null);
  }

  async function onPhoto(files: FileList | null, target: "add" | "edit") {
    const file = files?.[0];
    if (!file) return;
    const photoUrl = await fileToDataUrl(file);
    if (target === "add") setDraft((current) => ({ ...current, photoUrl }));
    if (target === "edit" && editRow) updateRow(editRow.id, { photoUrl });
  }

  function addEmployee() {
    const employee = employees.find((item) => item.id === draft.employeeId);
    if (!employee) return;
    const positionTitle =
      draft.positionTitle || getUserRoleLabel(employee.role);
    saveRows([
      ...rows,
      {
        id: `local-${Date.now()}`,
        employeeId: employee.id,
        name: employee.name,
        data: {
          ...emptyMedBookEntry(positionTitle),
          birthDate: draft.birthDate || null,
          gender: draft.gender,
          hireDate: draft.hireDate || null,
          medBookNumber: draft.medBookNumber || null,
          note: draft.note || null,
          photoUrl: draft.photoUrl,
        },
      },
    ]).then(() => setAddOpen(false));
  }

  return (
    <div className={DOC_BODY_STACK_CLASS}>
      <FocusTodayScroller selector="[data-focus-today]" emptyTitle="Записей пока нет" emptyBody="Нажмите «Добавить» в таблице ниже, чтобы создать запись." />
      <DocumentActionsBar
        className={DOC_TITLE_ROW_NO_STRIP_CLASS}
        backHref="/journals/med_books"
        documentId={documentId}
        heading={<h1 className={DOC_HEADING_CLASS}>{docTitle}</h1>}
        onSettings={() => {
          setSettingsTitle(docTitle);
          setSettingsIncludeVacc(includeVaccinations);
          setSettingsOpen(true);
        }}
        menuItems={[
          isClosed
            ? {
                key: "reopen-journal",
                label: "Вернуть в активные",
                icon: <RotateCcw className="size-4" />,
                onSelect: () => void setStatus("active"),
                disabled: isChangingStatus,
              }
            : {
                key: "close-journal",
                label: "Закончить журнал",
                icon: <Archive className="size-4" />,
                onSelect: () => void closeJournal(),
                disabled: isChangingStatus,
              },
        ]}
      />
      {isClosed ? (
        <div className="mb-5">
          <JournalClosedBanner hint="Верните журнал в активные, чтобы менять даты осмотров, исследований и прививок." />
        </div>
      ) : null}

      {/* R1: бумажное полотно во всю ширину контентной колонки.
          Обе таблицы медкнижек шире экрана и скроллятся внутри своих
          GRID_VIEWPORT_CLASS.
          `space-y-2` снят: blanket-отступ вставлял 8px МЕЖДУ ХАССП-шапкой,
          КАПС-титулом и таблицей и разрывал единый бланк. Вертикальный
          ритм задают токены DOC_* (см. journal-responsive.ts). */}
      <div className={DOC_PAPER_CANVAS_CLASS}>
        <div className="sm:hidden print:hidden">
          <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
        </div>

        {/* Карточки — только на телефоне. Без обёртки `sm:hidden` заглушка
            «Сотрудников пока нет.» висела плашкой над кнопками на десктопе;
            пустое состояние теперь показывают сами таблицы пустой строкой. */}
        {mobileView === "cards" ? (
          <div className="sm:hidden print:hidden">
          <RecordCardsView
            items={rows.map((row, index) => {
              const expiredCount = examColumns.filter((col) => {
                const exam = row.data.examinations[col];
                return exam?.date && isExaminationExpired(exam);
              }).length;
              const soonCount = examColumns.filter((col) => {
                const exam = row.data.examinations[col];
                return exam?.date && !isExaminationExpired(exam) && isExaminationExpiringSoon(exam);
              }).length;
              return {
                id: row.id,
                title: `№${index + 1} · ${row.name || "—"}`,
                subtitle: row.data.positionTitle || undefined,
                badge:
                  expiredCount > 0 ? (
                    <span className="rounded-full bg-[#fff2f1] px-2 py-0.5 text-[11px] font-semibold text-[#d2453d]">
                      {`Просрочено: ${expiredCount}`}
                    </span>
                  ) : soonCount > 0 ? (
                    <span className="rounded-full bg-[#fff9eb] px-2 py-0.5 text-[11px] font-semibold text-[#a16a13]">
                      {`Скоро: ${soonCount}`}
                    </span>
                  ) : undefined,
                fields: examColumns.map((column) => {
                  const exam = row.data.examinations[column];
                  const expired = exam ? isExaminationExpired(exam) : false;
                  const soon = exam ? isExaminationExpiringSoon(exam) : false;
                  const parts: string[] = [];
                  if (exam?.date) parts.push(formatMedBookDate(exam.date));
                  if (exam?.expiryDate) parts.push(`до ${formatMedBookDate(exam.expiryDate)}`);
                  return {
                    label: column,
                    value: parts.join(" · "),
                    warnIfEmpty: true,
                    hint: exam && (expired || soon)
                      ? expired
                        ? "Осмотр просрочен"
                        : "Скоро истечёт"
                      : undefined,
                    onClick: !isClosed ? () => void editExam(row.id, column) : undefined,
                  };
                }),
                onClick: !isClosed ? () => setEditId(row.id) : undefined,
              };
            })}
            emptyLabel="Сотрудников пока нет."
          />
          </div>
        ) : null}

        {/* Официальный ХАССП-header — для печати в РПН/СЭС-проверки (M4):
            «Начат / Окончен», «СТР. 1 ИЗ 1», периодичность контроля. */}
        {/* Шапка НЕ живёт в горизонтальном скролле: раньше она лежала в
            `GRID_VIEWPORT_CLASS` с `min-w-[1320px]`, поэтому «Начат …» и
            «СТР. 1 ИЗ 1» физически уезжали за правый край полотна (1150px)
            и обрезались. Скроллятся только таблицы; шапка — во всю ширину
            бумажного полотна. */}
        <div className={`${DOC_PAPER_HEADER_CLASS} w-full print:mb-2`}>
          <JournalDocumentHeader
            orgName={organizationName}
            title="Журнал учёта медицинских книжек сотрудников"
            startedAt={documentDateKey}
            finishedAt={isClosed ? documentDateKey : null}
            controlPeriodicity={controlPeriodicity}
          />
        </div>
        <JournalDocumentTitle className={DOC_CAPS_TITLE_CLASS}>
          Медицинские книжки
        </JournalDocumentTitle>

        {/* «Добавить сотрудника» / «Добавить исследование» — слева
            непосредственно над таблицей, как на эталоне. Раньше кнопки
            стояли в шапке страницы, выше бумажной шапки. */}
        {!isClosed ? (
          <div className={DOC_ADD_ROW_CLASS}>
            <Button
              type="button"
              className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#4a5bf0]"
              onClick={() => {
                setDraft(emptyDraft());
                setAddOpen(true);
              }}
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Добавить сотрудника
            </Button>
            {/* M5: вторая кнопка — ВТОРИЧНАЯ (светлая), как «Редактировать
                списки» в остальных журналах: первичное действие на странице
                одно — «Добавить сотрудника». */}
            <Button
              type="button"
              variant="outline"
              className={DOC_SECONDARY_BUTTON_CLASS}
              onClick={() => void addExamColumn()}
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Добавить исследование
            </Button>
          </div>
        ) : null}

        {!isClosed ? (
          <JournalSelectionBar
            count={selectedRowIds.length}
            onClear={() => setSelectedRowIds([])}
            onDelete={() => void deleteSelectedRows()}
            hint="Строки сотрудников исчезнут вместе с отметками об осмотрах и прививках"
          />
        ) : null}

        {/* M3: обе таблицы медкнижек шире бумажного полотна — скроллятся
            ВНУТРИ своего viewport'а, с постоянно видимой полосой прокрутки.

            A11 аудита: у таблиц добавлен `w-full`. Без него ширину задавал
            КОНТЕНТ (min-w — только нижняя граница), и правый край бланка
            был рваным: шапка 1406px, «Осмотры и исследования» 1387px,
            «Прививки» 1355px — три разные вертикали на одном листе.
            Теперь обе таблицы тянутся на ширину полотна, как и шапка,
            а `min-w-[1320px]` продолжает включать скролл на узких. */}
        <MobileViewTableWrapper
          mobileView={mobileView}
          className={`${GRID_VIEWPORT_CLASS} ${GRID_VIEWPORT_SCROLLBAR_CLASS}`}
        >
          <table className="w-full min-w-[1320px] border-collapse text-[13px] text-black">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className={`${GRID_HEAD_CELL_CLASS} w-[44px] px-2 py-4 text-center leading-tight print:hidden`}
                >
                  <Checkbox
                    aria-label="Выделить все строки"
                    title="Выделить все строки"
                    disabled={isClosed || rows.length === 0}
                    checked={rows.length > 0 && selectedRowIds.length === rows.length}
                    onCheckedChange={(checked) =>
                      setSelectedRowIds(checked === true ? rows.map((row) => row.id) : [])
                    }
                    className="size-4"
                  />
                </th>
                <th
                  rowSpan={2}
                  className={`${GRID_HEAD_CELL_CLASS} px-2 py-4 leading-tight`}
                >
                  № п/п
                </th>
                <th
                  rowSpan={2}
                  className={`${GRID_HEAD_CELL_CLASS} px-3 py-4 leading-tight`}
                >
                  Ф.И.О. сотрудника
                </th>
                <th
                  rowSpan={2}
                  className={`${GRID_HEAD_CELL_CLASS} px-3 py-4 leading-tight`}
                >
                  Должность
                </th>
                <th
                  colSpan={examColumns.length}
                  className={`${GRID_HEAD_CELL_CLASS} px-3 py-4 leading-tight`}
                >
                  {/* M6: пунктуация групповых шапок ОДИНАКОВАЯ в обеих
                      таблицах — с двоеточием, как «Наименование прививки:»
                      на эталоне med_books-grid.png. */}
                  Наименование специалиста / исследования:
                </th>
              </tr>
              <tr>
                {examColumns.map((column) => (
                  <th
                    key={column}
                    className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 leading-tight`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Пустое состояние = пустая строка бланка (чекбокс + пустые
                  ячейки), как на эталоне. Текстовой заглушки нет. */}
              {rows.length === 0 ? (
                <tr>
                  <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight print:hidden`}>
                    <Checkbox checked={false} disabled className="size-4" />
                  </td>
                  {Array.from({ length: examColumns.length + 3 }, (_, index) => (
                    <td key={index} className={`${GRID_CELL_CLASS} px-2 py-1 leading-tight`}>
                      <div className="h-7" />
                    </td>
                  ))}
                </tr>
              ) : null}
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight print:hidden`}>
                    <Checkbox
                      aria-label={`Выделить строку «${row.name || "без имени"}»`}
                      disabled={isClosed}
                      checked={selectedRowIds.includes(row.id)}
                      onCheckedChange={(checked) =>
                        setSelectedRowIds((current) =>
                          checked === true
                            ? [...new Set([...current, row.id])]
                            : current.filter((id) => id !== row.id),
                        )
                      }
                      className="size-4"
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`}>
                    {index + 1}
                  </td>
                  <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`}>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 ${isClosed ? "" : "hover:text-[#5566f6]"}`}
                      onClick={() => !isClosed && setEditId(row.id)}
                    >
                      <span>{row.name}</span>
                      {row.data.photoUrl ? (
                        <Paperclip className="size-4 text-[#5566f6]" />
                      ) : null}
                    </button>
                  </td>
                  <td
                    className={`${GRID_CELL_CLASS} px-2 py-1 text-center ${cellBg(!row.data.positionTitle)} ${isClosed ? "" : "cursor-pointer hover:bg-[#eef1ff]"} leading-tight`}
                    onClick={() => !isClosed && setEditId(row.id)}
                  >
                    {row.data.positionTitle}
                  </td>
                  {examColumns.map((column) => {
                    const exam = row.data.examinations[column];
                    const expired = exam ? isExaminationExpired(exam) : false;
                    const soon = exam ? isExaminationExpiringSoon(exam) : false;
                    return (
                      <td
                        key={column}
                        className={`${GRID_CELL_CLASS} px-2 py-1 text-center ${cellBg(!exam?.date || expired || soon)} ${isClosed ? "" : "cursor-pointer hover:bg-[#eef1ff]"} leading-tight`}
                        onClick={() => void editExam(row.id, column)}
                      >
                        {exam?.date ? (
                          <div>
                            {formatMedBookDate(exam.date)}
                            {exam.expiryDate ? (
                              <div
                                className={
                                  expired
                                    ? "text-[13px] text-[#d30000]"
                                    : "text-[13px]"
                                }
                              >
                                до {formatMedBookDate(exam.expiryDate)}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </MobileViewTableWrapper>

      {/* Справочники — за подчёркнутыми ссылками под таблицами, ровно как
          на эталоне med_books-grid.png: «Список специалистов и исследований»
          и «Список прививок». Прежние развёрнутые справочные таблицы
          (десятки строк 18-22px) на бумажном полотне превращались во второй
          документ; их содержимое целиком переехало в диалоги за ссылками. */}
      <div id="med-book-reference" className="mt-4 mb-8">
        <button
          type="button"
          onClick={() => setExamListOpen(true)}
          className="text-[17px] font-semibold text-black underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-[#5566f6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 print:hidden"
        >
          Список специалистов и исследований
        </button>
        {/* Q2-8: на экране справочник живёт за ссылкой (диалог), на
            бумаге диалога нет — инспектор получал документ без расшифровки
            колонок. Печатаем содержимое списком. */}
        <MedBookPrintList
          title="Список специалистов и исследований"
          items={examColumns}
        />
      </div>

      {includeVaccinations ? (
        <div className="space-y-5">
          {/* На эталоне «Прививки» — мелкий bold-подзаголовок над таблицей,
              а не плакат: 34px читались как второй H1 страницы. */}
          <h2 className="text-center text-[16px] font-bold leading-tight text-black sm:text-[18px]">
            Прививки
          </h2>
          <div className="space-y-2">
            <div className={`${GRID_VIEWPORT_CLASS} ${GRID_VIEWPORT_SCROLLBAR_CLASS}`}>
              <table className="w-full min-w-[1320px] border-collapse text-[13px] text-black">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className={`${GRID_HEAD_CELL_CLASS} w-[44px] px-2 py-4 text-center leading-tight print:hidden`}
                    >
                      <Checkbox
                        aria-label="Выделить все строки"
                        title="Выделить все строки"
                        disabled={isClosed || rows.length === 0}
                        checked={rows.length > 0 && selectedRowIds.length === rows.length}
                        onCheckedChange={(checked) =>
                          setSelectedRowIds(checked === true ? rows.map((row) => row.id) : [])
                        }
                        className="size-4"
                      />
                    </th>
                    <th
                      rowSpan={2}
                      className={`${GRID_HEAD_CELL_CLASS} px-2 py-4 leading-tight`}
                    >
                      № п/п
                    </th>
                    <th
                      rowSpan={2}
                      className={`${GRID_HEAD_CELL_CLASS} px-3 py-4 leading-tight`}
                    >
                      Ф.И.О. сотрудника
                    </th>
                    <th
                      rowSpan={2}
                      className={`${GRID_HEAD_CELL_CLASS} px-3 py-4 leading-tight`}
                    >
                      Должность
                    </th>
                    <th
                      colSpan={vaccColumns.length + 1}
                      className={`${GRID_HEAD_CELL_CLASS} px-3 py-4 leading-tight`}
                    >
                      Наименование прививки:
                    </th>
                  </tr>
                  <tr>
                    {vaccColumns.map((column) => (
                      <th
                        key={column}
                        className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 leading-tight`}
                      >
                        {column}
                      </th>
                    ))}
                    <th className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 leading-tight`}>
                      Примечание
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Та же пустая строка-бланк, что и в таблице осмотров. */}
                  {rows.length === 0 ? (
                    <tr>
                      <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight print:hidden`}>
                        <Checkbox checked={false} disabled className="size-4" />
                      </td>
                      {Array.from({ length: vaccColumns.length + 4 }, (_, index) => (
                        <td key={index} className={`${GRID_CELL_CLASS} px-2 py-1 leading-tight`}>
                          <div className="h-7" />
                        </td>
                      ))}
                    </tr>
                  ) : null}
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight print:hidden`}>
                        <Checkbox
                          aria-label={`Выделить строку «${row.name || "без имени"}»`}
                          disabled={isClosed}
                          checked={selectedRowIds.includes(row.id)}
                          onCheckedChange={(checked) =>
                            setSelectedRowIds((current) =>
                              checked === true
                                ? [...new Set([...current, row.id])]
                                : current.filter((id) => id !== row.id),
                            )
                          }
                          className="size-4"
                        />
                      </td>
                      <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`}>
                        {index + 1}
                      </td>
                      <td
                        className={`${GRID_CELL_CLASS} px-2 py-1 text-center ${isClosed ? "" : "cursor-pointer hover:bg-[#eef1ff]"} leading-tight`}
                        onClick={() => !isClosed && setEditId(row.id)}
                      >
                        {row.name}
                      </td>
                      <td
                        className={`${GRID_CELL_CLASS} px-2 py-1 text-center ${isClosed ? "" : "cursor-pointer hover:bg-[#eef1ff]"} leading-tight`}
                        onClick={() => !isClosed && setEditId(row.id)}
                      >
                        {row.data.positionTitle}
                      </td>
                      {vaccColumns.map((column) => {
                        const vacc = row.data.vaccinations[column];
                        const expired = vacc
                          ? isVaccinationExpired(vacc)
                          : false;
                        return (
                          <td
                            key={column}
                            className={`${GRID_CELL_CLASS} px-2 py-1 text-center ${cellBg(!vacc || expired)} ${isClosed ? "" : "cursor-pointer hover:bg-[#eef1ff]"} leading-tight`}
                            onClick={() => void editVacc(row.id, column)}
                          >
                            {vacc ? (
                              vacc.type === "done" ? (
                                <div>
                                  {vacc.dose ? `${vacc.dose}: ` : ""}
                                  {formatMedBookDate(vacc.date || null)}
                                  {vacc.expiryDate ? (
                                    <div
                                      className={
                                        expired
                                          ? "text-[13px] text-[#d30000]"
                                          : "text-[13px]"
                                      }
                                    >
                                      до {formatMedBookDate(vacc.expiryDate)}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div>{VACCINATION_TYPE_LABELS[vacc.type]}</div>
                              )
                            ) : null}
                          </td>
                        );
                      })}
                      <td
                        className={`${GRID_CELL_CLASS} px-2 py-1 text-center ${isClosed ? "" : "cursor-pointer hover:bg-[#eef1ff]"} leading-tight`}
                        onClick={() => !isClosed && setEditId(row.id)}
                      >
                        {row.data.note || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setVaccListOpen(true)}
              className="text-[17px] font-semibold text-black underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-[#5566f6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 print:hidden"
            >
              Список прививок
            </button>
            <MedBookPrintList title="Список прививок" items={vaccColumns} />
          </div>
        </div>
      ) : null}
      </div>

      <MedBookListDialog
            open={examListOpen}
            onOpenChange={setExamListOpen}
            title="Список специалистов и исследований"
            description="Каждая строка — колонка в таблице медицинских осмотров. Переименование сохраняет уже проставленные даты, удаление убирает колонку вместе с отметками."
            items={examColumns}
            itemLabel="Специалист / исследование"
            addLabel="Добавить исследование"
            placeholder="Например, Флюорография"
            saving={saving}
            onSave={applyExamListChange}
            reference={
              <div className="space-y-3">
                {/* «Предварительные / Периодические» — та же справка, что
                    раньше лежала таблицей под сеткой документа. */}
                <dl className="space-y-1.5">
                  {MED_BOOK_PRELIMINARY_PERIODIC_ROWS.map((row) => (
                    <div key={row.preliminary} className="text-[13px] leading-[1.45]">
                      <dt className="font-semibold text-[#0b1024]">
                        {row.preliminary}
                      </dt>
                      <dd className="text-[#6f7282]">{row.periodic}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="space-y-2">
                  {EXAMINATION_REFERENCE_DATA.map((item) => (
                    <div key={item.name} className="text-[13px] leading-[1.45]">
                      <dt className="font-semibold text-[#0b1024]">{item.name}</dt>
                      <dd className="text-[#6f7282]">
                        {item.periodicity}
                        {item.note ? ` — ${item.note}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            }
          />
          <MedBookListDialog
            open={vaccListOpen}
            onOpenChange={setVaccListOpen}
            title="Список прививок"
            description="Каждая строка — колонка в таблице прививок. Вакцинация проводится в соответствии с Приказом Минздрава России от 06.12.2021 № 1122н."
            items={vaccColumns}
            itemLabel="Прививка"
            addLabel="Добавить прививку"
            placeholder="Например, АДС-М"
            saving={saving}
            onSave={applyVaccListChange}
            reference={
              <div className="space-y-3">
                <dl className="space-y-2">
                  {VACCINATION_REFERENCE_DATA.map((item) => (
                    <div key={item.name} className="text-[13px] leading-[1.45]">
                      <dt className="font-semibold text-[#0b1024]">{item.name}</dt>
                      <dd className="text-[#6f7282]">{item.periodicity}</dd>
                    </div>
                  ))}
                </dl>
                {MED_BOOK_VACCINATION_RULES.map((rule) => (
                  <p
                    key={rule}
                    className="text-[12.5px] font-semibold uppercase leading-[1.4] text-[#8a6212]"
                  >
                    {rule}
                  </p>
                ))}
              </div>
            }
          />

      {useV2 ? (
        <JournalSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          title="Настройки журнала"
          description="Название журнала, перечень обследований и прививок."
          size="md"
          isSaving={saving}
          saveDisabled={!settingsTitle.trim()}
          onSave={async () => {
            try {
              await sync(rows, settingsTitle.trim(), {
                examinations: examColumns,
                vaccinations: vaccColumns,
                includeVaccinations: settingsIncludeVacc,
              });
              setDocTitle(settingsTitle.trim());
              setIncludeVaccinations(settingsIncludeVacc);
              setSettingsOpen(false);
              router.refresh();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Не удалось сохранить настройки",
              );
            }
          }}
          onCancel={() => setSettingsOpen(false)}
        >
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Название документа
            </Label>
            <Input
              value={settingsTitle}
              onChange={(event) => setSettingsTitle(event.target.value)}
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
            />
          </div>
          {/* Тот же тумблер, что в диалоге создания (M2): раздел
              «Прививки» можно включить или выключить и позже. */}
          <label className="flex items-center gap-3 text-[14px] text-[#3c4053]">
            <Switch
              checked={settingsIncludeVacc}
              onCheckedChange={(value) => setSettingsIncludeVacc(value === true)}
              className="shrink-0"
              aria-label={'Включить раздел «Прививки»'}
            />
            Включить раздел «Прививки»
          </label>
          {settingsIncludeVacc ? (
            <div className="space-y-2">
              <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                Прививки в журнале ({vaccColumns.length})
              </Label>
              {vaccColumns.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {vaccColumns.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 rounded-full bg-[#eef1ff] px-3 py-1 text-[12px] text-[#3848c7]"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() =>
                          setVaccColumns((current) => current.filter((item) => item !== v))
                        }
                        className="text-[#9b9fb3] hover:text-[#a13a32]"
                        aria-label={`Удалить ${v}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[#9b9fb3]">Список пуст. Добавьте первую прививку.</p>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-lg border-0 bg-[#5566f6]/[0.04] px-4 text-[14px] font-semibold text-[#5566f6] shadow-none hover:bg-[#5566f6]/[0.09]"
                onClick={() => void addVaccColumn()}
              >
                + Добавить прививку
              </Button>
            </div>
          ) : null}
        </JournalSettingsModal>
      ) : (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
            <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
              <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
                Настройки журнала
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-6 py-5">
              <Label>Название документа</Label>
              <Input
                value={settingsTitle}
                onChange={(event) => setSettingsTitle(event.target.value)}
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl border-[#dcdfed] px-5"
                onClick={() => void addVaccColumn()}
              >
                Добавить прививку
              </Button>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={saving || !settingsTitle.trim()}
                  className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#4a5bf0]"
                  onClick={async () => {
                    try {
                      await sync(rows, settingsTitle.trim(), {
                        examinations: examColumns,
                        vaccinations: vaccColumns,
                        includeVaccinations,
                      });
                      setDocTitle(settingsTitle.trim());
                      setSettingsOpen(false);
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Не удалось сохранить настройки",
                      );
                    }
                  }}
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Добавление новой строки
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Должность</Label>
              <Input
                value={draft.positionTitle}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    positionTitle: event.target.value,
                  }))
                }
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                placeholder="Должность"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
              <Select
                value={draft.employeeId || NONE_VALUE}
                onValueChange={(raw) => {
                  const value = raw === NONE_VALUE ? "" : raw;
                  const employee = availableEmployees.find(
                    (item) => item.id === value,
                  );
                  setDraft((current) => ({
                    ...current,
                    employeeId: value,
                    positionTitle: employee
                      ? getUserRoleLabel(employee.role)
                      : current.positionTitle,
                  }));
                }}
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="— выберите —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— выберите —</SelectItem>
                  {availableEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Дата рождения</Label>
                <Input
                  type="date"
                  value={draft.birthDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      birthDate: event.target.value,
                    }))
                  }
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Дата приема</Label>
                <Input
                  type="date"
                  value={draft.hireDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      hireDate: event.target.value,
                    }))
                  }
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Пол</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["male", "Мужской"],
                    ["female", "Женский"],
                  ] as const
                ).map(([value, label]) => {
                  const active = draft.gender === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, gender: value }))}
                      className={`flex h-9 items-center justify-center rounded-xl border px-3.5 text-[14px] font-medium transition-colors ${
                        active
                          ? "border-[#5566f6] bg-[#5566f6] text-white"
                          : "border-[#dcdfed] bg-white text-[#0b1024] hover:bg-[#fafbff]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Номер мед. книжки</Label>
              <Input
                value={draft.medBookNumber}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    medBookNumber: event.target.value,
                  }))
                }
                placeholder="Введите номер мед. книжки"
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Примечание</Label>
              <Input
                value={draft.note}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Примечание"
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Фото</Label>
              <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dcdfed] bg-white px-6 py-8 text-center">
                {draft.photoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.photoUrl}
                      alt="Фото сотрудника"
                      className="mx-auto h-24 rounded-xl object-cover"
                    />
                  </>
                ) : (
                  <div className="text-[14px] text-[#5566f6]">
                    Выберите файл или перетащите его сюда
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void onPhoto(event.target.files, "add")}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full rounded-xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
              onClick={() => setAddOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={addEmployee}
              disabled={!draft.employeeId}
              className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
            >
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editRow ? (
        <Dialog
          open={Boolean(editRow)}
          onOpenChange={(value) => {
            if (!value) setEditId(null);
          }}
        >
          <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
            <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
              <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
                Редактирование строки
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Должность</Label>
                <Input
                  defaultValue={editRow.data.positionTitle}
                  onBlur={(event) =>
                    updateRow(editRow.id, { positionTitle: event.target.value })
                  }
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  placeholder="Должность"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-[#3c4053]">Дата рождения</Label>
                  <Input
                    type="date"
                    defaultValue={editRow.data.birthDate || ""}
                    onBlur={(event) =>
                      updateRow(editRow.id, {
                        birthDate: event.target.value || null,
                      })
                    }
                    className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-[#3c4053]">Дата приема</Label>
                  <Input
                    type="date"
                    defaultValue={editRow.data.hireDate || ""}
                    onBlur={(event) =>
                      updateRow(editRow.id, {
                        hireDate: event.target.value || null,
                      })
                    }
                    className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Номер мед. книжки</Label>
                <Input
                  defaultValue={editRow.data.medBookNumber || ""}
                  onBlur={(event) =>
                    updateRow(editRow.id, {
                      medBookNumber: event.target.value || null,
                    })
                  }
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  placeholder="Введите номер мед. книжки"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Примечание</Label>
                <Input
                  defaultValue={editRow.data.note || ""}
                  onBlur={(event) =>
                    updateRow(editRow.id, { note: event.target.value || null })
                  }
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  placeholder="Примечание"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Фото</Label>
                <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dcdfed] bg-white px-6 py-8 text-center">
                  {editRow.data.photoUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editRow.data.photoUrl}
                        alt="Фото сотрудника"
                        className="mx-auto h-24 rounded-xl object-cover"
                      />
                    </>
                  ) : (
                    <div className="text-[14px] text-[#5566f6]">
                      Выберите файл или перетащите его сюда
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void onPhoto(event.target.files, "edit")}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-xl border-[#ffd7d3] px-5 text-[14px] font-medium text-[#ff4d4f] shadow-none hover:bg-[#fff4f2] sm:w-auto"
                onClick={() => void deleteRow(editRow.id, editRow.name)}
              >
                <Trash2 className="mr-2 size-4" />
                Удалить
              </Button>
              <Button
                type="button"
                className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
                onClick={() => setEditId(null)}
              >
                Закрыть
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
