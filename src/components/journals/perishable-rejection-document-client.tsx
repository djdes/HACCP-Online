"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_CONTENT_WIDE_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { USER_ROLE_LABEL_VALUES, getUsersForRoleLabel } from "@/lib/user-roles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createPerishableRejectionRow,
  normalizePerishableRejectionConfig,
  STORAGE_CONDITION_LABELS,
  ORGANOLEPTIC_LABELS,
  type PerishableRejectionConfig,
  type PerishableRejectionRow,
} from "@/lib/perishable-rejection-document";
import { useDocumentCloseAction } from "@/components/journals/document-close-button";
import { PositionSelectItems } from "@/components/shared/position-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import { confirmAsync } from "@/components/ui/confirm-async";
import { promptAsync } from "@/components/ui/prompt-async";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  MobileViewToggle,
  MobileViewTableWrapper,
} from "@/components/journals/mobile-view-toggle";
import {
  RecordCardsView,
  type RecordCardItem,
} from "@/components/journals/record-cards-view";
import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_VIEWPORT_CLASS,
} from "@/components/journals/journal-grid";
import { JournalPaperHeaderRows } from "@/components/journals/journal-document-header";

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
  status: string;
  initialConfig: PerishableRejectionConfig;
  users: { id: string; name: string; role: string }[];
};

const RESPONSIBLE_POSITIONS = USER_ROLE_LABEL_VALUES;

/**
 * ЭКРАН = WeSetup (мягкие серые рамки `#ececf4`, шапка `#f8f9fc`),
 * ПЕЧАТЬ (Ctrl+P) = «бумага» для инспектора РПН/СЭС (чёрные рамки,
 * белая шапка). Поэтому каждый токен несёт пару screen + `print:`.
 */
/** Скруглённый viewport вокруг таблицы; в печати — прозрачный wrapper. */

/** Общий вид триггера shadcn-селекта внутри форм журнала. */
const SELECT_TRIGGER_CLASS =
  "h-9 w-full rounded-xl border-[#dcdfed] bg-white px-3.5 text-[13.5px] text-[#0b1024] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15";
/**
 * `<SelectItem value="">` в Radix запрещён — пустая строка зарезервирована
 * под «ничего не выбрано». Поэтому пункт «— выберите —» несёт сентинел,
 * который на входе/выходе мапится в пустую строку.
 */
const NONE_VALUE = "__none";
const fromNone = (value: string) => (value === NONE_VALUE ? "" : value);
const toNone = (value: string) => (value ? value : NONE_VALUE);

/** Сколько строк максимум разрешаем добавить одной пачкой. */
const BULK_ROWS_MAX = 50;

/**
 * Доля служебной колонки с чекбоксом в общей ширине бланка (P8).
 *
 * Именно ПРОЦЕНТ, а не фиксированные 36px: при `table-fixed` фиксированная
 * колонка складывалась со 100% процентных, и таблица становилась шире
 * бумажного полотна — правая колонка «Примечание» разрезалась краем.
 */
const CHECKBOX_COL_PERCENT = 2.6;

/**
 * Заголовок колонки бланка бракеража (P8).
 *
 * Раньше стоял `break-words` (`overflow-wrap: break-word`) — он разрешает
 * рвать слово В ЛЮБОМ месте, если оно не влезает, и на узких колонках
 * давал «Кол- во» и оторванную скобку в «(ФИО, должность )». Перенос
 * теперь ТОЛЬКО по словам; место освободили сами колонки (см. веса выше)
 * и шрифт 11.5px, как в бракераже готовой продукции.
 */
const HEAD_CELL_CLASS = `${GRID_HEAD_CELL_CLASS} px-1.5 py-1.5 text-[11.5px] font-semibold leading-[1.25] [overflow-wrap:normal] [word-break:normal] hyphens-none`;

/** Пауза до автосохранения после последнего нажатия клавиши. */
const AUTOSAVE_DELAY_MS = 900;

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowHour() {
  return String(new Date().getHours()).padStart(2, "0");
}

function nowMinute() {
  return String(new Date().getMinutes()).padStart(2, "0");
}

function padTwo(n: number) {
  return String(n).padStart(2, "0");
}

function parseTimeToHM(time: string): { h: string; m: string } {
  if (!time) return { h: nowHour(), m: nowMinute() };
  const [h = "00", m = "00"] = time.split(":");
  return { h, m };
}

function mergeHM(h: string, m: string) {
  return `${h}:${m}`;
}

export function PerishableRejectionDocumentClient({
  documentId,
  title,
  organizationName,
  controlPeriodicity = "",
  dateFrom,
  status,
  initialConfig,
  users,
}: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState(() =>
    normalizePerishableRejectionConfig(initialConfig)
  );
  const readOnly = status === "closed";
  // «Настройки журнала» — название документа и дата начала. Раньше их
  // можно было изменить только со страницы списка; теперь доступны из «⋯».
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState(title);
  const [settingsDateFrom, setSettingsDateFrom] = useState(dateFrom);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const closeAction = useDocumentCloseAction({ documentId, title: settingsTitle });

  async function saveDocumentSettings() {
    setSettingsSaving(true);
    try {
      const response = await fetch(`/api/journal-documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: settingsTitle.trim() || title,
          dateFrom: settingsDateFrom,
        }),
      });
      if (!response.ok) throw new Error();
      setSettingsOpen(false);
      router.refresh();
    } catch {
      toast.error("Не удалось сохранить настройки");
    } finally {
      setSettingsSaving(false);
    }
  }
  const { mobileView, switchMobileView } = useMobileView("perishable_rejection");

  const cardItems: RecordCardItem[] = config.rows.map((row, index) => ({
    id: row.id,
    title: `№${index + 1} · ${row.productName || "—"}`,
    subtitle:
      [row.arrivalDate, row.arrivalTime].filter(Boolean).join(" ") || undefined,
    leading: !readOnly ? (
      <Checkbox
        checked={selectedRows.includes(row.id)}
        onCheckedChange={(checked) => toggleRow(row.id, checked === true)}
        className="size-5"
      />
    ) : null,
    fields: [
      { label: "Дата выработки", value: row.productionDate, hideIfEmpty: true },
      { label: "Изготовитель/поставщик", value: row.manufacturer, hideIfEmpty: true },
      { label: "Количество", value: row.quantity, hideIfEmpty: true },
      { label: "Документ безопасности", value: row.documentNumber, hideIfEmpty: true },
      {
        label: "Органолептика",
        value: ORGANOLEPTIC_LABELS[row.organolepticResult] || row.organolepticResult,
        hideIfEmpty: true,
      },
      {
        label: "Условия хранения",
        value: STORAGE_CONDITION_LABELS[row.storageCondition] || row.storageCondition,
        hideIfEmpty: true,
      },
      { label: "Реализовано", value: `${row.actualSaleDate || ""} ${row.actualSaleTime || ""}`.trim(), hideIfEmpty: true },
      { label: "Ответственный", value: row.responsiblePerson, hideIfEmpty: true },
      { label: "Примечание", value: row.note, hideIfEmpty: true },
    ],
  }));
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [activeListSection, setActiveListSection] = useState<
    "products" | "manufacturers" | "suppliers"
  >("products");
  const [newListName, setNewListName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [activeListId, setActiveListId] = useState<string>("");

  const [draftRow, setDraftRow] = useState<PerishableRejectionRow>(() =>
    createPerishableRejectionRow({
      arrivalDate: nowDate(),
      arrivalTime: mergeHM(nowHour(), nowMinute()),
      organolepticResult: "compliant",
      storageCondition: "2_6",
      responsiblePerson: users[0]?.name || "",
    })
  );
  const [draftPosition, setDraftPosition] = useState(RESPONSIBLE_POSITIONS[0]);
  const [draftUserId, setDraftUserId] = useState("");

  const productOptions = useMemo(() => {
    const fromLists = config.productLists.flatMap((list) => list.items);
    return Array.from(new Set(fromLists)).filter(Boolean);
  }, [config.productLists]);

  // Dedupe manufacturer/supplier catalogs at render time — legacy
  // documents may contain duplicate entries (same name typed twice
  // by different staff), and React would warn about duplicate keys
  // in the <option key={name}> selects below.
  const manufacturerOptions = useMemo(
    () => Array.from(new Set(config.manufacturers.filter(Boolean))),
    [config.manufacturers]
  );
  const supplierOptions = useMemo(
    () => Array.from(new Set(config.suppliers.filter(Boolean))),
    [config.suppliers]
  );

  /* ── Автосохранение (паттерн finished_product) ──────────────────────
   * Кнопки «Сохранить» нет: правки уезжают на сервер сами. Последнее
   * состояние конфига держим в ref, PATCH шлём через AUTOSAVE_DELAY_MS
   * после последнего нажатия клавиши. Blur ячейки и структурные операции
   * (добавить/удалить строку, правка справочников) сбрасывают очередь
   * немедленно, размонтирование — тоже. `router.refresh()` внутри
   * автосейва не зовём: он перерисовывает серверный компонент и сбивает
   * фокус в поле.
   */
  const configRef = useRef(config);
  configRef.current = config;
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushConfigSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setIsSaving(true);
    void fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: configRef.current }),
    })
      .then((response) => {
        if (!response.ok) throw new Error();
      })
      .catch(() =>
        toast.error(
          "Не удалось сохранить журнал — изменения остались только на экране"
        )
      )
      .finally(() => setIsSaving(false));
  }, [documentId]);

  /**
   * Применить изменение конфига и поставить запись в очередь.
   * `immediate` шлём через `setTimeout(0)`, чтобы React успел закоммитить
   * состояние и `configRef.current` уже содержал новое значение.
   */
  const applyConfig = useCallback(
    (
      updater: (prev: PerishableRejectionConfig) => PerishableRejectionConfig,
      immediate = false
    ) => {
      setConfig(updater);
      dirtyRef.current = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(
        flushConfigSave,
        immediate ? 0 : AUTOSAVE_DELAY_MS
      );
    },
    [flushConfigSave]
  );

  // Уход со страницы не должен съедать последний недописанный ввод.
  useEffect(() => () => flushConfigSave(), [flushConfigSave]);

  function updateRow(id: string, patch: Partial<PerishableRejectionRow>) {
    applyConfig((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    }));
  }

  function toggleRow(id: string, checked: boolean) {
    if (readOnly) return;
    setSelectedRows((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );
  }

  async function removeSelectedRows() {
    if (readOnly) return;
    if (selectedRows.length === 0) return;
    const names = config.rows
      .filter((row) => selectedRows.includes(row.id))
      .map((row) => row.productName)
      .filter(Boolean);
    const confirmed = await confirmAsync({
      title: "Удалить выбранные записи?",
      description: "Записи бракеража скоропортящейся продукции исчезнут из журнала.",
      variant: "danger",
      confirmLabel: "Удалить",
      bullets: [
        { label: `Записей будет удалено: ${selectedRows.length}`, tone: "warn" },
        names.length > 0
          ? {
              label: `Изделия: ${names.slice(0, 4).join(", ")}${names.length > 4 ? " и др." : ""}`,
              tone: "info" as const,
            }
          : { label: "У выбранных записей не заполнено наименование", tone: "info" as const },
        {
          label: `Останется записей: ${config.rows.length - selectedRows.length}`,
          tone: "default",
        },
      ],
    });
    if (!confirmed) return;
    applyConfig((prev) => ({
      ...prev,
      rows: prev.rows.filter((row) => !selectedRows.includes(row.id)),
    }));
    setSelectedRows([]);
  }

  function addSingleRow(productName = "") {
    if (readOnly) return;
    applyConfig((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        createPerishableRejectionRow({
          productName,
          arrivalDate: nowDate(),
          arrivalTime: mergeHM(nowHour(), nowMinute()),
          organolepticResult: "compliant",
          storageCondition: "2_6",
          responsiblePerson: users[0]?.name || "",
        }),
      ],
    }));
  }

  function addRowsFromList() {
    if (readOnly) return;
    const list = config.productLists.find((l) => l.id === activeListId);
    if (!list) return;
    list.items.forEach((item) => addSingleRow(item));
  }

  /** «Добавить несколько изделий» — пачка пустых строк. */
  async function addSeveralRows() {
    if (readOnly) return;
    const raw = await promptAsync({
      title: "Добавить несколько изделий",
      description:
        "В таблицу добавятся пустые строки с текущей датой и временем поступления — останется вписать наименования.",
      label: "Сколько строк добавить",
      type: "number",
      defaultValue: "3",
      placeholder: "3",
      confirmLabel: "Добавить",
      validate: (value) => {
        const count = Number(value);
        if (!value.trim()) return "Введите число";
        if (!Number.isInteger(count) || count <= 0) return "Нужно целое число больше нуля";
        if (count > BULK_ROWS_MAX)
          return `За один раз можно добавить не больше ${BULK_ROWS_MAX} строк`;
        return null;
      },
    });
    if (raw === null) return;
    const count = Number(raw);
    if (!Number.isInteger(count) || count <= 0 || count > BULK_ROWS_MAX) return;
    for (let i = 0; i < count; i += 1) addSingleRow();
  }

  /** «Добавить списком» — многострочная вставка наименований. */
  function addRowsFromText() {
    if (readOnly) return;
    const items = bulkText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    items.forEach((item) => addSingleRow(item));
    setBulkText("");
    setBulkOpen(false);
    toast.success(`Добавлено строк: ${items.length}`);
  }

  function resetDraftRow() {
    setDraftRow(
      createPerishableRejectionRow({
        arrivalDate: nowDate(),
        arrivalTime: mergeHM(nowHour(), nowMinute()),
        organolepticResult: "compliant",
        storageCondition: "2_6",
        responsiblePerson: users[0]?.name || "",
      })
    );
    setDraftPosition(RESPONSIBLE_POSITIONS[0]);
    setDraftUserId("");
  }

  async function saveDraftRow() {
    if (readOnly) return;
    const user = users.find((u) => u.id === draftUserId);
    const responsible = user
      ? `${user.name}, ${draftPosition}`
      : draftPosition;
    applyConfig(
      (prev) => ({
        ...prev,
        rows: [...prev.rows, { ...draftRow, responsiblePerson: responsible }],
      }),
      true
    );
    resetDraftRow();
    setAddModalOpen(false);
  }

  /* ---------- List modal helpers ---------- */

  function addProductList() {
    if (readOnly) return;
    if (!newListName.trim()) return;
    const id = `list-${Date.now()}`;
    applyConfig((prev) => ({
      ...prev,
      productLists: [
        ...prev.productLists,
        { id, name: newListName.trim(), items: [] },
      ],
    }));
    setNewListName("");
  }

  function addItemToProductList(item: string) {
    if (readOnly) return;
    if (!activeListId) return;
    applyConfig((prev) => ({
      ...prev,
      productLists: prev.productLists.map((list) =>
        list.id === activeListId && !list.items.includes(item)
          ? { ...list, items: [...list.items, item] }
          : list
      ),
    }));
  }

  function addProductItem() {
    if (readOnly) return;
    if (!newItemName.trim()) return;
    const list = config.productLists[0];
    if (!list) return;
    applyConfig((prev) => ({
      ...prev,
      productLists: prev.productLists.map((l) =>
        l.id === list.id && !l.items.includes(newItemName.trim())
          ? { ...l, items: [...l.items, newItemName.trim()] }
          : l
      ),
    }));
    setNewItemName("");
  }

  function addManufacturerItem() {
    if (readOnly) return;
    if (!newItemName.trim()) return;
    applyConfig((prev) => ({
      ...prev,
      manufacturers: [...prev.manufacturers, newItemName.trim()],
    }));
    setNewItemName("");
  }

  function addSupplierItem() {
    if (readOnly) return;
    if (!newItemName.trim()) return;
    applyConfig((prev) => ({
      ...prev,
      suppliers: [...prev.suppliers, newItemName.trim()],
    }));
    setNewItemName("");
  }

  async function importItemsFromText(
    section: "products" | "manufacturers" | "suppliers",
  ) {
    if (readOnly) return;
    const sectionLabel =
      section === "products"
        ? "изделий"
        : section === "manufacturers"
          ? "изготовителей"
          : "поставщиков";
    const text = await promptAsync({
      title: `Импорт ${sectionLabel}`,
      description:
        "Вставьте элементы через запятую или точку с запятой — они добавятся в справочник документа. Дубликаты будут отброшены.",
      label: "Список элементов",
      placeholder: "Молоко 3,2%; Творог 9%; Сметана 20%",
      confirmLabel: "Импортировать",
      validate: (value) => (value.trim() ? null : "Вставьте хотя бы один элемент"),
    });
    if (text === null) return;
    const items = text
      .split(/[\n;]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (section === "products") {
      const list = config.productLists[0];
      if (!list) return;
      applyConfig((prev) => ({
        ...prev,
        productLists: prev.productLists.map((l) =>
          l.id === list.id
            ? { ...l, items: Array.from(new Set([...l.items, ...items])) }
            : l
        ),
      }));
    } else if (section === "manufacturers") {
      applyConfig((prev) => ({
        ...prev,
        manufacturers: Array.from(new Set([...prev.manufacturers, ...items])),
      }));
    } else {
      applyConfig((prev) => ({
        ...prev,
        suppliers: Array.from(new Set([...prev.suppliers, ...items])),
      }));
    }
  }

  const arrivalHM = parseTimeToHM(draftRow.arrivalTime);
  const saleHM = parseTimeToHM(draftRow.actualSaleTime);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayFocusRowId = config.rows.find((row) => row.arrivalDate === todayKey)?.id;

  /**
   * Ширины колонок бланка бракеража (P8).
   *
   * Веса, а не готовые проценты: опциональное «Примечание» просто
   * добавляется в массив, и сетка пересчитывается сама — как в
   * `finished-product-document-client.tsx`. Сумма ВСЕГДА равна 100%
   * вместе с колонкой чекбокса, поэтому `table-fixed` не раздувает
   * таблицу шире бумажного полотна (1150px).
   *
   * Порядок весов = порядок `<th>` ниже:
   * дата поступления · наименование · дата выработки · изготовитель ·
   * фасовка · номер документа · органолептика · условия хранения ·
   * дата реализации · ответственное лицо · (примечание).
   */
  const columnWeights = config.showNote
    ? [95, 110, 78, 100, 92, 92, 100, 100, 84, 96, 70]
    : [95, 118, 82, 106, 96, 96, 106, 106, 88, 102];
  const columnWeightsTotal = columnWeights.reduce((sum, weight) => sum + weight, 0);
  const columnWidths = columnWeights.map(
    (weight) =>
      `${((weight / columnWeightsTotal) * (100 - CHECKBOX_COL_PERCENT)).toFixed(3)}%`
  );

  return (
    <div className="text-black">
      <FocusTodayScroller
        onCreate={!readOnly ? () => setAddModalOpen(true) : undefined}
      />
      {/* Q3: `space-y-6` на корне снят — вертикальный ритм задают токены
          DOC_* (иначе зазор H1 → шапка «плавал» между 24 и 28px). */}
      <DocumentActionsBar
        className={DOC_TITLE_ROW_NO_STRIP_CLASS}
        backHref="/journals/perishable_rejection"
        documentId={documentId}
        heading={<h1 className={DOC_HEADING_CLASS}>{settingsTitle}</h1>}
        onSettings={!readOnly ? () => setSettingsOpen(true) : undefined}
        menuItems={
          !readOnly
            ? [
                {
                  key: "close-journal",
                  label: "Закончить журнал",
                  icon: <Archive className="size-4" />,
                  onSelect: () => void closeAction.closeDocument(),
                  disabled: closeAction.isClosing,
                },
              ]
            : []
        }
      />
      {readOnly ? (
        <div className="mb-6">
          <JournalClosedBanner hint="Верните журнал в активные, чтобы снова вносить записи бракеража скоропортящейся продукции." />
        </div>
      ) : null}

      {/* Обёртка — как у finished_product: без карточной рамки и без
          `overflow-hidden`. Именно `overflow-hidden` на карточке резал
          таблицу по правому краю: горизонтальный скролл живёт ВНУТРИ
          GRID_VIEWPORT_CLASS, а внешний клип его перекрывал. */}
      {/* R1: бумажное полотно — во всю ширину контентной колонки. */}
      <div className={`${DOC_BODY_STACK_CLASS} ${DOC_PAPER_CANVAS_CLASS}`}>
        {/* HACCP header table */}
        <table className={`${DOC_PAPER_HEADER_CLASS} w-full border-collapse text-[13px]`}>
          <tbody>
            <JournalPaperHeaderRows
              orgName={organizationName}
              title="ЖУРНАЛ БРАКЕРАЖА СКОРОПОРТЯЩЕЙСЯ ПИЩЕВОЙ ПРОДУКЦИИ"
              startedAt={dateFrom}
              finishedAt={readOnly ? dateFrom : null}
              controlPeriodicity={controlPeriodicity}
              orgCellClass="w-[18%]"
              sideCellClass="w-[20%]"
            />
          </tbody>
        </table>

        <h2 className={`${DOC_CAPS_TITLE_CLASS} text-center text-[13px] font-bold uppercase leading-tight sm:text-[14px]`}>
          ЖУРНАЛ БРАКЕРАЖА СКОРОПОРТЯЩЕЙСЯ ПИЩЕВОЙ ПРОДУКЦИИ
        </h2>

        {/* Action buttons */}
        <div className={DOC_ADD_ROW_CLASS}>
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#4a5bf0]"
                >
                  <Plus className="size-5" strokeWidth={2.5} />
                  Добавить
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[280px] rounded-[24px] border-0 p-3 shadow-xl">
                <DropdownMenuItem
                  className="mb-1 h-9 rounded-xl px-3.5 text-[13.5px]"
                  onSelect={() => setAddModalOpen(true)}
                >
                  Добавить изделие
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="mb-1 h-9 rounded-xl px-3.5 text-[13.5px]"
                  onSelect={() => void addSeveralRows()}
                >
                  Добавить несколько изделий
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="mb-1 h-9 rounded-xl px-3.5 text-[13.5px]"
                  onSelect={addRowsFromList}
                >
                  Добавить из списка
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-9 rounded-xl px-3.5 text-[13.5px]"
                  onSelect={() => {
                    setBulkText("");
                    setBulkOpen(true);
                  }}
                >
                  Добавить списком
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* P1: прямая кнопка добавления рядом со сплитом — ровно как
              «+ Добавить изделие» в finished_product. Раньше единственный
              способ завести строку прятался внутрь дропдауна: два клика
              вместо одного на самом частом действии журнала. */}
          {!readOnly && (
            <Button
              type="button"
              className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#4a5bf0]"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Добавить запись
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className={DOC_SECONDARY_BUTTON_CLASS}
            onClick={() => setListModalOpen(true)}
            disabled={readOnly}
          >
            Редактировать список изделий
          </Button>
          {/* Кнопки «Сохранить» нет: правки уезжают сами (см. applyConfig). */}
          {isSaving ? (
            <span className="text-[13px] text-[#6f7282]">Сохранение…</span>
          ) : null}
        </div>

        {!readOnly ? (
          <JournalSelectionBar
            count={selectedRows.length}
            onClear={() => setSelectedRows([])}
            onDelete={() => void removeSelectedRows()}
            hint="Строки бракеража будут удалены без возможности отмены"
          />
        ) : null}

        {/* View toggle */}
        <div className="sm:hidden print:hidden">
          <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
        </div>

        {/* Карточки — только на телефоне. Раньше обёртки `sm:hidden` не
            было, и на десктопе «Записей пока нет.» висело над таблицей. */}
        {mobileView === "cards" ? (
          <div className="sm:hidden print:hidden">
            <RecordCardsView items={cardItems} emptyLabel="Записей пока нет." />
          </div>
        ) : null}

        {/* Main data table */}
        <MobileViewTableWrapper mobileView={mobileView} className={GRID_VIEWPORT_CLASS}>
          {/* Паттерн N4 (finished_product): `table-fixed` + colgroup в
              процентах. Раньше стоял `min-w-[2200px]` без фиксированной
              раскладки — колонки расползались, «Примечание» уезжало из
              контейнера. Скролл живёт ВНУТРИ viewport-обёртки.

              P3: `min-w-[1600px]` был шире полотна (~1150-1250px), поэтому
              ПОСЛЕДНЯЯ колонка всегда упиралась в правый край контейнера и
              её правая рамка обрезалась.

              P8 (финальная сверка): даже с `min-w-[1180px]` таблица не
              влезала в полотно 1150 по ДВУМ причинам сразу — сам минимум
              был больше полотна И проценты колонок в сумме давали 100%
              ПЛЮС фиксированные 36px чекбокса, то есть `table-fixed`
              раздувал таблицу ещё на ширину чекбокса. «Примечание»
              физически разрезалось правым краем.

              Теперь ВСЕ колонки, включая чекбокс, заданы процентами от
              одной суммы 100%, а ширины считаются из весов — включение
              опционального «Примечания» пересчитывает сетку, а не ломает
              её. Минимум опущен до 1040px: на десктопе таблица ровно по
              полотну (правая рамка видна), на узких экранах остаётся
              скролл внутри viewport'а. */}
          <table className="w-full min-w-[1040px] table-fixed border-collapse text-[12.5px]">
            <colgroup>
              {/* Q2-3: служебная колонка выделения не печатается. */}
              <col className="print:hidden" style={{ width: `${CHECKBOX_COL_PERCENT}%` }} />
              {columnWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {/* Select-all — как в остальных журналах: одна галочка
                    отмечает все строки листа, снятие очищает выделение. */}
                <th className={`${GRID_HEAD_CELL_CLASS} px-1 py-1.5 text-center leading-tight print:hidden`}>
                  <Checkbox
                    checked={config.rows.length > 0 && selectedRows.length === config.rows.length}
                    onCheckedChange={(checked) =>
                      !readOnly &&
                      setSelectedRows(checked === true ? config.rows.map((row) => row.id) : [])
                    }
                    disabled={readOnly || config.rows.length === 0}
                    aria-label="Выбрать все строки"
                  />
                </th>
                <th className={HEAD_CELL_CLASS}>
                  Дата, время поступления пищ. продукции
                </th>
                <th className={HEAD_CELL_CLASS}>Наименование</th>
                <th className={HEAD_CELL_CLASS}>Дата выработки</th>
                <th className={HEAD_CELL_CLASS}>Изготовитель/поставщик</th>
                <th className={HEAD_CELL_CLASS}>
                  Фасовка/Кол-во поступившего продукта (в кг, литрах, шт)
                </th>
                <th className={HEAD_CELL_CLASS}>
                  Номер документа, подтверждающего безопасность
                </th>
                <th className={HEAD_CELL_CLASS}>
                  Результаты органолептической оценки
                </th>
                <th className={HEAD_CELL_CLASS}>
                  Условия хранения, конечный срок реализации
                </th>
                <th className={HEAD_CELL_CLASS}>
                  Дата, время фактической реализации
                </th>
                <th className={HEAD_CELL_CLASS}>
                  Ответственное лицо (ФИО, должность)
                </th>
                {/* «Примечание» — опциональная колонка состава таблицы
                    (тумблер в диалоге создания, P2 аудита). */}
                {config.showNote ? (
                  <th className={HEAD_CELL_CLASS}>Примечание</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {/* Пустое состояние = ПУСТАЯ СТРОКА бланка (чекбокс + пустые
                  ячейки), как на эталоне. Текстовой заглушки внутри таблицы
                  нет — бланк должен выглядеть бланком, а подсказка «Нажмите
                  Добавить» живёт на кнопке над таблицей. */}
              {config.rows.length === 0 ? (
                <tr>
                  <td className={`${GRID_CELL_CLASS} px-1 py-1 align-top leading-tight print:hidden`}>
                    <Checkbox checked={false} disabled />
                  </td>
                  {Array.from({ length: config.showNote ? 11 : 10 }, (_, index) => (
                    <td
                      key={index}
                      className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}
                    >
                      <div className="h-7" />
                    </td>
                  ))}
                </tr>
              ) : null}
              {config.rows.map((row) => (
                <tr key={row.id} data-focus-today={row.id === todayFocusRowId ? "" : undefined}>
                  <td className={`${GRID_CELL_CLASS} px-1 py-1 align-top leading-tight print:hidden`}>
                    <Checkbox
                      checked={selectedRows.includes(row.id)}
                      onCheckedChange={(checked) =>
                        toggleRow(row.id, checked === true)
                      }
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={`${row.arrivalDate} ${row.arrivalTime}`}
                      onChange={(e) => {
                        const [date = "", time = ""] =
                          e.target.value.split(" ");
                        updateRow(row.id, {
                          arrivalDate: date,
                          arrivalTime: time,
                        });
                      }}
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={row.productName}
                      onChange={(e) =>
                        updateRow(row.id, { productName: e.target.value })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={row.productionDate}
                      onChange={(e) =>
                        updateRow(row.id, { productionDate: e.target.value })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={
                        [row.manufacturer, row.supplier]
                          .filter(Boolean)
                          .join(" / ") || ""
                      }
                      onChange={(e) =>
                        updateRow(row.id, { manufacturer: e.target.value })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={
                        [row.packaging, row.quantity]
                          .filter(Boolean)
                          .join(" / ") || ""
                      }
                      onChange={(e) =>
                        updateRow(row.id, { packaging: e.target.value })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={row.documentNumber}
                      onChange={(e) =>
                        updateRow(row.id, {
                          documentNumber: e.target.value,
                        })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={
                        ORGANOLEPTIC_LABELS[row.organolepticResult] ||
                        row.organolepticResult
                      }
                      onChange={(e) =>
                        updateRow(row.id, {
                          organolepticResult: e.target.value
                            .toLowerCase()
                            .includes("не соответ")
                            ? "non_compliant"
                            : "compliant",
                        })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={`${STORAGE_CONDITION_LABELS[row.storageCondition] || row.storageCondition}, ${row.expiryDate}`}
                      onChange={(e) =>
                        updateRow(row.id, { expiryDate: e.target.value })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={`${row.actualSaleDate} ${row.actualSaleTime}`}
                      onChange={(e) => {
                        const [date = "", time = ""] =
                          e.target.value.split(" ");
                        updateRow(row.id, {
                          actualSaleDate: date,
                          actualSaleTime: time,
                        });
                      }}
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                    <Input
                      value={row.responsiblePerson}
                      onChange={(e) =>
                        updateRow(row.id, {
                          responsiblePerson: e.target.value,
                        })
                      }
                      onBlur={flushConfigSave}
                      className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                      disabled={readOnly}
                    />
                  </td>
                  {config.showNote ? (
                    <td className={`${GRID_CELL_CLASS} p-1 align-top leading-tight`}>
                      <Input
                        value={row.note}
                        onChange={(e) =>
                          updateRow(row.id, { note: e.target.value })
                        }
                        onBlur={flushConfigSave}
                        className="h-7 border-0 px-1.5 text-[12.5px] shadow-none"
                        disabled={readOnly}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </MobileViewTableWrapper>
      </div>

      {/* Add Row Dialog — design-system shape: padded header, body
       * sections, bottom-stuck footer with secondary + primary buttons. */}
      <Dialog open={readOnly ? false : addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Добавление новой строки
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
            {/* Дата и время поступления */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Дата и время поступления
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
                <Input
                  type="date"
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  value={draftRow.arrivalDate}
                  onChange={(e) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      arrivalDate: e.target.value,
                    }))
                  }
                />
                <Select
                  value={arrivalHM.h}
                  onValueChange={(value) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      arrivalTime: mergeHM(value, arrivalHM.m),
                    }))
                  }
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Час" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={padTwo(i)}>
                        {padTwo(i)} ч
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={arrivalHM.m}
                  onValueChange={(value) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      arrivalTime: mergeHM(arrivalHM.h, value),
                    }))
                  }
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Мин" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 60 }, (_, i) => (
                      <SelectItem key={i} value={padTwo(i)}>
                        {padTwo(i)} мин
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Наименование изделия */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Наименование изделия
              </Label>
              <Select
                value={toNone(
                  productOptions.includes(draftRow.productName)
                    ? draftRow.productName
                    : ""
                )}
                onValueChange={(value) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    productName: fromNone(value),
                  }))
                }
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="— выберите из списка —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— выберите из списка —</SelectItem>
                  {productOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                placeholder="Или введите новое наименование"
                value={
                  productOptions.includes(draftRow.productName)
                    ? ""
                    : draftRow.productName
                }
                onChange={(e) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    productName: e.target.value,
                  }))
                }
              />
            </div>

            {/* Дата выработки */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Дата выработки
              </Label>
              <Input
                type="date"
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                value={draftRow.productionDate}
                onChange={(e) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    productionDate: e.target.value,
                  }))
                }
              />
            </div>

            {/* Изготовитель */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Изготовитель
              </Label>
              <Select
                value={toNone(
                  config.manufacturers.includes(draftRow.manufacturer)
                    ? draftRow.manufacturer
                    : ""
                )}
                onValueChange={(value) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    manufacturer: fromNone(value),
                  }))
                }
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="— выберите из списка —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— выберите из списка —</SelectItem>
                  {manufacturerOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                placeholder="Или введите нового изготовителя"
                value={
                  config.manufacturers.includes(draftRow.manufacturer)
                    ? ""
                    : draftRow.manufacturer
                }
                onChange={(e) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    manufacturer: e.target.value,
                  }))
                }
              />
            </div>

            {/* Поставщик */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Поставщик
              </Label>
              <Select
                value={toNone(
                  config.suppliers.includes(draftRow.supplier)
                    ? draftRow.supplier
                    : ""
                )}
                onValueChange={(value) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    supplier: fromNone(value),
                  }))
                }
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="— выберите из списка —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— выберите из списка —</SelectItem>
                  {supplierOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                placeholder="Или введите нового поставщика"
                value={
                  config.suppliers.includes(draftRow.supplier)
                    ? ""
                    : draftRow.supplier
                }
                onChange={(e) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    supplier: e.target.value,
                  }))
                }
              />
            </div>

            {/* Фасовка + Кол-во side-by-side */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">
                  Фасовка
                </Label>
                <Input
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  value={draftRow.packaging}
                  onChange={(e) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      packaging: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">
                  Количество
                </Label>
                <Input
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  value={draftRow.quantity}
                  onChange={(e) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Номер документа */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Номер документа
              </Label>
              <Input
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                value={draftRow.documentNumber}
                onChange={(e) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    documentNumber: e.target.value,
                  }))
                }
              />
            </div>

            {/* Органолептическая оценка — pill-style segmented control */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Органолептическая оценка
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["compliant", "Соответствует", "#136b2a", "#ecfdf5"],
                    ["non_compliant", "Не соответствует", "#d2453d", "#fff4f2"],
                  ] as const
                ).map(([value, label, fg, bg]) => {
                  const active = draftRow.organolepticResult === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setDraftRow((prev) => ({
                          ...prev,
                          organolepticResult: value,
                        }))
                      }
                      className={`flex h-9 items-center justify-center gap-2 rounded-xl border px-3.5 text-[14px] font-medium transition-colors ${
                        active
                          ? "border-transparent text-white"
                          : "border-[#dcdfed] bg-white text-[#0b1024] hover:bg-[#fafbff]"
                      }`}
                      style={
                        active ? { backgroundColor: fg, color: "white" } : { backgroundColor: bg, color: fg, borderColor: bg }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Условия хранения — radio cards */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Условия хранения
              </Label>
              <div className="flex flex-col gap-2">
                {(
                  Object.entries(STORAGE_CONDITION_LABELS) as [string, string][]
                ).map(([key, label]) => {
                  const active = draftRow.storageCondition === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDraftRow((prev) => ({
                          ...prev,
                          storageCondition: key as PerishableRejectionRow["storageCondition"],
                        }))
                      }
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-[14px] transition-colors ${
                        active
                          ? "border-[#5566f6] bg-[#f5f6ff] text-[#0b1024]"
                          : "border-[#dcdfed] bg-white text-[#3c4053] hover:bg-[#fafbff]"
                      }`}
                    >
                      <span className="font-medium">{label}</span>
                      <span
                        className={`flex size-5 items-center justify-center rounded-full border-2 ${
                          active ? "border-[#5566f6]" : "border-[#c7ccea]"
                        }`}
                      >
                        {active ? (
                          <span className="size-2 rounded-full bg-[#5566f6]" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Конечный срок реализации */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Конечный срок реализации
              </Label>
              <Input
                type="date"
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                value={draftRow.expiryDate}
                onChange={(e) =>
                  setDraftRow((prev) => ({
                    ...prev,
                    expiryDate: e.target.value,
                  }))
                }
              />
            </div>

            {/* Дата и время фактической реализации */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Дата и время фактической реализации
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
                <Input
                  type="date"
                  className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                  value={draftRow.actualSaleDate}
                  onChange={(e) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      actualSaleDate: e.target.value,
                    }))
                  }
                />
                <Select
                  value={saleHM.h}
                  onValueChange={(value) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      actualSaleTime: mergeHM(value, saleHM.m),
                    }))
                  }
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Час" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={padTwo(i)}>
                        {padTwo(i)} ч
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={saleHM.m}
                  onValueChange={(value) =>
                    setDraftRow((prev) => ({
                      ...prev,
                      actualSaleTime: mergeHM(saleHM.h, value),
                    }))
                  }
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Мин" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 60 }, (_, i) => (
                      <SelectItem key={i} value={padTwo(i)}>
                        {padTwo(i)} мин
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Должность + Сотрудник side-by-side */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">
                  Должность ответственного
                </Label>
                <Select
                  value={draftPosition}
                  onValueChange={(pos) => {
                    setDraftPosition(pos);
                    const candidates = getUsersForRoleLabel(users, pos);
                    if (draftUserId && !candidates.some((u) => u.id === draftUserId)) {
                      setDraftUserId("");
                    }
                  }}
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="— выберите должность —" />
                  </SelectTrigger>
                  <SelectContent>
                    <PositionSelectItems users={users} />
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">
                  Сотрудник
                </Label>
                <Select
                  value={toNone(draftUserId)}
                  onValueChange={(value) => setDraftUserId(fromNone(value))}
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="— выберите —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>— выберите —</SelectItem>
                    {getUsersForRoleLabel(users, draftPosition).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Примечание */}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Примечание
              </Label>
              <Input
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
                value={draftRow.note}
                onChange={(e) =>
                  setDraftRow((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full rounded-xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
              onClick={() => setAddModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
              onClick={() => {
                void saveDraftRow();
              }}
              disabled={isSaving}
            >
              {isSaving ? "Сохранение…" : "Добавить запись"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* «Добавить списком» — многострочная вставка вместо window.prompt. */}
      <Dialog open={readOnly ? false : bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Добавить изделия списком
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 py-5">
            <p className="text-[13px] leading-[1.55] text-[#6f7282]">
              Вставьте наименования изделий — каждое с новой строки. Для каждой строки
              создастся запись с текущей датой и временем поступления.
            </p>
            <Textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"Молоко 3,2%\nТворог 9%\nСметана 20%"}
              className="min-h-[180px] rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
            />
            <div className="text-[12px] text-[#9b9fb3]">
              Будет добавлено строк:{" "}
              {bulkText.split("\n").map((item) => item.trim()).filter(Boolean).length}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full rounded-xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none transition-colors hover:bg-[#fafbff] sm:w-auto"
              onClick={() => setBulkOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#4a5bf0] sm:w-auto"
              onClick={addRowsFromText}
              disabled={
                bulkText.split("\n").map((item) => item.trim()).filter(Boolean).length === 0
              }
            >
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lists Dialog */}
      <Dialog open={readOnly ? false : listModalOpen} onOpenChange={setListModalOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Редактировать список изделий
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 px-6 py-5">
            {/* Section tabs */}
            <div className="flex gap-2 border-b pb-2">
              {(
                [
                  ["products", "Изделия"],
                  ["manufacturers", "Изготовители"],
                  ["suppliers", "Поставщики"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                    activeListSection === key
                      ? "bg-[#5566f6] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setActiveListSection(key);
                    setNewItemName("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Products section */}
            {activeListSection === "products" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Списки изделий</Label>
                  {config.productLists.map((list) => (
                    <div
                      key={list.id}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      <Checkbox
                        checked={activeListId === list.id}
                        onCheckedChange={(v) =>
                          setActiveListId(v === true ? list.id : "")
                        }
                      />
                      <Input
                        value={list.name}
                        onChange={(e) =>
                          applyConfig((prev) => ({
                            ...prev,
                            productLists: prev.productLists.map((x) =>
                              x.id === list.id
                                ? { ...x, name: e.target.value }
                                : x
                            ),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          applyConfig((prev) => ({
                            ...prev,
                            productLists: prev.productLists.filter(
                              (x) => x.id !== list.id
                            ),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="Введите название нового списка"
                    />
                    <Button onClick={addProductList}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Изделия</Label>
                  {(() => {
                    const activeList = config.productLists.find(
                      (l) => l.id === activeListId
                    );
                    if (activeList) {
                      return Array.from(new Set(activeList.items)).map(
                        (item) => (
                          <div
                            key={item}
                            className="flex items-center gap-2 rounded-lg border p-2"
                          >
                            <div className="flex-1">{item}</div>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                applyConfig((prev) => ({
                                  ...prev,
                                  productLists: prev.productLists.map((list) =>
                                    list.id === activeListId
                                      ? {
                                          ...list,
                                          items: list.items.filter(
                                            (x) => x !== item
                                          ),
                                        }
                                      : list
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        )
                      );
                    }
                    return Array.from(new Set(productOptions)).map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-lg border p-2"
                      >
                        <div className="flex-1">{item}</div>
                        {activeListId && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => addItemToProductList(item)}
                          >
                            <Plus className="size-4" />
                          </Button>
                        )}
                      </div>
                    ));
                  })()}
                  <div className="flex gap-2">
                    <Input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Введите название нового изделия"
                    />
                    <Button onClick={addProductItem}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="text-[#5566f6] underline"
                    onClick={() => void importItemsFromText("products")}
                  >
                    Добавить из файла
                  </button>
                </div>
              </div>
            )}

            {/* Manufacturers section */}
            {activeListSection === "manufacturers" && (
              <div className="space-y-2">
                <Label>Изготовители</Label>
                {Array.from(new Set(config.manufacturers)).map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <div className="flex-1">{item}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        applyConfig((prev) => ({
                          ...prev,
                          manufacturers: prev.manufacturers.filter(
                            (x) => x !== item
                          ),
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Введите название изготовителя"
                  />
                  <Button onClick={addManufacturerItem}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <button
                  type="button"
                  className="text-[#5566f6] underline"
                  onClick={() => void importItemsFromText("manufacturers")}
                >
                  Добавить из файла
                </button>
              </div>
            )}

            {/* Suppliers section */}
            {activeListSection === "suppliers" && (
              <div className="space-y-2">
                <Label>Поставщики</Label>
                {Array.from(new Set(config.suppliers)).map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <div className="flex-1">{item}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        applyConfig((prev) => ({
                          ...prev,
                          suppliers: prev.suppliers.filter((x) => x !== item),
                        }))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Введите название поставщика"
                  />
                  <Button onClick={addSupplierItem}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <button
                  type="button"
                  className="text-[#5566f6] underline"
                  onClick={() => void importItemsFromText("suppliers")}
                >
                  Добавить из файла
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setListModalOpen(false);
                  flushConfigSave();
                }}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Настройки журнала — название документа и дата начала. */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Настройки журнала
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Название документа</Label>
              <Input
                value={settingsTitle}
                onChange={(event) => setSettingsTitle(event.target.value)}
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Дата начала</Label>
              <Input
                type="date"
                value={settingsDateFrom}
                onChange={(event) => setSettingsDateFrom(event.target.value)}
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={settingsSaving}
                onClick={() => void saveDocumentSettings()}
                className="h-10 rounded-xl bg-[#5566f6] px-6 text-[13.5px] font-medium text-white transition-colors hover:bg-[#4a5bf0]"
              >
                {settingsSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
