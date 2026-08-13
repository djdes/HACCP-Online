"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  ChevronDown,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_BODY_STACK_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_EXTRA_BLOCK_CLASS,
  DOC_HEADING_CLASS,
  DOC_PAPER_HEADER_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_CONTENT_WIDE_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  FINISHED_PRODUCT_QUALITY_GUIDE_TITLE,
  createFinishedProductRow,
  normalizeFinishedProductDocumentConfig,
  type FinishedProductDocumentConfig,
  type FinishedProductDocumentRow,
} from "@/lib/finished-product-document";
import { useDocumentCloseAction } from "@/components/journals/document-close-button";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  MobileViewToggle,
  MobileViewTableWrapper,
} from "@/components/journals/mobile-view-toggle";
import {
  RecordCardsView,
  type RecordCardItem,
} from "@/components/journals/record-cards-view";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import { confirmAsync } from "@/components/ui/confirm-async";
import { promptAsync } from "@/components/ui/prompt-async";

import { toast } from "sonner";
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
  dateTo: string;
  status: string;
  initialConfig: FinishedProductDocumentConfig;
  users: { id: string; name: string; role: string }[];
  /** Design v2 toggle. */
  useV2?: boolean;
};

/**
 * ЭКРАН = WeSetup (мягкие серые рамки `#ececf4`, шапка `#f8f9fc`),
 * ПЕЧАТЬ (Ctrl+P) = «бумага» для инспектора РПН/СЭС (чёрные рамки,
 * белая шапка). Поэтому каждый токен несёт пару screen + `print:`.
 */
/** Скруглённый viewport вокруг таблицы; в печати — прозрачный wrapper. */

/** Сколько строк максимум разрешаем добавить одной пачкой. */
const BULK_ROWS_MAX = 50;

/** Пауза до автосохранения после последнего нажатия клавиши в ячейке. */
const AUTOSAVE_DELAY_MS = 800;

/** Текстовые поля строки — только они рендерятся колонками таблицы. */
type FinishedProductTextField =
  | "productionDateTime"
  | "rejectionTime"
  | "productName"
  | "organoleptic"
  | "productTemp"
  | "correctiveAction"
  | "oxygenLevel"
  | "releasePermissionTime"
  | "courierTransferTime"
  | "responsiblePerson"
  | "inspectorName";

type FinishedProductColumn = {
  key: string;
  label: string;
  /** Доля ширины: процент = weight / Σweight. */
  weight: number;
  field: FinishedProductTextField;
  align?: "center";
  /** id `<datalist>` с подсказками, если у колонки есть справочник. */
  list?: string;
};

const QUALITY_GUIDELINES = [
  "Контроль за доброкачественностью пищи проводится органолептическим методом.",
  "Осмотр лучше проводить при дневном свете, запах и вкус оценивать при характерной температуре блюда.",
  "Для измерения температуры используйте только исправные термометры-зонды.",
];

const TEMPERATURE_GUIDELINES = [
  ["A", "Натуральные рубленые изделия из мяса", "+85"],
  ["B", "Изделия из фарша: котлеты, биточки, тефтели, зразы", "+90"],
  ["C", "Мясо, рыба, ракообразные", "+68"],
  ["D", "Домашняя птица, яйца, рыба, мясо измельченное", "+74"],
  ["E", "Цельная говядина, баранина, рыба для холодного употребления", "+65"],
  ["G", "Холодные блюда: салаты, десерты", "+2..+5"],
  ["H", "Горячие блюда: супы, соусы", ">+75"],
] as const;

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  const dt = new Date();
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function parseDateTime(value: string) {
  const [date = nowDate(), time = nowTime()] = value.split(" ");
  return { date, time };
}

function mergeDateTime(date: string, time: string) {
  return `${date} ${time}`;
}

function createDraft(users: Props["users"], productName = ""): FinishedProductDocumentRow {
  return createFinishedProductRow({
    productName,
    productionDateTime: mergeDateTime(nowDate(), nowTime()),
    rejectionTime: mergeDateTime(nowDate(), nowTime()),
    releasePermissionTime: mergeDateTime(nowDate(), nowTime()),
    courierTransferTime: mergeDateTime(nowDate(), nowTime()),
    responsiblePerson: users[0]?.name || "",
    inspectorName: users[1]?.name || users[0]?.name || "",
    releaseAllowed: "yes",
  });
}

export function FinishedProductDocumentClient({
  documentId,
  title,
  organizationName,
  controlPeriodicity = "",
  dateFrom,
  dateTo,
  status,
  initialConfig,
  users,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState(() => normalizeFinishedProductDocumentConfig(initialConfig));
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeAction = useDocumentCloseAction({ documentId, title });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [draftRow, setDraftRow] = useState<FinishedProductDocumentRow>(() => createDraft(users));
  const [guideOpen, setGuideOpen] = useState(false);
  const readOnly = status === "closed";
  const { mobileView, switchMobileView } = useMobileView("finished_product");

  /* ── Автосохранение ячеек ───────────────────────────────────────────
   * Кнопки «Сохранить» на эталоне нет: правки ячеек уезжают на сервер
   * сами. Копим последнее состояние в ref и шлём один PATCH через
   * AUTOSAVE_DELAY_MS после последнего нажатия клавиши; blur и любые
   * структурные операции (добавить/удалить строку, правка справочника)
   * сбрасывают очередь немедленно. `router.refresh()` здесь НЕ зовём —
   * он перерисовывает серверный компонент и сбивает фокус в поле.
   */
  const pendingConfigRef = useRef<FinishedProductDocumentConfig | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const flushConfigSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const next = pendingConfigRef.current;
    pendingConfigRef.current = null;
    if (!next) return;
    setIsAutoSaving(true);
    void fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: next }),
    })
      .then((response) => {
        if (!response.ok) throw new Error();
      })
      .catch(() => toast.error("Не удалось сохранить журнал — изменения остались только на экране"))
      .finally(() => setIsAutoSaving(false));
  }, [documentId]);

  /** Применить новое состояние конфига и поставить его в очередь записи. */
  const commitConfig = useCallback(
    (next: FinishedProductDocumentConfig, immediate = false) => {
      setConfig(next);
      pendingConfigRef.current = next;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (immediate) {
        flushConfigSave();
        return;
      }
      saveTimerRef.current = setTimeout(flushConfigSave, AUTOSAVE_DELAY_MS);
    },
    [flushConfigSave]
  );

  // Уход со страницы не должен съедать последний недописанный ввод.
  useEffect(() => () => flushConfigSave(), [flushConfigSave]);

  const cardItems: RecordCardItem[] = config.rows.map((row, index) => ({
    id: row.id,
    title: `№${index + 1} · ${row.productName || "—"}`,
    subtitle: row.productionDateTime || undefined,
    leading: !readOnly ? (
      <Checkbox
        checked={selectedRows.includes(row.id)}
        onCheckedChange={(value) =>
          setSelectedRows((prev) =>
            value === true
              ? [...new Set([...prev, row.id])]
              : prev.filter((item) => item !== row.id)
          )
        }
        className="size-5"
      />
    ) : null,
    fields: [
      { label: "Время снятия бракеража", value: row.rejectionTime, hideIfEmpty: true },
      { label: "Органолептика", value: row.organoleptic, hideIfEmpty: true },
      config.showProductTemp
        ? { label: "T°C внутри продукта", value: row.productTemp, hideIfEmpty: true }
        : null,
      config.showCorrectiveAction
        ? { label: "Корректирующие действия", value: row.correctiveAction, hideIfEmpty: true }
        : null,
      config.showOxygenLevel
        ? { label: "Остаточный уровень кислорода, % об.", value: row.oxygenLevel, hideIfEmpty: true }
        : null,
      { label: "Разрешение к реализации", value: row.releasePermissionTime, hideIfEmpty: true },
      config.showCourierTime
        ? { label: "Передача курьеру", value: row.courierTransferTime, hideIfEmpty: true }
        : null,
      { label: "Исполнитель", value: row.responsiblePerson, hideIfEmpty: true },
      { label: "Провёл бракераж", value: row.inspectorName, hideIfEmpty: true },
    ].filter((f): f is { label: string; value: string; hideIfEmpty: boolean } => f !== null),
  }));

  const productOptions = useMemo(() => Array.from(new Set(config.itemsCatalog)).filter(Boolean), [config.itemsCatalog]);
  // Dedupe by name — multiple staff records can carry identical full
  // names ("Титов Максим Андреевич"), and React would warn about
  // duplicate keys in the <datalist> below. The select still falls
  // back to a free-text input, so dropping ID-disambiguation here is
  // safe for the autosuggest UX.
  const personOptions = useMemo(
    () => Array.from(new Set(users.map((item) => item.name).filter(Boolean))),
    [users]
  );

  /**
   * Колонки таблицы одним описанием: заголовок + вес для colgroup.
   * Базовые 7 колонок дают ровно 100 «весов» — сумма процентов совпадает
   * с эталоном; включение опций пересчитывает доли автоматически.
   */
  const columns = useMemo<FinishedProductColumn[]>(() => {
    const list: FinishedProductColumn[] = [
      { key: "production", label: "Дата, время изготовления", weight: 7, field: "productionDateTime", align: "center" },
      { key: "rejection", label: "Время снятия бракеража", weight: 7, field: "rejectionTime", align: "center" },
      {
        key: "name",
        label: config.fieldNameMode === "semi" ? "Наименование полуфабриката" : "Наименование блюд (изделий)",
        weight: 14,
        field: "productName",
        list: "finished-product-items",
      },
      {
        key: "organoleptic",
        label: "Органолептическая оценка (включая оценку степени готовности)",
        weight: 26,
        field: "organoleptic",
      },
    ];
    if (config.showProductTemp) {
      list.push({ key: "temp", label: "T°C внутри продукта", weight: 8, field: "productTemp", align: "center" });
    }
    if (config.showCorrectiveAction) {
      list.push({ key: "corrective", label: "Корректирующие действия", weight: 12, field: "correctiveAction" });
    }
    if (config.showOxygenLevel) {
      list.push({ key: "oxygen", label: "Остаточный уровень кислорода, % об.", weight: 9, field: "oxygenLevel", align: "center" });
    }
    list.push({ key: "release", label: "Разрешение к реализации (время)", weight: 10, field: "releasePermissionTime", align: "center" });
    if (config.showCourierTime) {
      list.push({ key: "courier", label: "Время передачи блюд курьеру", weight: 9, field: "courierTransferTime", align: "center" });
    }
    list.push({
      key: "responsible",
      label: "Ответственный исполнитель (ФИО, должность)",
      weight: 18,
      field: "responsiblePerson",
      list: "finished-product-users",
    });
    list.push({
      key: "inspector",
      label:
        config.inspectorMode === "commission_signatures"
          ? "Подписи членов комиссии"
          : "ФИО лица, проводившего бракераж",
      weight: 18,
      field: "inspectorName",
      list: "finished-product-users",
    });
    return list;
  }, [
    config.fieldNameMode,
    config.inspectorMode,
    config.showCorrectiveAction,
    config.showCourierTime,
    config.showOxygenLevel,
    config.showProductTemp,
  ]);

  const columnsWeight = columns.reduce((sum, column) => sum + column.weight, 0);
  /**
   * Ниже этой ширины колонки перестают читаться — включаем скролл внутри
   * viewport'а таблицы. 7 базовых колонок помещаются в контент 1248px,
   * каждая опциональная добавляет свои ~130px.
   */
  const tableMinWidth = 960 + Math.max(columns.length - 7, 0) * 130;

  /**
   * Явное сохранение (диалог настроек, добавление строки из модалки).
   * Гасит очередь автосохранения — иначе отложенный PATCH со старым
   * состоянием мог бы «догнать» и перетереть только что записанное.
   */
  async function saveConfig(nextConfig = config) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingConfigRef.current = null;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/journal-documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: nextConfig }),
      });
      if (!response.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      toast.error("Не удалось сохранить журнал");
    } finally {
      setIsSaving(false);
    }
  }

  function updateRow(id: string, patch: Partial<FinishedProductDocumentRow>) {
    commitConfig({
      ...config,
      rows: config.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  }

  async function removeSelectedRows() {
    if (readOnly || selectedRows.length === 0) return;
    const names = config.rows
      .filter((row) => selectedRows.includes(row.id))
      .map((row) => row.productName)
      .filter(Boolean);
    const confirmed = await confirmAsync({
      title: "Удалить выбранные записи?",
      description: "Записи бракеража исчезнут из журнала после сохранения.",
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
        { label: `Останется записей: ${config.rows.length - selectedRows.length}`, tone: "default" },
      ],
    });
    if (!confirmed) return;
    commitConfig(
      { ...config, rows: config.rows.filter((row) => !selectedRows.includes(row.id)) },
      true
    );
    setSelectedRows([]);
  }

  /** «Добавить несколько изделий» — пачка пустых строк. */
  async function addSeveralRows() {
    const raw = await promptAsync({
      title: "Добавить несколько изделий",
      description:
        "В таблицу добавятся пустые строки с текущей датой и временем — останется только вписать наименования.",
      label: "Сколько строк добавить",
      type: "number",
      defaultValue: "3",
      placeholder: "3",
      confirmLabel: "Добавить",
      validate: (value) => {
        const count = Number(value);
        if (!value.trim()) return "Введите число";
        if (!Number.isInteger(count) || count <= 0) return "Нужно целое число больше нуля";
        if (count > BULK_ROWS_MAX) return `За один раз можно добавить не больше ${BULK_ROWS_MAX} строк`;
        return null;
      },
    });
    if (raw === null) return;
    const count = Number(raw);
    if (!Number.isInteger(count) || count <= 0 || count > BULK_ROWS_MAX) return;
    commitConfig(
      {
        ...config,
        rows: [...config.rows, ...Array.from({ length: count }, () => createDraft(users))],
      },
      true
    );
  }

  /** «Добавить из файла» — многострочная вставка списка наименований. */
  function addRowsFromText() {
    const items = bulkText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    commitConfig(
      { ...config, rows: [...config.rows, ...items.map((item) => createDraft(users, item))] },
      true
    );
    setBulkText("");
    setBulkOpen(false);
    toast.success(`Добавлено строк: ${items.length}`);
  }

  async function saveDraftRow() {
    const nextConfig = { ...config, rows: [...config.rows, draftRow] };
    setConfig(nextConfig);
    await saveConfig(nextConfig);
    setDraftRow(createDraft(users));
    setAddModalOpen(false);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayFocusRowId = config.rows.find((row) => row.productionDateTime.slice(0, 10) === todayKey)?.id;

  return (
    <div className="space-y-6 text-black">
      <FocusTodayScroller
        onCreate={!readOnly ? () => setAddModalOpen(true) : undefined}
      />
      <div className="rounded-[28px] bg-white py-5 shadow-sm sm:py-7">
        <DocumentActionsBar
          className="mb-0"
          backHref="/journals/finished_product"
          documentId={documentId}
          heading={<h1 className={DOC_HEADING_CLASS}>{title}</h1>}
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
      </div>

      {readOnly ? (
        <JournalClosedBanner hint="Верните журнал в активные, чтобы снова вносить записи бракеража." />
      ) : null}

      {/* Карточной обёртки (рамка + скругление) нет — как в incoming_control
          и uv_lamp_runtime и как на эталоне: документ лежит прямо на белом
          фоне раздела, горизонтальную геометрию задаёт контейнер страницы. */}
      <div className={`${DOC_BODY_STACK_CLASS} py-4 sm:py-6`}>
        <div className={`${DOC_PAPER_HEADER_CLASS} ${GRID_VIEWPORT_CLASS}`}>
          <table className="w-full min-w-[640px] border-collapse text-[13px] sm:min-w-0">
            <tbody>
              <JournalPaperHeaderRows
                orgName={organizationName}
                title="ЖУРНАЛ БРАКЕРАЖА ГОТОВОЙ ПИЩЕВОЙ ПРОДУКЦИИ"
                startedAt={dateFrom}
                finishedAt={readOnly ? dateTo : null}
                controlPeriodicity={controlPeriodicity}
                orgCellClass="w-[18%]"
                sideCellClass="w-[20%]"
              />
            </tbody>
          </table>
        </div>

        {/* Кегль КАПС-заголовка — по эталону (finished_product-grid.png):
            ~14px bold, а не «плакат» на 30px. */}
        <h2 className={`${DOC_CAPS_TITLE_CLASS} text-center text-[13px] font-bold uppercase leading-tight sm:text-[14px]`}>Журнал бракеража готовой пищевой продукции</h2>

        {!readOnly && <div className={DOC_ADD_ROW_CLASS}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#4a5bf0]"><Plus className="size-5" strokeWidth={2.5} />Добавить<ChevronDown className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px] rounded-[24px] border-0 p-3 shadow-xl">
              <DropdownMenuItem className="mb-1 h-9 rounded-xl px-3.5 text-[13.5px]" onSelect={() => setAddModalOpen(true)}>Добавить изделие</DropdownMenuItem>
              <DropdownMenuItem className="mb-1 h-9 rounded-xl px-3.5 text-[13.5px]" onSelect={() => void addSeveralRows()}>Добавить несколько изделий</DropdownMenuItem>
              <DropdownMenuItem className="h-9 rounded-xl px-3.5 text-[13.5px]" onSelect={() => { setBulkText(""); setBulkOpen(true); }}>Добавить списком</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Тот же обработчик, что у пункта «Добавить изделие» в дропдауне —
              на эталоне это отдельная кнопка рядом. */}
          <Button type="button" className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#4a5bf0]" onClick={() => setAddModalOpen(true)}><Plus className="size-5" strokeWidth={2.5} />Добавить изделие</Button>
          <Button type="button" variant="outline" className="h-11 rounded-lg border-0 bg-[#f5f6ff] px-5 text-[15px] font-medium text-[#3848c7] shadow-none transition-colors duration-150 hover:bg-[#eceeff]" onClick={() => setCatalogOpen(true)}>Редактировать список изделий</Button>
          {/* Кнопки «Сохранить» нет: правки уезжают сами (см. commitConfig). */}
          {isAutoSaving || isSaving || isPending ? (
            <span className="text-[13px] text-[#6f7282]">Сохранение…</span>
          ) : null}
        </div>}
        <JournalSelectionBar
          count={selectedRows.length}
          onClear={() => setSelectedRows([])}
          onDelete={() => void removeSelectedRows()}
          hint="Строки журнала будут удалены без возможности отмены"
        />

        <div className="sm:hidden print:hidden">
          <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
        </div>

        {mobileView === "cards" ? (
          <RecordCardsView items={cardItems} emptyLabel="Бракеража пока не зарегистрировано." />
        ) : null}

        <MobileViewTableWrapper mobileView={mobileView} className={GRID_VIEWPORT_CLASS}>
          {/*
            `table-fixed` + colgroup в процентах: все колонки укладываются в
            1248px контента на 1440px, последние («Ответственный исполнитель»,
            «ФИО лица, проводившего бракераж») больше не уезжают за контейнер.
            Проценты считаются из весов, поэтому включение любой из четырёх
            опциональных колонок пересчитывает сетку, а не ломает её.
            `minWidth` включает скролл ВНУТРИ viewport-контейнера — страница
            по горизонтали не едет.
          */}
          <table
            className="w-full table-fixed border-collapse text-[12.5px]"
            style={{ minWidth: `${tableMinWidth}px` }}
          >
            <colgroup>
              <col style={{ width: "36px" }} />
              {columns.map((column) => (
                <col key={column.key} style={{ width: `${(column.weight / columnsWeight) * 100}%` }} />
              ))}
            </colgroup>
            <thead><tr>
              {/* Select-all — как в остальных журналах: одна галочка
                  отмечает все строки листа, снятие очищает выделение. */}
              <th className={`${GRID_HEAD_CELL_CLASS} px-1.5 py-1.5 text-center leading-tight`}>
                <Checkbox
                  checked={config.rows.length > 0 && selectedRows.length === config.rows.length}
                  onCheckedChange={(value) =>
                    !readOnly &&
                    setSelectedRows(value === true ? config.rows.map((row) => row.id) : [])
                  }
                  disabled={readOnly || config.rows.length === 0}
                  aria-label="Выбрать все строки"
                />
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${GRID_HEAD_CELL_CLASS} px-1.5 py-1.5 text-center text-[11.5px] font-semibold leading-[1.25]`}
                >
                  {column.label}
                </th>
              ))}
            </tr></thead>
            <tbody>{config.rows.map((row) => <tr key={row.id} data-focus-today={row.id === todayFocusRowId ? "" : undefined}>
              <td className={`${GRID_CELL_CLASS} px-1.5 py-1 text-center align-middle leading-tight`}><Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={(value) => !readOnly && setSelectedRows((prev) => value === true ? [...new Set([...prev, row.id])] : prev.filter((item) => item !== row.id))} disabled={readOnly} /></td>
              {columns.map((column) => (
                <td key={column.key} className={`${GRID_CELL_CLASS} p-0.5 align-middle leading-tight`}>
                  <Input
                    value={row[column.field]}
                    onChange={(event) =>
                      updateRow(row.id, {
                        [column.field]: event.target.value,
                      } as Partial<FinishedProductDocumentRow>)
                    }
                    onBlur={flushConfigSave}
                    className={`h-7 rounded-none border-0 px-1.5 py-0 text-[12.5px] shadow-none md:text-[12.5px] ${column.align === "center" ? "text-center" : ""}`}
                    disabled={readOnly}
                    list={column.list}
                  />
                </td>
              ))}
            </tr>)}</tbody>
          </table>
          <datalist id="finished-product-items">{productOptions.map((item) => <option key={item} value={item} />)}</datalist>
          <datalist id="finished-product-users">{personOptions.map((item) => <option key={item} value={item} />)}</datalist>
        </MobileViewTableWrapper>

        {/* «Примечание:» под таблицей — как на эталоне, и на экране, и в печати.
            Пустое примечание блок не рисует. */}
        {config.footerNote ? (
          <div className={`${DOC_EXTRA_BLOCK_CLASS} text-[12.5px] leading-[1.5]`}>
            <div className="font-bold">Примечание:</div>
            <div className="whitespace-pre-line">{config.footerNote}</div>
          </div>
        ) : null}

        {/* Справочный блок — только ссылка, раскрывается по клику.
            В бумажную форму эталона он не входит → print:hidden. */}
        <div className={`${DOC_EXTRA_BLOCK_CLASS} print:hidden`}>
          <button
            type="button"
            onClick={() => setGuideOpen((prev) => !prev)}
            aria-expanded={guideOpen}
            className="rounded-md text-left text-[13px] font-semibold text-[#0b1024] underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-[#3848c7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
          >
            {/* Шеврона нет: на эталоне это обычная подчёркнутая ссылка-текст,
                раскрытие остаётся по клику. */}
            {FINISHED_PRODUCT_QUALITY_GUIDE_TITLE}
          </button>
          {guideOpen ? (
            <div className="mt-4 space-y-3 rounded-[16px] border border-[#ececf4] bg-[#fafbff] p-4 sm:p-5">
              {QUALITY_GUIDELINES.map((item) => <p key={item} className="text-[13.5px] leading-[1.55] text-[#3c4053]">{item}</p>)}
              <div className={GRID_VIEWPORT_CLASS}>
                <table className="w-full min-w-[520px] border-collapse text-[12.5px]"><thead><tr><th className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 leading-tight`}>Группа</th><th className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 leading-tight`}>Наименование продукта</th><th className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 leading-tight`}>°C</th></tr></thead><tbody>{TEMPERATURE_GUIDELINES.map(([group, name, temperature]) => <tr key={group}><td className={`${GRID_CELL_CLASS} px-2 py-1 text-center font-semibold leading-tight`}>{group}</td><td className={`${GRID_CELL_CLASS} px-2 py-1 leading-tight`}>{name}</td><td className={`${GRID_CELL_CLASS} px-2 py-1 text-center font-semibold leading-tight`}>{temperature}</td></tr>)}</tbody></table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={readOnly ? false : addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Добавление новой строки
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Дата и время изготовления</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.productionDateTime).date} onChange={(e) => setDraftRow((prev) => ({ ...prev, productionDateTime: mergeDateTime(e.target.value, parseDateTime(prev.productionDateTime).time) }))} />
                <Input type="time" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.productionDateTime).time} onChange={(e) => setDraftRow((prev) => ({ ...prev, productionDateTime: mergeDateTime(parseDateTime(prev.productionDateTime).date, e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Время снятия бракеража</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.rejectionTime).date} onChange={(e) => setDraftRow((prev) => ({ ...prev, rejectionTime: mergeDateTime(e.target.value, parseDateTime(prev.rejectionTime).time) }))} />
                <Input type="time" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.rejectionTime).time} onChange={(e) => setDraftRow((prev) => ({ ...prev, rejectionTime: mergeDateTime(parseDateTime(prev.rejectionTime).date, e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Наименование изделия</Label>
              <Input className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={draftRow.productName} onChange={(e) => setDraftRow((prev) => ({ ...prev, productName: e.target.value }))} list="finished-product-items" />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Органолептическая оценка</Label>
              <Input className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={draftRow.organoleptic} onChange={(e) => setDraftRow((prev) => ({ ...prev, organoleptic: e.target.value }))} />
            </div>
            {config.showProductTemp ? (
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">T°C внутри продукта</Label>
                <Input className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={draftRow.productTemp} onChange={(e) => setDraftRow((prev) => ({ ...prev, productTemp: e.target.value }))} />
              </div>
            ) : null}
            {config.showOxygenLevel ? (
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Остаточный уровень кислорода, % об.</Label>
                <Input className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={draftRow.oxygenLevel} onChange={(e) => setDraftRow((prev) => ({ ...prev, oxygenLevel: e.target.value }))} />
              </div>
            ) : null}
            {config.showCorrectiveAction ? (
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Корректирующие действия</Label>
                <Textarea className="rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px]" value={draftRow.correctiveAction} onChange={(e) => setDraftRow((prev) => ({ ...prev, correctiveAction: e.target.value }))} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Разрешение к реализации</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["yes", "Да", "#136b2a", "#ecfdf5"],
                    ["no", "Нет", "#d2453d", "#fff4f2"],
                  ] as const
                ).map(([value, label, fg, bg]) => {
                  const active = draftRow.releaseAllowed === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDraftRow((prev) => ({ ...prev, releaseAllowed: value }))}
                      className={`flex h-9 items-center justify-center rounded-xl border px-3.5 text-[14px] font-medium transition-colors ${active ? "border-transparent text-white" : "border-[#dcdfed] bg-white text-[#0b1024] hover:bg-[#fafbff]"}`}
                      style={active ? { backgroundColor: fg, color: "white" } : { backgroundColor: bg, color: fg, borderColor: bg }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Дата и время разрешения</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.releasePermissionTime).date} onChange={(e) => setDraftRow((prev) => ({ ...prev, releasePermissionTime: mergeDateTime(e.target.value, parseDateTime(prev.releasePermissionTime).time) }))} />
                <Input type="time" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.releasePermissionTime).time} onChange={(e) => setDraftRow((prev) => ({ ...prev, releasePermissionTime: mergeDateTime(parseDateTime(prev.releasePermissionTime).date, e.target.value) }))} />
              </div>
            </div>
            {config.showCourierTime ? (
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Дата и время передачи блюд курьеру</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.courierTransferTime).date} onChange={(e) => setDraftRow((prev) => ({ ...prev, courierTransferTime: mergeDateTime(e.target.value, parseDateTime(prev.courierTransferTime).time) }))} />
                  <Input type="time" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={parseDateTime(draftRow.courierTransferTime).time} onChange={(e) => setDraftRow((prev) => ({ ...prev, courierTransferTime: mergeDateTime(parseDateTime(prev.courierTransferTime).date, e.target.value) }))} />
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Ответственный исполнитель</Label>
              <Input className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={draftRow.responsiblePerson} onChange={(e) => setDraftRow((prev) => ({ ...prev, responsiblePerson: e.target.value }))} list="finished-product-users" />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">{config.inspectorMode === "commission_signatures" ? "Подписи членов комиссии" : "Лицо, проводившее бракераж"}</Label>
              <Input className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" value={draftRow.inspectorName} onChange={(e) => setDraftRow((prev) => ({ ...prev, inspectorName: e.target.value }))} list="finished-product-users" />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-9 w-full rounded-xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto" onClick={() => setAddModalOpen(false)}>Отмена</Button>
            <Button type="button" className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto" onClick={() => { void saveDraftRow(); }} disabled={isSaving}>
              {isSaving ? "Сохранение…" : "Добавить запись"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <JournalSettingsModal
        open={readOnly ? false : settingsOpen}
          onOpenChange={setSettingsOpen}
          title="Настройки журнала"
          description="Колонки таблицы и подпись внизу журнала."
          size="md"
          isSaving={isSaving}
          onSave={async () => {
            await saveConfig();
            setSettingsOpen(false);
          }}
          onCancel={() => setSettingsOpen(false)}
        >
          <div className="space-y-2">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Колонки таблицы
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:bg-[#f5f6ff]">
              <Checkbox
                checked={config.showProductTemp}
                onCheckedChange={(value) =>
                  setConfig((prev) => ({ ...prev, showProductTemp: value === true }))
                }
              />
              <span className="text-[14px] text-[#0b1024]">T°C внутри продукта</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:bg-[#f5f6ff]">
              <Checkbox
                checked={config.showCorrectiveAction}
                onCheckedChange={(value) =>
                  setConfig((prev) => ({ ...prev, showCorrectiveAction: value === true }))
                }
              />
              <span className="text-[14px] text-[#0b1024]">Корректирующие действия</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:bg-[#f5f6ff]">
              <Checkbox
                checked={config.showOxygenLevel}
                onCheckedChange={(value) =>
                  setConfig((prev) => ({ ...prev, showOxygenLevel: value === true }))
                }
              />
              <span className="text-[14px] text-[#0b1024]">Остаточный уровень кислорода, % об.</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:bg-[#f5f6ff]">
              <Checkbox
                checked={config.showCourierTime}
                onCheckedChange={(value) =>
                  setConfig((prev) => ({ ...prev, showCourierTime: value === true }))
                }
              />
              <span className="text-[14px] text-[#0b1024]">Время передачи блюд курьеру</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Примечание под таблицей
            </Label>
            <Textarea
              value={config.footerNote}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, footerNote: e.target.value }))
              }
              className="min-h-[80px] rounded-2xl border-[#dcdfed] px-4 py-3 text-[14px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
            />
          </div>
        </JournalSettingsModal>


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
              создастся запись бракеража с текущей датой и временем.
            </p>
            <Textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"Борщ\nКотлета по-киевски\nСалат «Цезарь»"}
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
              disabled={bulkText.split("\n").map((item) => item.trim()).filter(Boolean).length === 0}
            >
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={readOnly ? false : catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>Список изделий</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <p className="text-[13px] text-[#6f7282]">
              Эти изделия появятся в выпадающем списке при добавлении строки журнала.
            </p>
            {Array.from(new Set(config.itemsCatalog)).length === 0 ? (
              <p className="rounded-[14px] bg-[#f6f7fb] px-4 py-3 text-[13px] text-[#6f7282]">
                Список пуст. Введите название изделия ниже и нажмите «+».
              </p>
            ) : null}
            {Array.from(new Set(config.itemsCatalog)).map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-[#e6e6f0] px-3 py-2"><div className="flex-1 text-[14px]">{item}</div><Button type="button" variant="ghost" title="Удалить изделие из списка" onClick={() => commitConfig({ ...config, itemsCatalog: config.itemsCatalog.filter((catalogItem) => catalogItem !== item) }, true)}><Trash2 className="size-4" /></Button></div>)}
            <div className="flex gap-2"><Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Введите название нового изделия" className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" /><Button className="h-10 rounded-lg bg-[#5566f6] px-4 text-white hover:bg-[#4a5bf0]" title="Добавить изделие в список" onClick={() => { if (!newItemName.trim()) return; commitConfig({ ...config, itemsCatalog: Array.from(new Set([...config.itemsCatalog, newItemName.trim()])) }, true); setNewItemName(""); }}><Plus className="size-4" /></Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
